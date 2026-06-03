import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import type { Evaluation, HackathonSettings } from "./types";

export const HACKATHON_SETTINGS_DOC_ID = "hackathon";

const settingsRef = () => doc(db, "settings", HACKATHON_SETTINGS_DOC_ID);

export function parseHackathonSettings(data: Record<string, unknown> | undefined): HackathonSettings {
  const raw = data?.totalTeams;
  const totalTeams =
    typeof raw === "number" && !Number.isNaN(raw) && raw >= 0 ? Math.floor(raw) : 0;
  return {
    totalTeams,
    updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : undefined,
    updatedBy: typeof data?.updatedBy === "string" ? data.updatedBy : undefined,
  };
}

export async function fetchHackathonSettings(): Promise<HackathonSettings> {
  const snap = await getDoc(settingsRef());
  return snap.exists() ? parseHackathonSettings(snap.data()) : { totalTeams: 0 };
}

export function subscribeHackathonSettings(
  onData: (settings: HackathonSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    settingsRef(),
    (snap) => onData(snap.exists() ? parseHackathonSettings(snap.data()) : { totalTeams: 0 }),
    (err) => onError?.(err),
  );
}

export async function saveTotalTeams(
  totalTeams: number,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    settingsRef(),
    {
      totalTeams,
      updatedAt: new Date().toISOString(),
      updatedBy,
    },
    { merge: true },
  );
}

/** Unique teams/projects with at least one submitted evaluation. */
export function countEvaluatedTeams(evaluations: Evaluation[]): number {
  const projectIds = new Set<string>();
  for (const ev of evaluations) {
    if (ev.projectId) projectIds.add(ev.projectId);
  }
  return projectIds.size;
}

export function getTeamEvaluationProgress(totalTeams: number, evaluatedTeams: number) {
  const safeTotal = Math.max(0, totalTeams);
  const evaluated = Math.max(0, evaluatedTeams);
  const remaining = Math.max(0, safeTotal - evaluated);
  const percentComplete =
    safeTotal > 0 ? Math.min(100, Math.round((evaluated / safeTotal) * 1000) / 10) : 0;
  const isComplete = safeTotal > 0 && remaining === 0;

  return { totalTeams: safeTotal, evaluatedTeams: evaluated, remaining, percentComplete, isComplete };
}
