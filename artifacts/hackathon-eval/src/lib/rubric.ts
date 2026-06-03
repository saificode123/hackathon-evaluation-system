import type { SectionDef, RubricScores } from "./types";

/** Hackathon 2026 — official evaluator scoring form (sections A–G, 100 pts total). */
export const RUBRIC_SECTIONS: SectionDef[] = [
  {
    id: "A",
    name: "Problem Understanding & Solution Alignment",
    weight: 25,
    criteria: [
      {
        id: "A1",
        name: "Problem Understanding",
        weight: 5,
        scoreGuides: {
          1: "The problem is not explained. It is unclear what the team is trying to solve.",
          2: "The problem is mentioned but it is hard to understand what it really is.",
          3: "The problem is explained but some parts are vague or missing.",
          4: "The problem is explained clearly. Most important details are covered.",
          5: "The problem is explained very clearly. Anyone listening can understand exactly what is being solved and why it matters.",
        },
      },
      {
        id: "A2",
        name: "Solution–Problem Fit",
        weight: 5,
        scoreGuides: {
          1: "The solution has no clear connection to the problem stated.",
          2: "The solution is loosely related to the problem but does not really address it.",
          3: "The solution addresses the problem but not completely.",
          4: "The solution clearly addresses the problem. The connection is easy to follow.",
          5: "The solution directly and completely addresses the problem. The team explains the connection well.",
        },
      },
      {
        id: "A3",
        name: "Who Benefits",
        weight: 5,
        scoreGuides: {
          1: "No mention of who will use or benefit from this solution.",
          2: "A general group is mentioned but it is vague (e.g., ‘everyone’ or ‘people’).",
          3: "A specific group is named but their need is not clearly described.",
          4: "A specific group is named and their need is described.",
          5: "A specific group is named, their need is clearly described, and the team explains how the solution helps them.",
        },
      },
      {
        id: "A4",
        name: "Scope vs. Reality",
        weight: 10,
        scoreGuides: {
          1: "Very little of what was claimed in the presentation is actually working.",
          2: "Some features are shown working but most of what was claimed is missing.",
          3: "About half of the claimed features are working and demonstrated.",
          4: "Most of the claimed features are working and demonstrated.",
          5: "Everything claimed in the presentation is working and clearly shown in the demo.",
        },
      },
    ],
  },
  {
    id: "B",
    name: "Solution Design & Innovation",
    weight: 20,
    criteria: [
      {
        id: "B1",
        name: "Originality",
        weight: 5,
        scoreGuides: {
          1: "The solution is entirely copied or generic with no original thinking.",
          2: "There is very little original thinking. The solution is mostly standard.",
          3: "Some original thinking is present but the solution is mostly conventional.",
          4: "The solution shows clear original thinking. The team made deliberate design choices.",
          5: "The solution is creative and clearly original. The team went beyond obvious or standard approaches.",
        },
      },
      {
        id: "B2",
        name: "Right Tool for the Job",
        weight: 5,
        scoreGuides: {
          1: "The technology or approach used does not match the problem at all.",
          2: "The technology used is not well suited to the problem. No reason is given.",
          3: "The technology is a reasonable choice but the team cannot explain why they picked it.",
          4: "The technology is a good fit and the team gives a basic reason for choosing it.",
          5: "The technology is clearly the right fit for the problem and the team explains why it was chosen over other options.",
        },
      },
      {
        id: "B3",
        name: "Technical Depth",
        weight: 5,
        scoreGuides: {
          1: "The solution is extremely basic with almost no technical work done.",
          2: "Very little technical work is evident. The solution feels like a rough idea.",
          3: "Some technical work is done but the implementation feels incomplete.",
          4: "Good technical work is done. The solution is well built.",
          5: "Strong technical work is evident throughout. The solution is well designed and built with care.",
        },
      },
      {
        id: "B4",
        name: "Future Plan",
        weight: 5,
        scoreGuides: {
          1: "No future plan is mentioned.",
          2: "A future plan is mentioned but it is very vague with no details.",
          3: "Some next steps are mentioned but they are not well explained.",
          4: "Clear next steps are described with a basic reason for each.",
          5: "A well-thought-out future plan is presented with clear next steps, reasons, and timelines.",
        },
      },
    ],
  },
  {
    id: "C",
    name: "Technical Implementation Quality",
    weight: 20,
    criteria: [
      {
        id: "C1",
        name: "Does It Work",
        weight: 10,
        scoreGuides: {
          1: "The software does not run or crashes immediately.",
          2: "The software runs but fails on most features during the demo.",
          3: "The software works for some features but has noticeable bugs or failures.",
          4: "The software works well. Most features run without problems.",
          5: "The software runs smoothly throughout the demo. All core features work as expected.",
        },
      },
      {
        id: "C2",
        name: "Code Quality",
        weight: 5,
        scoreGuides: {
          1: "The code is very messy and hard to read. There is no structure.",
          2: "The code is difficult to follow. Very little organisation is visible.",
          3: "The code works but is not well organised. Some parts are hard to read.",
          4: "The code is reasonably well organised and readable.",
          5: "The code is clean, well organised, and easy to read. Another developer could understand it without help.",
        },
      },
      {
        id: "C3",
        name: "Documentation",
        weight: 5,
        scoreGuides: {
          1: "No documentation is provided.",
          2: "Very little documentation is provided. It is hard to know how to set up or use the software.",
          3: "Some documentation exists but it is incomplete or unclear.",
          4: "Documentation is provided and covers the main points.",
          5: "Documentation is thorough and clear. It covers setup, usage, and how the system works.",
        },
      },
    ],
  },
  {
    id: "D",
    name: "Real-World Impact & Measurable Outcomes",
    weight: 10,
    criteria: [
      {
        id: "D1",
        name: "Real-World Value",
        weight: 5,
        scoreGuides: {
          1: "The solution has no clear real-world use.",
          2: "A real-world use is mentioned but it is hard to see how it would actually work.",
          3: "The real-world use is clear but the actual benefit is vague.",
          4: "The real-world use is clear and the benefit to users is well described.",
          5: "The solution clearly solves a real problem. The team explains the tangible difference it would make for real users.",
        },
      },
      {
        id: "D2",
        name: "Measuring Success",
        weight: 5,
        scoreGuides: {
          1: "No way of measuring success is mentioned.",
          2: "Success is mentioned in vague terms (e.g., ‘more people will use it’).",
          3: "Some success measures are mentioned but they are not specific.",
          4: "Clear success measures are given with numbers or targets.",
          5: "Clear and specific success measures are given with targets and timeframes (e.g., ‘reduce processing time by 40% in 6 months’).",
        },
      },
    ],
  },
  {
    id: "E",
    name: "Ethics & Responsible Use",
    weight: 5,
    criteria: [
      {
        id: "E1",
        name: "Fairness & Bias",
        weight: 2.5,
        scoreGuides: {
          1: "No mention of fairness or bias at all.",
          2: "Fairness is briefly mentioned but nothing specific is said.",
          3: "A potential fairness issue is identified but no solution is given.",
          4: "A fairness issue is identified and a basic step to address it is mentioned.",
          5: "A specific fairness issue is identified and the team explains clearly how they are addressing it.",
        },
      },
      {
        id: "E2",
        name: "Privacy & Safety",
        weight: 2.5,
        scoreGuides: {
          1: "No mention of user privacy or safety at all.",
          2: "Privacy or safety is briefly mentioned but nothing specific is said.",
          3: "A privacy or safety risk is identified but no solution is given.",
          4: "A privacy or safety risk is identified and a basic step to address it is mentioned.",
          5: "A specific privacy or safety risk is identified and the team explains clearly how they are handling it.",
        },
      },
    ],
  },
  {
    id: "F",
    name: "Deployment Readiness",
    weight: 5,
    criteria: [
      {
        id: "F1",
        name: "Deployment Plan",
        weight: 2.5,
        scoreGuides: {
          1: "No plan for how this software would be deployed or released.",
          2: "Deployment is mentioned but with no real plan.",
          3: "A basic deployment plan is described but it is missing key details.",
          4: "A reasonable deployment plan is described with most key details covered.",
          5: "A clear and practical deployment plan is described including where it will be hosted, how it will be released, and what it will cost.",
        },
      },
      {
        id: "F2",
        name: "Cost & Resources",
        weight: 2.5,
        scoreGuides: {
          1: "No mention of cost or resources needed to run the software.",
          2: "Cost or resources are briefly mentioned with no real detail.",
          3: "Some cost or resource information is given but it is incomplete.",
          4: "A reasonable estimate of cost and resources is given.",
          5: "A clear and realistic breakdown of costs and resources is given, showing the team has thought this through.",
        },
      },
    ],
  },
  {
    id: "G",
    name: "Presentation & Communication",
    weight: 15,
    criteria: [
      {
        id: "G1",
        name: "Clarity of Presentation",
        weight: 5,
        scoreGuides: {
          1: "The presentation is very hard to follow. The evaluator cannot understand what is being presented.",
          2: "Some parts are understandable but the presentation is mostly unclear or disorganised.",
          3: "The presentation is understandable but some parts are confusing.",
          4: "The presentation is clear and easy to follow throughout.",
          5: "The presentation is very clear, well organised, and easy to follow from start to finish.",
        },
      },
      {
        id: "G2",
        name: "Demo Quality",
        weight: 5,
        scoreGuides: {
          1: "No demo is shown or the software does not run during the demo.",
          2: "A demo is attempted but it fails or shows very little.",
          3: "The demo works but does not show the key features of the software clearly.",
          4: "The demo works well and shows the main features clearly.",
          5: "The demo is smooth, well prepared, and clearly shows what the software does and how it works.",
        },
      },
      {
        id: "G3",
        name: "Future Vision",
        weight: 5,
        scoreGuides: {
          1: "No mention of future plans or where this project is going.",
          2: "Future plans are mentioned very briefly with no real detail.",
          3: "Some future plans are described but without specific milestones or timelines.",
          4: "Future plans are described with some milestones or timelines.",
          5: "A clear and realistic future vision is presented with specific milestones and timelines.",
        },
      },
    ],
  },
];

export const ALL_CRITERIA = RUBRIC_SECTIONS.flatMap((s) => s.criteria);
export const TOTAL_CRITERIA = ALL_CRITERIA.length;

export function calculateSectionScores(
  rubricScores: RubricScores
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
  1: { label: "Not Done", desc: "Nothing meaningful was presented for this criterion" },
  2: { label: "Weak", desc: "An attempt was made but a lot is missing or unclear" },
  3: { label: "Average", desc: "The basics are covered. Some parts are incomplete" },
  4: { label: "Good", desc: "Most aspects are covered well. Only small things are missing" },
  5: { label: "Outstanding", desc: "All aspects are covered fully. Nothing is missing" },
};

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
