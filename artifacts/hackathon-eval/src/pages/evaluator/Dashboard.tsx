import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useLocation } from "wouter";
import type { Evaluation } from "../../lib/types";
import { getScoreColor } from "../../lib/rubric";

export default function EvaluatorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "evaluations"), where("evaluatorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setEvaluations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation)));
      setLoading(false);
    }, () => { setLoading(false); });
    return () => unsub();
  }, [user]);

  const unlockedEvals = evaluations.filter((e) => e.locked === false);
  const sorted = [...evaluations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Evaluator Dashboard</h1>
        <p className="page-subtitle">Welcome, {user?.name}. Review your evaluations and submit new ones.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{evaluations.length}</div>
          <div className="stat-label">Completed Evaluations</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {evaluations.length > 0
              ? (evaluations.reduce((a, b) => a + b.finalScore, 0) / evaluations.length).toFixed(1)
              : "—"}
          </div>
          <div className="stat-label">Average Score Given</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{new Set(evaluations.map((e) => e.projectId)).size}</div>
          <div className="stat-label">Projects Evaluated</div>
        </div>
        <div className="stat-card" style={{ borderColor: unlockedEvals.length > 0 ? "#fbbf24" : undefined }}>
          <div className="stat-value" style={{ color: unlockedEvals.length > 0 ? "#d97706" : undefined }}>
            {unlockedEvals.length}
          </div>
          <div className="stat-label">Unlocked for Editing</div>
        </div>
      </div>

      {/* Unlocked evaluations alert banner */}
      {unlockedEvals.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: "0.9rem", marginBottom: "0.25rem" }}>
              {unlockedEvals.length} evaluation{unlockedEvals.length > 1 ? "s" : ""} unlocked for editing
            </div>
            <div style={{ fontSize: "0.82rem", color: "#b45309" }}>
              A Coordinator has unlocked your marks for: <strong>{unlockedEvals.map(e => `Team ${e.teamId}`).join(", ")}</strong>. Click "Edit Marks" to update.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <button className="btn btn-primary" onClick={() => navigate("/evaluator/evaluate")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Evaluation
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Evaluation History</div>
          <div className="card-subtitle">All evaluations submitted by you</div>
        </div>
        {loading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : evaluations.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            <h3>No evaluations yet</h3>
            <p>Click "New Evaluation" to start evaluating a project.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Team ID</th>
                    <th>Problem ID</th>
                    <th>Team Lead</th>
                    <th>Venue</th>
                    <th>Date</th>
                    <th>Final Score</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((ev) => (
                    <tr key={ev.id} style={ev.locked === false ? { background: "#fffbeb" } : undefined}>
                      <td style={{ fontWeight: 600 }}>{ev.teamId}</td>
                      <td>{ev.problemId}</td>
                      <td>{ev.teamLead}</td>
                      <td style={{ color: "hsl(215 16% 47%)", fontSize: "0.85rem" }}>{ev.venue || "—"}</td>
                      <td>{ev.date}</td>
                      <td>
                        <span className={`score-pill ${getScoreColor(ev.finalScore)}`}>
                          {ev.finalScore}
                        </span>
                      </td>
                      <td>
                        {ev.locked === false ? (
                          <span className="badge badge-yellow" style={{ gap: "0.3rem" }}>
                            🔓 Unlocked
                          </span>
                        ) : (
                          <span className="badge badge-gray" style={{ gap: "0.3rem" }}>
                            🔒 Locked
                          </span>
                        )}
                      </td>
                      <td>
                        {ev.locked === false && ev.id ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/evaluator/evaluate/${ev.id}`)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit Marks
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "hsl(215 16% 47%)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-card-list">
              {sorted.map((ev) => (
                <div key={ev.id} className="mobile-card" style={ev.locked === false ? { borderColor: "#fbbf24", background: "#fffbeb" } : undefined}>
                  <div className="mobile-card-row">
                    <span style={{ fontWeight: 700 }}>Team: {ev.teamId}</span>
                    <span className={`score-pill ${getScoreColor(ev.finalScore)}`}>{ev.finalScore}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Problem: {ev.problemId}</span>
                    <span className="mobile-card-label">{ev.date}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Lead: {ev.teamLead}</span>
                    {ev.venue && <span className="mobile-card-label">Venue: {ev.venue}</span>}
                  </div>
                  <div className="mobile-card-row">
                    {ev.locked === false ? (
                      <span className="badge badge-yellow" style={{ fontSize: "0.65rem" }}>🔓 Unlocked</span>
                    ) : (
                      <span className="badge badge-gray" style={{ fontSize: "0.65rem" }}>🔒 Locked</span>
                    )}
                  </div>
                  {ev.locked === false && ev.id && (
                    <div className="mobile-card-row" style={{ marginTop: "0.25rem" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => navigate(`/evaluator/evaluate/${ev.id}`)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit Marks
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
