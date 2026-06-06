import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, secondaryAuth } from "./firebase";
import { generateEvaluatorEmail, generateEvaluatorPassword } from "./credentials";
import type { ParsedEvaluatorRow, ParsedTeamRow } from "./excelParse";
import { isValidPrefixedId, normalizePrefixedIdKey } from "./idFormat";

export interface EvaluatorUploadResult {
  name: string;
  email: string;
  password: string;
  venue: string;
  status: "created" | "skipped" | "error";
  message?: string;
}

export interface TeamUploadResult {
  teamId: string;
  status: "created" | "duplicate" | "error";
  message?: string;
}

/** Create Firebase Auth accounts + users + evaluators docs from parsed Excel rows. */
export async function uploadEvaluatorsFromExcel(
  rows: ParsedEvaluatorRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<EvaluatorUploadResult[]> {
  const results: EvaluatorUploadResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = generateEvaluatorEmail(row.name);
    const password = generateEvaluatorPassword(row.name);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        name: row.name,
        email,
        role: "evaluator",
        disabled: false,
        venue: row.venue,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "evaluators", cred.user.uid), {
        uid: cred.user.uid,
        srNo: row.srNo,
        name: row.name,
        email,
        password,
        venue: row.venue,
        assignedTeamIds: row.assignedTeamIds,
        createdAt: new Date().toISOString(),
      });

      results.push({ name: row.name, email, password, venue: row.venue, status: "created" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("email-already-in-use")) {
        results.push({
          name: row.name,
          email,
          password,
          venue: row.venue,
          status: "skipped",
          message: "Email already registered",
        });
      } else {
        results.push({
          name: row.name,
          email,
          password,
          venue: row.venue,
          status: "error",
          message: msg,
        });
      }
    }

    onProgress?.(i + 1, rows.length);
  }

  return results;
}

