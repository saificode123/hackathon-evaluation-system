import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { db, secondaryAuth } from "./firebase";
import { generateEvaluatorEmail, generateEvaluatorPassword } from "./credentials";
import type { ParsedEvaluatorRow, ParsedTeamRow } from "./excelParse";
import type { EvaluatorRecord } from "./types";
import { isValidPrefixedId, normalizePrefixedIdKey } from "./idFormat";
import { saveTotalTeams } from "./settings";

async function syncSettingsToUploadedTeamCount(updatedBy = "Auto-sync"): Promise<number> {
  const count = await getUploadedTeamsCount();
  await saveTotalTeams(count, updatedBy);
  return count;
}

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

function parseSrNo(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    const n = Math.trunc(value);
    return n >= 1 ? n : null;
  }
  if (typeof value === "string" && value.trim()) {
    const n = parseInt(value.trim(), 10);
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return null;
}

async function buildEvaluatorLookupMaps(): Promise<{
  srToUid: Map<number, string>;
  emailToUid: Map<string, string>;
}> {
  const srToUid = new Map<number, string>();
  const emailToUid = new Map<string, string>();

  const ingest = (uid: string, data: Record<string, unknown>) => {
    const sr = parseSrNo(data.srNo);
    if (sr !== null) srToUid.set(sr, uid);
    const email = String(data.email ?? "").trim().toLowerCase();
    if (email) emailToUid.set(email, uid);
  };

  const [evalSnap, userSnap] = await Promise.all([
    getDocs(collection(db, "evaluators")),
    getDocs(query(collection(db, "users"), where("role", "==", "evaluator"))),
  ]);

  for (const d of evalSnap.docs) ingest(d.id, d.data());
  for (const d of userSnap.docs) ingest(d.id, d.data());

  return { srToUid, emailToUid };
}

