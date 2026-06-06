import type { SectionDef, RubricScores } from "./types";

/** Hackathon 2026 — evaluator scoring rubric (5 criteria, 100 pts total). */
export const RUBRIC_SECTIONS: SectionDef[] = [
  {
    id: "R",
    name: "Evaluation Criteria",
    weight: 100,
    criteria: [
      {
        id: "C1",
        name: "Solution Relevance & Effectiveness",
        weight: 20,
        scoreGuides: {
          1: "Does not address the problem statement.",
          2: "Addresses only a limited portion of requirements.",
          3: "Addresses the main requirements.",
          4: "Effectively addresses the problem with practical applicability.",
          5: "Comprehensively addresses the problem; strong real-world adoption potential.",
        },
      },
      {
        id: "C2",
        name: "Innovation & Differentiation",
        weight: 20,
        scoreGuides: {
          1: "Closely resembles existing approaches; little originality.",
          2: "Limited innovation beyond common approaches.",
          3: "Some innovative features or ideas demonstrated.",
          4: "Clearly differentiated and creative approach.",
          5: "Exceptional innovation; unique and compelling value proposition.",
        },
      },
      {
        id: "C3",
        name: "Technical Implementation",
        weight: 30,
        scoreGuides: {
          1: "Prototype is incomplete, non-functional, or fails during demo.",
          2: "Limited functionality; major features missing or unreliable.",
          3: "Core features functional; workable solution demonstrated.",
          4: "Most features fully functional; stable and technically sound.",
          5: "Robust, well-integrated; exceptional technical quality and completeness.",
        },
      },
      {
        id: "C4",
        name: "Validation & Reliability",
        weight: 15,
        scoreGuides: {
          1: "Little or no evidence of testing; functionality unverified.",
          2: "Basic testing on a limited set of features.",
          3: "Core functionality tested; key features work correctly.",
          4: "Multiple features tested; systematic validation evidenced.",
          5: "Comprehensive testing including edge cases and reliability.",
        },
      },
      {
        id: "C5",
        name: "Feasibility & Scalability",
        weight: 15,
        scoreGuides: {
          1: "Significant barriers make implementation unlikely.",
          2: "Shows potential but faces major deployment challenges.",
          3: "Reasonably feasible; requires further development.",
          4: "Practical and implementable; clear adoption potential.",
          5: "Highly practical and scalable; strong real-world deployment potential.",
        },
      },
    ],
  },
];

export const ALL_CRITERIA = RUBRIC_SECTIONS.flatMap((s) => s.criteria);
export const TOTAL_CRITERIA = ALL_CRITERIA.length;

export function calculateSectionScores(
  rubricScores: RubricScores,
): Record<string, number> {
  const sectionScores: Record<string, number> = {};
  for (const section of RUBRIC_SECTIONS) {
    let sectionTotal = 0;
    for (const c of section.criteria) {
      const score = rubricScores[c.id] ?? 0;
      sectionTotal += (score / 5) * c.weight;
    }
    sectionScores[section.id] = Math.round(sectionTotal * 100) / 100;
  }
  return sectionScores;
}

export function calculateFinalScore(rubricScores: RubricScores): number {
  let total = 0;
  for (const section of RUBRIC_SECTIONS) {
    for (const c of section.criteria) {
      const score = rubricScores[c.id] ?? 0;
      total += (score / 5) * c.weight;
    }
  }
  return Math.round(total * 100) / 100;
}

export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

export function isEvaluationComplete(rubricScores: RubricScores): boolean {
  return ALL_CRITERIA.every((c) => (rubricScores[c.id] ?? 0) > 0);
}

export const SCORE_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: "Poor", desc: "Does not meet expectations for this criterion" },
  2: { label: "Below Average", desc: "Limited or incomplete coverage of this criterion" },
  3: { label: "Satisfactory", desc: "Meets basic expectations for this criterion" },
  4: { label: "Good", desc: "Strong performance with practical applicability" },
  5: { label: "Excellent", desc: "Outstanding performance; exceeds expectations" },
};

/** Display order: Excellent (5) first, Poor (1) last. */
export const RUBRIC_SCORE_OPTIONS = [5, 4, 3, 2, 1] as const;

export function formatRubricOption(score: number, description: string): string {
  return `${score} (${SCORE_LABELS[score].label}) - ${description}`;
}

export function criterionPoints(score: number, weight: number): number {
  return Math.round((score / 5) * weight * 100) / 100;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "score-high";
  if (score >= 60) return "score-mid";
  return "score-low";
}

export function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}