/** Normalize team ID to a stable Firestore document id. */
export function normalizeTeamDocId(teamId: string): string {
  return teamId.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Bulk-write teams to Firestore (batched, max 500 per batch). Skips duplicate Team IDs. */
export async function uploadTeamsFromExcel(
  rows: ParsedTeamRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<TeamUploadResult[]> {
  const results: TeamUploadResult[] = [];
  const BATCH_SIZE = 450;
  const existingKeys = await getExistingTeamIdKeys();
  const pendingKeys = new Set<string>();

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);
    let batchOps = 0;

    for (const row of chunk) {
      const normalizedId = normalizePrefixedIdKey(row.teamId);

      if (!isValidPrefixedId("T", normalizedId)) {
        results.push({
          teamId: row.teamId,
          status: "error",
          message: "Invalid format — use T followed by 3 digits (e.g. T001).",
        });
        continue;
      }

      if (existingKeys.has(normalizedId) || pendingKeys.has(normalizedId)) {
        results.push({
          teamId: normalizedId,
          status: "duplicate",
          message: existingKeys.has(normalizedId)
            ? "Team ID already exists in the system."
            : "Duplicate Team ID in this upload file.",
        });
        continue;
      }

      try {
        const docId = normalizeTeamDocId(normalizedId);
        batch.set(doc(db, "teams", docId), {
          teamId: normalizedId,
          teamName: row.teamName,
          teamLeadName: row.teamLeadName,
          venue: row.venue || "",
          createdAt: new Date().toISOString(),
        });
        pendingKeys.add(normalizedId);
        existingKeys.add(normalizedId);
        batchOps++;
        results.push({ teamId: normalizedId, status: "created" });
      } catch (err: unknown) {
        results.push({
          teamId: normalizedId,
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    if (batchOps > 0) {
      await batch.commit();
    }
    onProgress?.(Math.min(offset + chunk.length, rows.length), rows.length);
  }

  return results;
}

/** Existing Team IDs in Firestore (case-insensitive). */
export async function getExistingTeamIdKeys(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "teams"));
  const keys = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data();
    keys.add(normalizePrefixedIdKey(String(data.teamId ?? d.id)));
  }
  return keys;
}

/** Save assigned team IDs for an evaluator (evaluators + users docs). */
export async function saveEvaluatorTeamAssignment(
  uid: string,
  assignedTeamIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    doc(db, "evaluators", uid),
    { assignedTeamIds, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  batch.set(
    doc(db, "users", uid),
    { assignedTeamIds, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  await batch.commit();
}

/** Count unique teams by teamId (ignores duplicate Firestore docs). */
export function countUniqueTeamDocs(docs: QueryDocumentSnapshot[]): number {
  const uniqueIds = new Set<string>();
  for (const d of docs) {
    const data = d.data();
    const teamId = String(data.teamId ?? d.id).trim().toLowerCase();
    if (teamId) uniqueIds.add(teamId);
  }
  return uniqueIds.size;
}

export async function getUploadedTeamsCount(): Promise<number> {
  const snap = await getDocs(collection(db, "teams"));
  return countUniqueTeamDocs(snap.docs);
}

/** Real-time unique uploaded team count from the teams collection. */
export function subscribeUploadedTeamsCount(
  onCount: (count: number) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "teams"),
    (snap) => onCount(countUniqueTeamDocs(snap.docs)),
    (err) => onError?.(err),
  );
}

/** Fetch teams deduped by teamId (keeps first occurrence). */
export async function fetchUniqueTeams(): Promise<
  { id: string; teamId: string; teamName: string; teamLeadName: string; venue: string }[]
> {
  const snap = await getDocs(collection(db, "teams"));
  const byTeamId = new Map<string, { id: string; teamId: string; teamName: string; teamLeadName: string; venue: string }>();

  for (const d of snap.docs) {
    const data = d.data();
    const teamId = String(data.teamId ?? d.id).trim();
    const key = teamId.toLowerCase();
    if (!key || byTeamId.has(key)) continue;
    byTeamId.set(key, {
      id: d.id,
      teamId,
      teamName: String(data.teamName ?? ""),
      teamLeadName: String(data.teamLeadName ?? ""),
      venue: String(data.venue ?? ""),
    });
  }

  return [...byTeamId.values()].sort((a, b) => a.teamId.localeCompare(b.teamId));
}

/** Delete a single evaluator (users + evaluators Firestore docs). */
export async function deleteEvaluator(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  batch.delete(doc(db, "evaluators", uid));
  await batch.commit();
}

/** Delete all evaluators from users + evaluators collections. */
export async function deleteAllEvaluators(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const snap = await getDocs(collection(db, "evaluators"));
  if (snap.empty) return 0;

  const docs = snap.docs;
  const BATCH_SIZE = 225; // 2 deletes per evaluator → stay under 500 batch limit

  for (let offset = 0; offset < docs.length; offset += BATCH_SIZE) {
    const chunk = docs.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const d of chunk) {
      const uid = d.id;
      batch.delete(doc(db, "evaluators", uid));
      batch.delete(doc(db, "users", uid));
    }
    await batch.commit();
    onProgress?.(Math.min(offset + chunk.length, docs.length), docs.length);
  }

  return docs.length;
}

/** Delete a single team by Firestore document id. */
export async function deleteTeam(docId: string): Promise<void> {
  await deleteDoc(doc(db, "teams", docId));
}

/** Delete all teams in batched writes. */
export async function deleteAllTeams(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const snap = await getDocs(collection(db, "teams"));
  if (snap.empty) return 0;

  const docs = snap.docs;
  const BATCH_SIZE = 450;

  for (let offset = 0; offset < docs.length; offset += BATCH_SIZE) {
    const chunk = docs.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
    onProgress?.(Math.min(offset + chunk.length, docs.length), docs.length);
  }

  return docs.length;
}

/** Save a problem ID + description to Firestore. */
export async function saveProblem(problemId: string, description: string): Promise<void> {
  const id = problemId.trim().toUpperCase();
  await setDoc(doc(db, "problems", id), {
    problemId: id,
    description: description.trim(),
    createdAt: new Date().toISOString(),
  });
}

/** Update an existing problem's description. */
export async function updateProblem(docId: string, description: string): Promise<void> {
  await updateDoc(doc(db, "problems", docId), {
    description: description.trim(),
    updatedAt: new Date().toISOString(),
  });
}

/** Fetch all documents from a collection once (for caching). */
export async function fetchCollectionOnce<T>(
  collectionName: string,
  mapper: (id: string, data: Record<string, unknown>) => T,
): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => mapper(d.id, d.data() as Record<string, unknown>));
}