async function writeEvaluatorFromExcelRow(
  uid: string,
  row: ParsedEvaluatorRow,
  email: string,
  password: string,
): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    {
      name: row.name,
      email,
      role: "evaluator",
      disabled: false,
      venue: row.venue,
      srNo: row.srNo,
      assignedTeamIds: row.assignedTeamIds,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "evaluators", uid),
    {
      uid,
      srNo: row.srNo,
      name: row.name,
      email,
      password,
      venue: row.venue,
      assignedTeamIds: row.assignedTeamIds,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function signOutSecondaryAuth(): Promise<void> {
  try {
    await firebaseSignOut(secondaryAuth);
  } catch {
    // ignore
  }
}

/** Collect all Sr. numbers already used in users + evaluators collections. */
export async function getExistingSrNumbers(): Promise<Set<number>> {
  const [evalSnap, userSnap] = await Promise.all([
    getDocs(collection(db, "evaluators")),
    getDocs(collection(db, "users")),
  ]);
  const srNos = new Set<number>();
  for (const d of [...evalSnap.docs, ...userSnap.docs]) {
    const sr = parseSrNo(d.data().srNo);
    if (sr !== null) srNos.add(sr);
  }
  return srNos;
}

export async function isSrNoTaken(srNo: number): Promise<boolean> {
  const existing = await getExistingSrNumbers();
  return existing.has(srNo);
}

/** Create Firebase Auth accounts + users + evaluators docs from parsed Excel rows. */
export async function uploadEvaluatorsFromExcel(
  rows: ParsedEvaluatorRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<EvaluatorUploadResult[]> {
  const results: EvaluatorUploadResult[] = [];
  const { srToUid, emailToUid } = await buildEvaluatorLookupMaps();
  const pendingSrNos = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = generateEvaluatorEmail(row.name);
    const password = generateEvaluatorPassword(row.name);
    const emailKey = email.toLowerCase();

    const srNo = parseSrNo(row.srNo);
    if (srNo === null) {
      results.push({
        name: row.name,
        email,
        password,
        venue: row.venue,
        status: "error",
        message: "Invalid Sr. No — must be a whole number ≥ 1.",
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }
    row.srNo = srNo;

    const existingUidByEmail = emailToUid.get(emailKey);
    const existingUidBySr = srToUid.get(srNo);

    if (existingUidBySr && existingUidByEmail && existingUidBySr !== existingUidByEmail) {
      results.push({
        name: row.name,
        email,
        password,
        venue: row.venue,
        status: "skipped",
        message: `Sr. No ${srNo} belongs to another evaluator. Use a unique Sr. No.`,
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    if (pendingSrNos.has(srNo) && !existingUidByEmail && !existingUidBySr) {
      results.push({
        name: row.name,
        email,
        password,
        venue: row.venue,
        status: "skipped",
        message: `Duplicate Sr. No ${srNo} in this file.`,
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    const existingUid = existingUidByEmail ?? existingUidBySr;

    if (existingUid) {
      try {
        await writeEvaluatorFromExcelRow(existingUid, row, email, password);
        srToUid.set(srNo, existingUid);
        emailToUid.set(emailKey, existingUid);
        pendingSrNos.add(srNo);
        results.push({
          name: row.name,
          email,
          password,
          venue: row.venue,
          status: "created",
          message: existingUidByEmail ? "Existing evaluator updated." : "Existing Sr. No synced.",
        });
      } catch (err: unknown) {
        results.push({
          name: row.name,
          email,
          password,
          venue: row.venue,
          status: "error",
          message: err instanceof Error ? err.message : "Failed to update evaluator.",
        });
      }
      onProgress?.(i + 1, rows.length);
      continue;
    }

    if (srToUid.has(srNo)) {
      results.push({
        name: row.name,
        email,
        password,
        venue: row.venue,
        status: "skipped",
        message: `Sr. No ${srNo} is already used by another evaluator.`,
      });
      onProgress?.(i + 1, rows.length);
      continue;
    }

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: row.name,
        email,
        role: "evaluator",
        disabled: false,
        venue: row.venue,
        srNo: row.srNo,
        assignedTeamIds: row.assignedTeamIds,
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
      await signOutSecondaryAuth();

      srToUid.set(srNo, cred.user.uid);
      emailToUid.set(emailKey, cred.user.uid);
      pendingSrNos.add(srNo);
      results.push({ name: row.name, email, password, venue: row.venue, status: "created" });
    } catch (err: unknown) {
      await signOutSecondaryAuth();
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg.includes("email-already-in-use")) {
        try {
          const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
          await writeEvaluatorFromExcelRow(cred.user.uid, row, email, password);
          await signOutSecondaryAuth();
          srToUid.set(srNo, cred.user.uid);
          emailToUid.set(emailKey, cred.user.uid);
          pendingSrNos.add(srNo);
          results.push({
            name: row.name,
            email,
            password,
            venue: row.venue,
            status: "created",
            message: "Recovered existing login and synced profile.",
          });
        } catch {
          await signOutSecondaryAuth();
          results.push({
            name: row.name,
            email,
            password,
            venue: row.venue,
            status: "skipped",
            message: "Email already registered with a different password. Delete the old account or use Manage Users.",
          });
        }
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

/** Sync hackathon settings team count after bulk team upload. */
export async function syncTeamCountAfterUpload(updatedBy = "Auto-sync"): Promise<number> {
  return syncSettingsToUploadedTeamCount(updatedBy);
}
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

  await syncSettingsToUploadedTeamCount();
  return results;
}
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
  profile?: { name?: string; email?: string; venue?: string },
): Promise<void> {
  const batch = writeBatch(db);
  const evalPayload: Record<string, unknown> = {
    uid,
    assignedTeamIds,
    updatedAt: new Date().toISOString(),
  };
  if (profile?.name) evalPayload.name = profile.name;
  if (profile?.email) evalPayload.email = profile.email;
  if (profile?.venue !== undefined) evalPayload.venue = profile.venue;

  batch.set(doc(db, "evaluators", uid), evalPayload, { merge: true });
  batch.set(
    doc(db, "users", uid),
    { assignedTeamIds, updatedAt: new Date().toISOString() },
    { merge: true },
  );
  await batch.commit();
}

function mapEvaluatorDoc(id: string, data: Record<string, unknown>): EvaluatorRecord {
  const sr = parseSrNo(data.srNo);
  return {
    id,
    uid: String(data.uid ?? id),
    srNo: sr ?? undefined,
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    password: String(data.password ?? ""),
    venue: String(data.venue ?? ""),
    assignedTeamIds: Array.isArray(data.assignedTeamIds) ? (data.assignedTeamIds as string[]) : [],
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
  };
}

/** Excel-uploaded + manually created evaluators (merged from evaluators + users). */
export async function fetchAllEvaluatorsForAdmin(): Promise<EvaluatorRecord[]> {
  const [evalSnap, userSnap] = await Promise.all([
    getDocs(collection(db, "evaluators")),
    getDocs(query(collection(db, "users"), where("role", "==", "evaluator"))),
  ]);

  const byUid = new Map<string, EvaluatorRecord>();

  for (const d of evalSnap.docs) {
    byUid.set(d.id, mapEvaluatorDoc(d.id, d.data()));
  }

  for (const d of userSnap.docs) {
    const data = d.data();
    const uid = d.id;
    const existing = byUid.get(uid);
    if (existing) {
      if (!existing.srNo && data.srNo) existing.srNo = parseSrNo(data.srNo) ?? undefined;
      if (!existing.venue && data.venue) existing.venue = String(data.venue);
      if (
        (!existing.assignedTeamIds || existing.assignedTeamIds.length === 0) &&
        Array.isArray(data.assignedTeamIds)
      ) {
        existing.assignedTeamIds = data.assignedTeamIds as string[];
      }
      continue;
    }
    byUid.set(uid, mapEvaluatorDoc(uid, data));
  }

  return [...byUid.values()].sort(
    (a, b) => (a.srNo ?? 0) - (b.srNo ?? 0) || a.name.localeCompare(b.name),
  );
}

/** Create evaluators profile for manually added users (Manage Users). */
export async function createManualEvaluatorProfile(params: {
  uid: string;
  name: string;
  email: string;
  venue: string;
  srNo: number;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.set(
    doc(db, "users", params.uid),
    {
      venue: params.venue,
      srNo: params.srNo,
      assignedTeamIds: [],
    },
    { merge: true },
  );
  batch.set(
    doc(db, "evaluators", params.uid),
    {
      uid: params.uid,
      srNo: params.srNo,
      name: params.name,
      email: params.email,
      password: "",
      venue: params.venue,
      assignedTeamIds: [],
      createdAt: new Date().toISOString(),
      source: "manual",
    },
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
  await syncSettingsToUploadedTeamCount();
}

/** Delete all teams in batched writes. */
export async function deleteAllTeams(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const snap = await getDocs(collection(db, "teams"));
  if (snap.empty) {
    await saveTotalTeams(0, "Auto-sync");
    return 0;
  }

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

  await saveTotalTeams(0, "Auto-sync");
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
