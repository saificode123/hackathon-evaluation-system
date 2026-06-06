import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Evaluation } from "../../lib/types";
import { getRankMedal } from "../../lib/rubric";
import {
  buildProjectAggregates,
  graceMarksMapFromDocs,
  type ProjectAggregate,
} from "../../lib/teamScores";
import jsPDF from "jspdf";

const TROPHIES = ["🥇", "🥈", "🥉"];
const RANK_LABELS = ["1st Place — Champion", "2nd Place — Runner-Up", "3rd Place — Second Runner-Up"];
const CARD_CLASSES = ["winner-1", "winner-2", "winner-3"];
const DEFAULT_TOP_COUNT = 20;

type WinnersTab = "top3" | "top20";

function addPdfHeader(pdf: jsPDF, title: string): number {
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
}

function addPdfFooter(pdf: jsPDF) {
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${pages} — Hackathon 2026 Leaderboard Report`, 14, 290);
  }
}

function exportTopLeaderboardPdf(teams: ProjectAggregate[], topCount: number) {
  const pdf = new jsPDF({ format: "a4" });
  let y = addPdfHeader(pdf, `Top ${topCount} Teams Leaderboard`);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Showing top ${teams.length} team${teams.length !== 1 ? "s" : ""} by final total score`, 14, y);
  y += 10;

  pdf.setFillColor(240, 242, 248);
  pdf.rect(14, y, 182, 7, "F");
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("Rank", 16, y + 5);
  pdf.text("Team", 28, y + 5);
  pdf.text("Problem", 48, y + 5);
  pdf.text("Team Lead", 68, y + 5);
  pdf.text("Eval.", 118, y + 5);
  pdf.text("Avg", 132, y + 5);
  pdf.text("Grace", 148, y + 5);
  pdf.text("Final", 168, y + 5);
  y += 10;

  pdf.setFont("helvetica", "normal");
  for (const p of teams) {
    if (y > 270) {
      pdf.addPage();
      y = addPdfHeader(pdf, `Top ${topCount} Teams Leaderboard (cont.)`);
      y += 6;
    }
    const medal = p.rank <= 3 ? getRankMedal(p.rank) : `#${p.rank}`;
    pdf.text(medal, 16, y);
    pdf.text(p.teamId, 28, y);
    pdf.text(p.problemId.slice(0, 10), 48, y);
    pdf.text(p.teamLead.slice(0, 22), 68, y);
    pdf.text(String(p.evaluatorsCount), 120, y);
    pdf.text(p.averageScore.toFixed(2), 132, y);
    pdf.text(p.graceMarks > 0 ? `+${p.graceMarks.toFixed(2)}` : "—", 148, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(p.finalTotalMarks.toFixed(2), 168, y);
    pdf.setFont("helvetica", "normal");
    pdf.line(14, y + 2, 196, y + 2);
    y += 7;
  }

  addPdfFooter(pdf);
  pdf.save(`hackathon-2026-top-${topCount}-leaderboard.pdf`);
}

