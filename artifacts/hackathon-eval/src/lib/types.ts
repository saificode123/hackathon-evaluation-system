export type Role = "admin" | "evaluator" | "coordinator";

/** Global hackathon config (`settings/hackathon` in Firestore). */
export interface HackathonSettings {
  totalTeams: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
  disabled?: boolean;
}

export interface Project {
  id?: string;
  teamId: string;
  problemId: string;
  teamLead: string;
  venue: string;
  date: string;
  createdAt: string;
}

export interface RubricScores {
  [criterionId: string]: number;
}

export interface Evaluation {
  id?: string;
  projectId: string;
  teamId: string;
  problemId: string;
  teamLead: string;
  teamMembers?: string;
  venue: string;
  date: string;
  evaluatorId: string;
  evaluatorName: string;
  rubricScores: RubricScores;
  sectionScores: { [sectionId: string]: number };
  finalScore: number;
  remarks: string;
  submittedAt: string;
  locked?: boolean;
}

/** Aggregated team score document (`teamScores` collection, doc id = projectId). */
export interface TeamScore {
  projectId: string;
  teamId: string;
  graceMarks: number;
  updatedAt?: string;
}

export interface Result {
  projectId: string;
  teamId: string;
  teamLead: string;
  averageScore: number;
  graceMarks?: number;
  finalTotalMarks?: number;
  rank: number;
  evaluatorsCount: number;
  evaluations: Evaluation[];
}

export interface SectionDef {
  id: string;
  name: string;
  weight: number;
  criteria: CriterionDef[];
}

export interface CriterionDef {
  id: string;
  name: string;
  /** Maximum points this criterion contributes (out of 5 raw score). */
  weight: number;
  /** Per-score descriptions from the official evaluator form (1–5). */
  scoreGuides?: Record<number, string>;
}
