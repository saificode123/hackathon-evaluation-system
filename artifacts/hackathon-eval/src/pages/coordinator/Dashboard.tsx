import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useLocation } from "wouter";
import type { Evaluation } from "../../lib/types";
import { calculateAverageScore } from "../../lib/rubric";
import { countEvaluatedTeams, getEffectiveTotalTeams, subscribeHackathonSettings } from "../../lib/settings";
import { subscribeUploadedTeamsCount } from "../../lib/adminUpload";
import TeamEvaluationProgress from "../../components/TeamEvaluationProgress";

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [settingsTotalTeams, setSettingsTotalTeams] = useState(0);
  const [uploadedTeamsCount, setUploadedTeamsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSettings = subscribeHackathonSettings((settings) => {
      setSettingsTotalTeams(settings.totalTeams);
    });

    const unsubTeams = subscribeUploadedTeamsCount(setUploadedTeamsCount);

    const unsubEvals = onSnapshot(collection(db, "evaluations"), (snap) => {
      setEvaluations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation)));
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubSettings();
      unsubTeams();
      unsubEvals();
    };
  }, []);

  const totalTeams = getEffectiveTotalTeams(uploadedTeamsCount, settingsTotalTeams);

  const evaluatedTeams = countEvaluatedTeams(evaluations);

  const projectMap = new Map<string, Evaluation[]>();
  for (const ev of evaluations) {
    if (!projectMap.has(ev.projectId)) projectMap.set(ev.projectId, []);
    projectMap.get(ev.projectId)!.push(ev);
  }
  const projects = [...projectMap.entries()];
  const avgScores = projects.map(([, evs]) => calculateAverageScore(evs.map((e) => e.finalScore)));
  const topScore = avgScores.length > 0 ? Math.max(...avgScores) : 0;
  const overallAvg = avgScores.length > 0 ? (avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(1) : "—";
  const evaluatorIds = new Set(evaluations.map((e) => e.evaluatorId));

  const quickActions = [
    { label: "All Evaluations", desc: "View and edit submitted evaluations", path: "/coordinator/evaluations", color: "hsl(221 83% 53%)" },
    { label: "Rankings", desc: "Projects ranked by final total score", path: "/coordinator/rankings", color: "#10b981" },
    { label: "Grace Marks", desc: "Add grace marks after all evaluators lock", path: "/coordinator/grace-marks", color: "#ec4899" },
    { label: "Winners & Leaderboard", desc: "Top 3 winners and customizable top teams leaderboard", path: "/coordinator/winners", color: "#f59e0b" },
    { label: "PDF Reports", desc: "Export evaluation reports", path: "/coordinator/reports", color: "#6366f1" },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Coordinator Dashboard</h1>
        <p className="page-subtitle">Welcome, {user?.name}. Manage evaluations, rankings, and reports.</p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: "1.25rem", borderLeft: "4px solid hsl(221 83% 53%)" }}>
            <div className="card-header">
              <div className="card-title">Team Evaluation Status</div>
              <div className="card-subtitle">
                How many teams still need evaluations in the hackathon
              </div>
            </div>
            <TeamEvaluationProgress
              totalTeams={totalTeams}
              evaluatedTeams={evaluatedTeams}
              showUnsetHint
            />
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{evaluations.length}</div>
              <div className="stat-label">Total Evaluations</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{evaluatedTeams}</div>
              <div className="stat-label">Teams Evaluated</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalTeams > 0 ? Math.max(0, totalTeams - evaluatedTeams) : "—"}</div>
              <div className="stat-label">Teams Remaining</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{evaluatorIds.size}</div>
              <div className="stat-label">Active Evaluators</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{overallAvg}</div>
              <div className="stat-label">Overall Average Score</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{topScore.toFixed(1)}</div>
              <div className="stat-label">Highest Score</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {quickActions.map((action) => (
              <div
                key={action.path}
                className="card"
                style={{ cursor: "pointer", borderLeft: `4px solid ${action.color}` }}
                onClick={() => navigate(action.path)}
              >
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>{action.label}</div>
                <div style={{ fontSize: "0.8rem", color: "hsl(215 16% 47%)" }}>{action.desc}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Evaluations</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/coordinator/evaluations")}>View all →</button>
            </div>
            {evaluations.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
                <h3>No evaluations submitted yet</h3>
                <p>Evaluators need to submit evaluations for projects.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Problem</th>
                      <th>Evaluator</th>
                      <th>Score</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 8).map((ev) => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 600 }}>{ev.teamId}</td>
                        <td>{ev.problemId}</td>
                        <td>{ev.evaluatorName}</td>
                        <td>
                          <span className={`score-pill ${ev.finalScore >= 80 ? "score-high" : ev.finalScore >= 60 ? "score-mid" : "score-low"}`}>
                            {ev.finalScore}
                          </span>
                        </td>
                        <td style={{ color: "hsl(215 16% 47%)", fontSize: "0.8rem" }}>{new Date(ev.submittedAt).toLocaleDateString()}</td>
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