function TopLeaderboardTable({ teams, topCount }: { teams: ProjectAggregate[]; topCount: number }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (teams.length === 0) {
    return (
      <div className="empty-state">
        <h3>No teams ranked yet</h3>
        <p>The leaderboard will populate once projects have evaluations.</p>
      </div>
    );
  }

  return (
    <>
      <div className="leaderboard-meta">
        <span className="badge badge-blue">Top {Math.min(topCount, teams.length)}</span>
        <span style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)" }}>
          Sorted by final total (evaluator average + grace marks)
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team ID</th>
              <th>Problem</th>
              <th>Team Lead</th>
              <th>Evaluators</th>
              <th>Avg</th>
              <th>Grace</th>
              <th>Final Total</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((p) => (
              <React.Fragment key={p.projectId}>
                <tr className={p.rank <= 3 ? `rank-row-${p.rank}` : ""}>
                  <td>
                    <span
                      className={`rank-badge ${p.rank <= 3 ? `rank-${p.rank}` : ""}`}
                      style={
                        p.rank > 3
                          ? { background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }
                          : undefined
                      }
                    >
                      {p.rank <= 3 ? getRankMedal(p.rank) : `#${p.rank}`}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.teamId}</td>
                  <td>{p.problemId}</td>
                  <td>{p.teamLead}</td>
                  <td>
                    <span className="badge badge-gray">
                      {p.evaluatorsCount} evaluator{p.evaluatorsCount !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)" }}>
                    {p.averageScore.toFixed(2)}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {p.graceMarks > 0 ? `+${p.graceMarks.toFixed(2)}` : "—"}
                  </td>
                  <td>
                    <span
                      className={`score-pill ${
                        p.finalTotalMarks >= 80
                          ? "score-high"
                          : p.finalTotalMarks >= 60
                            ? "score-mid"
                            : "score-low"
                      }`}
                    >
                      {p.finalTotalMarks.toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setExpandedId(expandedId === p.projectId ? null : p.projectId)
                      }
                    >
                      {expandedId === p.projectId ? "Hide ▲" : "Show ▼"}
                    </button>
                  </td>
                </tr>
                {expandedId === p.projectId && (
                  <tr>
                    <td colSpan={9} className="leaderboard-detail-cell">
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                        Evaluator Breakdown
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {p.evaluations.map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              display: "flex",
                              gap: "1rem",
                              fontSize: "0.82rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{ev.evaluatorName}</span>
                            <span style={{ color: "hsl(215 16% 47%)" }}>
                              Score: <strong>{ev.finalScore}</strong>
                            </span>
                            {ev.remarks && (
                              <span style={{ color: "hsl(215 16% 47%)" }}>
                                — {ev.remarks.slice(0, 60)}
                                {ev.remarks.length > 60 ? "…" : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
                        <span>
                          Average: <strong>{p.averageScore.toFixed(2)}</strong>
                        </span>
                        {p.graceMarks > 0 && (
                          <span style={{ marginLeft: "1rem" }}>
                            Grace: <strong>+{p.graceMarks.toFixed(2)}</strong>
                          </span>
                        )}
                        <span style={{ marginLeft: "1rem", fontWeight: 700 }}>
                          Final: {p.finalTotalMarks.toFixed(2)}/100
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list">
        {teams.map((p) => (
          <div key={p.projectId} className="mobile-card">
            <div className="mobile-card-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  className={`rank-badge ${p.rank <= 3 ? `rank-${p.rank}` : ""}`}
                  style={
                    p.rank > 3
                      ? {
                          background: "hsl(var(--muted))",
                          color: "hsl(var(--foreground))",
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "0.8rem",
                        }
                      : undefined
                  }
                >
                  {p.rank <= 3 ? getRankMedal(p.rank) : `#${p.rank}`}
                </span>
                <span style={{ fontWeight: 700 }}>{p.teamId}</span>
              </div>
              <span
                className={`score-pill ${
                  p.finalTotalMarks >= 80
                    ? "score-high"
                    : p.finalTotalMarks >= 60
                      ? "score-mid"
                      : "score-low"
                }`}
              >
                {p.finalTotalMarks.toFixed(2)}
              </span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label">
                {p.teamLead} · {p.problemId}
              </span>
            </div>
            <div className="mobile-card-row">
              <span className="mobile-card-label">
                Avg {p.averageScore.toFixed(2)}
                {p.graceMarks > 0 ? ` · Grace +${p.graceMarks.toFixed(2)}` : ""}
              </span>
              <span className="mobile-card-label">
                {p.evaluatorsCount} evaluator{p.evaluatorsCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Winners() {
  const [rankings, setRankings] = useState<ProjectAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WinnersTab>("top3");
  const [topCountInput, setTopCountInput] = useState(String(DEFAULT_TOP_COUNT));
  const [appliedTopCount, setAppliedTopCount] = useState(DEFAULT_TOP_COUNT);
  const [topCountError, setTopCountError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [evalSnap, scoreSnap] = await Promise.all([
          getDocs(collection(db, "evaluations")),
          getDocs(collection(db, "teamScores")),
        ]);
        const allEvals = evalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
        const graceMap = graceMarksMapFromDocs(scoreSnap.docs);
        setRankings(buildProjectAggregates(allEvals, graceMap));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const top3 = useMemo(() => rankings.slice(0, 3), [rankings]);
  const topLeaderboard = useMemo(
    () => rankings.slice(0, appliedTopCount),
    [rankings, appliedTopCount],
  );

  const handleApplyTopCount = () => {
    const parsed = Number(topCountInput.trim());
    if (!Number.isInteger(parsed) || parsed < 1) {
      setTopCountError("Enter a whole number of at least 1.");
      return;
    }
    setTopCountError("");
    const effective = rankings.length > 0 ? Math.min(parsed, rankings.length) : parsed;
    setAppliedTopCount(effective);
    if (effective !== parsed && rankings.length > 0) {
      setTopCountInput(String(effective));
    }
  };

  const handleDownloadLeaderboardPdf = async () => {
    if (topLeaderboard.length === 0) return;
    setExportingPdf(true);
    try {
      exportTopLeaderboardPdf(topLeaderboard, appliedTopCount);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Winners & Leaderboard</h1>
        <p className="page-subtitle">
          Hackathon 2026 — Top 3 winners and customizable top teams leaderboard
        </p>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Winners views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "top3"}
          className={`page-tab ${activeTab === "top3" ? "active" : ""}`}
          onClick={() => setActiveTab("top3")}
        >
          Top 3 Winners
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "top20"}
          className={`page-tab ${activeTab === "top20" ? "active" : ""}`}
          onClick={() => setActiveTab("top20")}
        >
          Top Teams Leaderboard
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : rankings.length === 0 ? (
        <div className="empty-state" style={{ padding: "4rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏆</div>
          <h3>No rankings yet</h3>
          <p>Winners and the leaderboard will appear once projects have been evaluated.</p>
        </div>
      ) : activeTab === "top3" ? (
        top3.length === 0 ? (
          <div className="empty-state" style={{ padding: "4rem 1rem" }}>
            <h3>No winners yet</h3>
            <p>Winners will appear once projects have been evaluated.</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "hsl(215 16% 47%)",
                  marginBottom: "0.5rem",
                }}
              >
                Hackathon 2026 Results
              </div>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.25rem" }}>
                Congratulations to our Winners!
              </h2>
              <p style={{ color: "hsl(215 16% 47%)" }}>
                AI for a Sustainable Future — Final Rankings
              </p>
            </div>

            <div className="winners-grid">
              {top3.map((w, i) => (
                <div key={w.projectId} className={`winner-card ${CARD_CLASSES[i]}`}>
                  <div className="winner-trophy">{TROPHIES[i]}</div>
                  <div className="winner-rank">{RANK_LABELS[i]}</div>
                  <div className="winner-team">Team {w.teamId}</div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "hsl(215 16% 47%)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {w.teamLead}
                    {w.teamMembers && (
                      <div style={{ fontSize: "0.75rem", marginTop: 2 }}>{w.teamMembers}</div>
                    )}
                  </div>
                  <div className="winner-score">{w.finalTotalMarks.toFixed(2)}</div>
                  <div className="winner-score-label">
                    final total (avg {w.averageScore.toFixed(2)}
                    {w.graceMarks > 0 ? ` + ${w.graceMarks.toFixed(2)} grace` : ""})
                  </div>
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.5rem",
                      background: "rgba(0,0,0,0.05)",
                      borderRadius: 8,
                      fontSize: "0.78rem",
                    }}
                  >
                    Problem: <strong>{w.problemId}</strong>
                    <br />
                    Evaluated by <strong>{w.evaluatorsCount}</strong> evaluator
                    {w.evaluatorsCount !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: "2rem", textAlign: "center", padding: "2rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.5rem" }}>
                Official Results Summary
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {top3.map((w, i) => (
                  <div
                    key={w.projectId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      background: "hsl(var(--muted))",
                      borderRadius: 8,
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ fontSize: "1.25rem" }}>{TROPHIES[i]}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 700 }}>Team {w.teamId}</div>
                        <div style={{ fontSize: "0.78rem", color: "hsl(215 16% 47%)" }}>
                          {w.teamLead} | Problem: {w.problemId}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "hsl(221 83% 53%)" }}>
                      {w.finalTotalMarks.toFixed(2)}/100
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top {appliedTopCount} Teams</div>
              <div className="card-subtitle">
                Highest-ranked teams by final total score across all evaluations
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              alignItems: "flex-end",
              marginBottom: "1.25rem",
              padding: "0 0 0.25rem",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label className="form-label">Number of top teams</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={Math.max(rankings.length, 1)}
                value={topCountInput}
                onChange={(e) => {
                  setTopCountInput(e.target.value);
                  setTopCountError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyTopCount();
                  }
                }}
                placeholder="e.g. 15"
                style={{ width: 120 }}
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleApplyTopCount}>
              Generate Leaderboard
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadLeaderboardPdf}
              disabled={exportingPdf || topLeaderboard.length === 0}
            >
              {exportingPdf ? "Generating…" : "Download PDF"}
            </button>
          </div>

          {topCountError && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{topCountError}</div>
          )}

          <TopLeaderboardTable teams={topLeaderboard} topCount={appliedTopCount} />
        </div>
      )}
    </div>
  );
}
