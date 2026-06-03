import type { Evaluation } from "./types";
import { calculateAverageScore } from "./rubric";

export const MAX_TEAM_SCORE = 100;

export function isEvaluationLocked(ev: Evaluation): boolean {
  return ev.locked !== false;
}

export function calculateFinalTotalMarks(averageScore: number, graceMarks = 0): number {
  return Math.round((averageScore + graceMarks) * 100) / 100;
}

export function getMaxGraceMarks(averageScore: number): number {
  return Math.max(0, Math.round((MAX_TEAM_SCORE - averageScore) * 100) / 100);
}

export function validateGraceMarks(
  averageScore: number,
  graceMarks: number,
): { ok: true } | { ok: false; message: string; maxGrace: number } {
  if (Number.isNaN(graceMarks) || graceMarks < 0) {
    return {
      ok: false,
      message: "Grace marks must be a number ≥ 0.",
      maxGrace: getMaxGraceMarks(averageScore),
    };
  }
  const maxGrace = getMaxGraceMarks(averageScore);
  const total = calculateFinalTotalMarks(averageScore, graceMarks);
  if (total > MAX_TEAM_SCORE) {
    return {
      ok: false,
      message: `Final total cannot exceed ${MAX_TEAM_SCORE}. Maximum grace for avg ${averageScore.toFixed(2)} is ${maxGrace.toFixed(2)}.`,
      maxGrace,
    };
  }
  return { ok: true };
}

/**
 * Grace marks allowed when this team has at least one evaluation and every
 * submitted evaluation for the team is locked.
 */
export function canApplyGraceMarks(evaluations: Evaluation[]): boolean {
  if (evaluations.length === 0) return false;
  return evaluations.every(isEvaluationLocked);
}

/** First-time entry requires all submitted evals locked; updates allowed once saved. */
export function canEditGraceMarks(
  evaluations: Evaluation[],
  hasGraceRecord: boolean,
): boolean {
  return hasGraceRecord || canApplyGraceMarks(evaluations);
}

export function countLockedTeamEvaluations(evaluations: Evaluation[]): number {
  return evaluations.filter(isEvaluationLocked).length;
}

export function getGraceMarksBlockReason(evaluations: Evaluation[]): string | null {
  if (evaluations.length === 0) {
    return "No evaluations submitted for this team yet.";
  }
  const unlocked = evaluations.filter((e) => !isEvaluationLocked(e));
  if (unlocked.length > 0) {
    const names = unlocked.map((e) => e.evaluatorName).join(", ");
    return `Lock required from: ${names}. Go to All Evaluations and lock their marks.`;
  }
  return null;
}

export interface ProjectAggregate {
  projectId: string;
  teamId: string;
  teamLead: string;
  teamMembers?: string;
  problemId: string;
  averageScore: number;
  graceMarks: number;
  finalTotalMarks: number;
  evaluatorsCount: number;
  lockedEvaluatorsCount: number;
  allEvaluatorsLocked: boolean;
  canEditGraceMarks: boolean;
  graceBlockReason: string | null;
  evaluations: Evaluation[];
  rank: number;
}

export function buildProjectAggregates(
  evaluations: Evaluation[],
  graceMarksByProjectId: Map<string, number>,
): ProjectAggregate[] {
  const projectMap = new Map<string, Evaluation[]>();
  for (const ev of evaluations) {
    if (!projectMap.has(ev.projectId)) projectMap.set(ev.projectId, []);
    projectMap.get(ev.projectId)!.push(ev);
  }

  const aggregates: ProjectAggregate[] = [...projectMap.entries()].map(([projectId, evs]) => {
    const { graceMarks, hasGraceRecord } = resolveGraceMarks(
      projectId,
      evs[0].teamId,
      graceMarksByProjectId,
    );
    const averageScore = calculateAverageScore(evs.map((e) => e.finalScore));
    const finalTotalMarks = calculateFinalTotalMarks(averageScore, graceMarks);
    const lockedEvaluatorsCount = countLockedTeamEvaluations(evs);
    const allEvaluatorsLocked = canApplyGraceMarks(evs);
    const canEditGrace = canEditGraceMarks(evs, hasGraceRecord);
    const graceBlockReason = canEditGrace ? null : getGraceMarksBlockReason(evs);

    return {
      projectId,
      teamId: evs[0].teamId,
      teamLead: evs[0].teamLead,
      teamMembers: evs[0].teamMembers,
      problemId: evs[0].problemId,
      averageScore,
      graceMarks,
      finalTotalMarks,
      evaluatorsCount: evs.length,
      lockedEvaluatorsCount,
      allEvaluatorsLocked,
      canEditGraceMarks: canEditGrace,
      graceBlockReason,
      evaluations: evs,
      rank: 0,
    };
  });

  return aggregates
    .sort((a, b) => b.finalTotalMarks - a.finalTotalMarks)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function graceMarksMapFromDocs(
  docs: { id: string; data: () => Record<string, unknown> }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of docs) {
    const data = d.data();
    const raw = data.graceMarks;
    const grace = typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
    map.set(d.id, grace);
    if (typeof data.projectId === "string" && data.projectId) {
      map.set(data.projectId, grace);
    }
    if (typeof data.teamId === "string" && data.teamId) {
      map.set(teamGraceKey(data.teamId), grace);
    }
  }
  return map;
}

export function teamGraceKey(teamId: string): string {
  return `team:${teamId.trim().toUpperCase()}`;
}

export function resolveGraceMarks(
  projectId: string,
  teamId: string,
  graceMarksByProjectId: Map<string, number>,
): { graceMarks: number; hasGraceRecord: boolean } {
  if (graceMarksByProjectId.has(projectId)) {
    return {
      graceMarks: graceMarksByProjectId.get(projectId) ?? 0,
      hasGraceRecord: true,
    };
  }
  const teamKey = teamGraceKey(teamId);
  if (graceMarksByProjectId.has(teamKey)) {
    return {
      graceMarks: graceMarksByProjectId.get(teamKey) ?? 0,
      hasGraceRecord: true,
    };
  }
  return { graceMarks: 0, hasGraceRecord: false };
}
