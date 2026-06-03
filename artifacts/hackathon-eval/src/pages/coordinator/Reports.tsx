import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Evaluation } from "../../lib/types";
import { RUBRIC_SECTIONS } from "../../lib/rubric";
import {
  buildProjectAggregates,
  graceMarksMapFromDocs,
  type ProjectAggregate,
} from "../../lib/teamScores";
import jsPDF from "jspdf";

export default function Reports() {
  const [projects, setProjects] = useState<ProjectAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [evalSnap, scoreSnap] = await Promise.all([
          getDocs(collection(db, "evaluations")),
          getDocs(collection(db, "teamScores")),
        ]);
        const allEvals = evalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
        const graceMap = graceMarksMapFromDocs(scoreSnap.docs);

        setProjects(buildProjectAggregates(allEvals, graceMap));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addHeader = (pdf: jsPDF, title: string) => {
    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, 210, 28, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Hackathon Evaluation System — AI for a Sustainable Future 2026", 14, 11);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(title, 14, 20);
    pdf.setFontSize(8);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 140, 20);
    pdf.setTextColor(0, 0, 0);
    return 36;
  };

  const addFooter = (pdf: jsPDF) => {
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pages} — Hackathon 2026 Evaluation Report`, 14, 290);
    }
  };

  const generateFullReport = async () => {
    setGenerating("full");
    try {
      const pdf = new jsPDF({ format: "a4" });
      let y = addHeader(pdf, "Full Evaluation Report — All Projects");

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Total Projects: ${projects.length} | Total Evaluations: ${projects.reduce((a, b) => a + b.evaluatorsCount, 0)}`, 14, y);
      y += 10;

      // Rankings table
      pdf.setFillColor(240, 242, 248);
      pdf.rect(14, y, 182, 7, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("Rank", 16, y + 5);
      pdf.text("Team", 30, y + 5);
      pdf.text("Problem", 60, y + 5);
      pdf.text("Team Lead", 95, y + 5);
      pdf.text("Evaluators", 135, y + 5);
      pdf.text("Final Total", 165, y + 5);
      y += 9;

      pdf.setFont("helvetica", "normal");
      for (const p of projects) {
        if (y > 270) { pdf.addPage(); y = addHeader(pdf, "Full Evaluation Report (cont.)"); }
        const medal = p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `#${p.rank}`;
        pdf.text(medal, 16, y);
        pdf.text(p.teamId, 30, y);
        pdf.text(p.problemId.slice(0, 16), 60, y);
        pdf.text(p.teamLead.slice(0, 20), 95, y);
        pdf.text(String(p.evaluatorsCount), 138, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${p.finalTotalMarks.toFixed(2)}`, 165, y);
        pdf.setFont("helvetica", "normal");
        pdf.line(14, y + 2, 196, y + 2);
        y += 8;
      }

      // Per-project detail
      for (const p of projects) {
        pdf.addPage();
        y = addHeader(pdf, `Team ${p.teamId} — Detailed Evaluation`);

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Team ${p.teamId} | Problem: ${p.problemId}`, 14, y);
        y += 7;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Team Lead: ${p.teamLead}  |  Members: ${p.teamMembers || "—"}  |  Rank: #${p.rank}  |  Final: ${p.finalTotalMarks.toFixed(2)}/100 (avg ${p.averageScore.toFixed(2)}${p.graceMarks > 0 ? ` + grace ${p.graceMarks.toFixed(2)}` : ""})`, 14, y);
        y += 10;

        for (const ev of p.evaluations) {
          if (y > 250) { pdf.addPage(); y = addHeader(pdf, `Team ${p.teamId} — Evaluations (cont.)`); }
          pdf.setFillColor(235, 240, 255);
          pdf.rect(14, y - 3, 182, 7, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.text(`Evaluator: ${ev.evaluatorName}  |  Score: ${ev.finalScore}/100  |  Date: ${ev.date}`, 16, y + 1);
          y += 8;
          pdf.setFont("helvetica", "normal");
          for (const section of RUBRIC_SECTIONS) {
            if (y > 270) { pdf.addPage(); y = addHeader(pdf, `Team ${p.teamId} — Rubric (cont.)`); }
            const secScore = ev.sectionScores?.[section.id] ?? 0;
            pdf.setFont("helvetica", "bold");
            pdf.text(`  ${section.id}: ${section.name} (${section.weight} pts) — ${secScore.toFixed(2)}`, 14, y);
            y += 5;
            pdf.setFont("helvetica", "normal");
            for (const c of section.criteria) {
              const cs = ev.rubricScores?.[c.id] ?? 0;
              pdf.text(`    ${c.name}: ${cs}/5`, 14, y);
              y += 4;
            }
          }
          if (ev.remarks) {
            pdf.setFont("helvetica", "italic");
            pdf.text(`  Remarks: ${ev.remarks.slice(0, 120)}`, 14, y);
            y += 5;
          }
          y += 4;
        }
      }

      addFooter(pdf);
      pdf.save(`hackathon-2026-full-report-${Date.now()}.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  const generateTeamReport = async (p: ProjectAggregate) => {
    setGenerating(p.projectId);
    try {
      const pdf = new jsPDF({ format: "a4" });
      let y = addHeader(pdf, `Individual Team Report — Team ${p.teamId}`);

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Team ${p.teamId}`, 14, y);
      y += 8;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Problem ID: ${p.problemId}`, 14, y); y += 5;
      pdf.text(`Team Lead: ${p.teamLead}`, 14, y); y += 5;
      if (p.teamMembers) { pdf.text(`Team Members: ${p.teamMembers}`, 14, y); y += 5; }
      pdf.text(`Overall Rank: #${p.rank}  |  Final Total: ${p.finalTotalMarks.toFixed(2)}/100  |  Evaluators: ${p.evaluatorsCount}`, 14, y); y += 5;
      pdf.text(`Average: ${p.averageScore.toFixed(2)}${p.graceMarks > 0 ? `  |  Grace Marks: +${p.graceMarks.toFixed(2)}` : ""}`, 14, y); y += 12;

      // Section scores table
      pdf.setFillColor(240, 242, 248);
      pdf.rect(14, y, 182, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Section", 16, y + 5);
      pdf.text("Weight", 120, y + 5);
      pdf.text("Avg Score", 160, y + 5);
      y += 9;

      pdf.setFont("helvetica", "normal");
      for (const section of RUBRIC_SECTIONS) {
        const sectionAvg = p.evaluations.reduce((acc, ev) => acc + (ev.sectionScores?.[section.id] ?? 0), 0) / p.evaluatorsCount;
        pdf.text(`  ${section.id}: ${section.name}`, 14, y);
        pdf.text(`${section.weight} pts`, 120, y);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${sectionAvg.toFixed(2)}/${section.weight}`, 160, y);
        pdf.setFont("helvetica", "normal");
        pdf.line(14, y + 2, 196, y + 2);
        y += 7;
      }

      y += 6;
      pdf.setFont("helvetica", "bold");
      pdf.text(`Final Total Score: ${p.finalTotalMarks.toFixed(2)} / 100 (avg ${p.averageScore.toFixed(2)}${p.graceMarks > 0 ? ` + grace ${p.graceMarks.toFixed(2)}` : ""})`, 14, y);
      y += 10;

      // Per evaluator breakdown
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("Evaluator Scores:", 14, y);
      y += 6;

      for (const ev of p.evaluations) {
        if (y > 270) { pdf.addPage(); y = addHeader(pdf, `Team ${p.teamId} (cont.)`); }
        pdf.setFillColor(245, 247, 255);
        pdf.rect(14, y - 2, 182, 7, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(`${ev.evaluatorName}: ${ev.finalScore}/100`, 16, y + 2);
        y += 8;
        if (ev.remarks) {
          pdf.setFont("helvetica", "italic");
          pdf.text(`Remarks: ${ev.remarks.slice(0, 120)}`, 14, y);
          y += 5;
        }
      }

      addFooter(pdf);
      pdf.save(`hackathon-2026-team-${p.teamId}-report.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  const generateWinnersReport = async () => {
    setGenerating("winners");
    try {
      const pdf = new jsPDF({ format: "a4" });
      let y = addHeader(pdf, "Top 3 Winners Report");
      const top3 = projects.slice(0, 3);

      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("🏆 Hackathon 2026 Winners", 105, y, { align: "center" });
      y += 8;
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("AI for a Sustainable Future", 105, y, { align: "center" });
      y += 15;

      const medals = ["1st Place 🥇 — Champion", "2nd Place 🥈 — Runner-Up", "3rd Place 🥉 — Second Runner-Up"];
      const colors: [number, number, number][] = [[251, 191, 36], [156, 163, 175], [217, 119, 6]];

      for (let i = 0; i < top3.length; i++) {
        const p = top3[i];
        const [r, g, b] = colors[i];
        pdf.setFillColor(r, g, b);
        pdf.rect(14, y, 182, 1, "F");
        y += 5;
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text(medals[i], 14, y);
        y += 8;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Team: ${p.teamId}`, 14, y); y += 5;
        pdf.text(`Team Lead: ${p.teamLead}`, 14, y); y += 5;
        if (p.teamMembers) { pdf.text(`Members: ${p.teamMembers}`, 14, y); y += 5; }
        pdf.text(`Problem ID: ${p.problemId}`, 14, y); y += 5;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Final Score: ${p.finalTotalMarks.toFixed(2)} / 100`, 14, y);
        y += 5;
        if (p.graceMarks > 0) {
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.text(`(avg ${p.averageScore.toFixed(2)} + grace ${p.graceMarks.toFixed(2)})`, 14, y);
        }
        y += 5;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Based on ${p.evaluatorsCount} evaluator(s)`, 14, y);
        y += 12;
      }

      addFooter(pdf);
      pdf.save(`hackathon-2026-winners-report.pdf`);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">PDF Reports</h1>
        <p className="page-subtitle">Generate and download evaluation reports in PDF format.</p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : (
        <>
          {/* Bulk reports */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              {
                key: "full",
                title: "Full Evaluation Report",
                desc: "All projects, all evaluator scores, section-wise breakdown, and final rankings.",
                icon: "📊",
                action: generateFullReport,
              },
              {
                key: "winners",
                title: "Top 3 Winners Report",
                desc: "Certificate-style report for the top 3 winning teams.",
                icon: "🏆",
                action: generateWinnersReport,
              },
            ].map((r) => (
              <div key={r.key} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: "2rem" }}>{r.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "hsl(215 16% 47%)" }}>{r.desc}</div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={r.action}
                  disabled={generating !== null || projects.length === 0}
                  style={{ marginTop: "auto" }}
                >
                  {generating === r.key ? (
                    <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Generating...</>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Per-team reports */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Individual Team Reports</div>
              <div className="card-subtitle">Generate a detailed report for a specific team</div>
            </div>
            {projects.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
                <h3>No projects yet</h3>
                <p>Individual reports will appear once evaluations are submitted.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team</th>
                      <th>Problem</th>
                      <th>Score</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.projectId}>
                        <td>#{p.rank}</td>
                        <td style={{ fontWeight: 600 }}>{p.teamId}</td>
                        <td>{p.problemId}</td>
                        <td>
                          <span className={`score-pill ${p.finalTotalMarks >= 80 ? "score-high" : p.finalTotalMarks >= 60 ? "score-mid" : "score-low"}`}>
                            {p.finalTotalMarks.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => generateTeamReport(p)}
                            disabled={generating !== null}
                          >
                            {generating === p.projectId ? "..." : (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Download
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
