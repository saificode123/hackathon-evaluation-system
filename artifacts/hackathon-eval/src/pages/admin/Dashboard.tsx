import { useEffect, useState } from "react";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useLocation } from "wouter";
import type { Evaluation } from "../../lib/types";
import {
  countEvaluatedTeams,
  saveTotalTeams,
  subscribeHackathonSettings,
} from "../../lib/settings";
import TeamEvaluationProgress from "../../components/TeamEvaluationProgress";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState({ evaluators: 0, coordinators: 0, evaluations: 0, projects: 0 });
  const [totalTeams, setTotalTeams] = useState(0);
  const [teamInput, setTeamInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let evaluations: Evaluation[] = [];

    const recomputeStats = () => {
      const projectIds = new Set(evaluations.map((e) => e.projectId));
      setStats((prev) => ({
        ...prev,
        evaluations: evaluations.length,
        projects: projectIds.size,
      }));
    };

    const unsubSettings = subscribeHackathonSettings((settings) => {
      setTotalTeams(settings.totalTeams);
      setTeamInput(String(settings.totalTeams > 0 ? settings.totalTeams : ""));
    });

    const unsubEvals = onSnapshot(collection(db, "evaluations"), (snap) => {
      evaluations = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
      recomputeStats();
    });

    (async () => {
      try {
        const [evalSnap, coordSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "evaluator"))),
          getDocs(query(collection(db, "users"), where("role", "==", "coordinator"))),
        ]);
        setStats((prev) => ({
          ...prev,
          evaluators: evalSnap.size,
          coordinators: coordSnap.size,
        }));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubSettings();
      unsubEvals();
    };
  }, []);

  const evaluatedTeams = stats.projects;

  const handleSaveTotalTeams = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const parsed = Number(teamInput);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError("Enter a whole number of teams (at least 1).");
      return;
    }
    if (parsed < evaluatedTeams) {
      setError(
        `Total teams cannot be less than teams already evaluated (${evaluatedTeams}).`,
      );
      return;
    }

    setSaving(true);
    try {
      await saveTotalTeams(parsed, user?.name ?? "Admin");
      setSuccess(`Total teams set to ${parsed}. Coordinators can now track remaining evaluations.`);
    } catch {
      setError("Failed to save. Check Firestore rules for the settings collection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.name}. Manage the hackathon evaluation system.</p>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }} onClick={() => setSuccess("")}>
          {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }} onClick={() => setError("")}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.evaluators}</div>
              <div className="stat-label">Evaluators</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.coordinators}</div>
              <div className="stat-label">Coordinators</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.evaluations}</div>
              <div className="stat-label">Evaluations Done</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{evaluatedTeams}</div>
              <div className="stat-label">Teams Evaluated</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: "1rem" }}>
            <div className="card-header">
              <div className="card-title">Hackathon Team Count</div>
              <div className="card-subtitle">
                Set how many teams are participating. Coordinators see how many evaluations remain.
              </div>
            </div>
            <form
              onSubmit={handleSaveTotalTeams}
              style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1.25rem" }}
            >
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label className="form-label">Total number of teams</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  step={1}
                  required
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  placeholder="e.g. 25"
                  disabled={saving}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
            <TeamEvaluationProgress totalTeams={totalTeams} evaluatedTeams={evaluatedTeams} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ cursor: "pointer" }} onClick={() => navigate("/admin/users")}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "hsl(221 83% 53% / 0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(221 83% 53%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Manage Users</div>
                  <div style={{ fontSize: "0.8rem", color: "hsl(215 16% 47%)", marginTop: 2 }}>
                    Create evaluators, coordinators, reset passwords
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#d1fae522", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Evaluation Progress</div>
                  <div style={{ fontSize: "0.8rem", color: "hsl(215 16% 47%)", marginTop: 2 }}>
                    {totalTeams > 0
                      ? `${evaluatedTeams} of ${totalTeams} teams evaluated`
                      : "Set total teams above to enable tracking"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="card-header">
              <div className="card-title">Admin Responsibilities</div>
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
              {[
                "Set the total number of hackathon teams for progress tracking",
                "Create Evaluator and Coordinator accounts with secure passwords",
                "Assign appropriate roles to users",
                "Reset passwords when evaluators or coordinators are locked out",
                "Delete inactive or erroneous user accounts",
                "Monitor system usage and evaluation progress",
              ].map((item) => (
                <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(221 83% 53%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
