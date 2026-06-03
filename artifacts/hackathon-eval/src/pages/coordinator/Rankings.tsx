import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Evaluation } from "../../lib/types";
import { getRankMedal } from "../../lib/rubric";
import {
  buildProjectAggregates,
  graceMarksMapFromDocs,
  type ProjectAggregate,
} from "../../lib/teamScores";

export default function Rankings() {
  const [rankings, setRankings] = useState<ProjectAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Project Rankings</h1>
        <p className="page-subtitle">
          Projects ranked by final total (average evaluator score + grace marks).
        </p>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : rankings.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
            <h3>No rankings yet</h3>
            <p>Rankings will appear once evaluations are submitted.</p>
          </div>
        ) : (
          <>
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
                  {rankings.map((p) => (
                    <React.Fragment key={p.projectId}>
                      <tr className={p.rank <= 3 ? `rank-row-${p.rank}` : ""}>
                        <td>
                          <span
                            className={`rank-badge ${p.rank <= 3 ? `rank-${p.rank}` : ""}`}
                            style={p.rank > 3 ? { background: "hsl(var(--muted))", color: "hsl(var(--foreground))" } : undefined}
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
                              p.finalTotalMarks >= 80 ? "score-high" : p.finalTotalMarks >= 60 ? "score-mid" : "score-low"
                            }`}
                          >
                            {p.finalTotalMarks.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpandedId(expandedId === p.projectId ? null : p.projectId)}
                          >
                            {expandedId === p.projectId ? "Hide ▲" : "Show ▼"}
                          </button>
                        </td>
                      </tr>

                      {expandedId === p.projectId && (
                        <tr>
                          <td colSpan={9} style={{ padding: "0.75rem 1rem", background: "hsl(var(--muted))" }}>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                              Evaluator Breakdown:
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                              {p.evaluations.map((ev) => (
                                <div key={ev.id} style={{ display: "flex", gap: "1rem", fontSize: "0.82rem", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 600 }}>{ev.evaluatorName}</span>
                                  <span style={{ color: "hsl(215 16% 47%)" }}>
                                    Score: <strong>{ev.finalScore}</strong>
                                  </span>
                                  {ev.remarks && (
                                    <span style={{ color: "hsl(215 16% 47%)" }}>
                                      — {ev.remarks.slice(0, 60)}{ev.remarks.length > 60 ? "…" : ""}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
                              <span>Average: <strong>{p.averageScore.toFixed(2)}</strong></span>
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
              {rankings.map((p) => (
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
                        p.finalTotalMarks >= 80 ? "score-high" : p.finalTotalMarks >= 60 ? "score-mid" : "score-low"
                      }`}
                    >
                      {p.finalTotalMarks.toFixed(2)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">
                      Avg {p.averageScore.toFixed(2)}
                      {p.graceMarks > 0 ? ` · Grace +${p.graceMarks.toFixed(2)}` : ""}
                    </span>
                    <span className="mobile-card-label">{p.evaluatorsCount} evaluator(s)</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
