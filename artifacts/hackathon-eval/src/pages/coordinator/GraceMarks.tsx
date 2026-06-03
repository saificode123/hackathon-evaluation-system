import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Evaluation } from "../../lib/types";
import {
  buildProjectAggregates,
  calculateFinalTotalMarks,
  getMaxGraceMarks,
  graceMarksMapFromDocs,
  MAX_TEAM_SCORE,
  validateGraceMarks,
  type ProjectAggregate,
} from "../../lib/teamScores";

export default function GraceMarks() {
  const [teams, setTeams] = useState<ProjectAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftMarks, setDraftMarks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let evaluations: Evaluation[] = [];
    let graceMap = new Map<string, number>();
    const recompute = (syncDraftFromServer = false) => {
      const aggregates = buildProjectAggregates(evaluations, graceMap);
      setTeams(aggregates);
      setDraftMarks((prev) => {
        const next = { ...prev };
        for (const t of aggregates) {
          const saved = String(t.graceMarks);
          if (syncDraftFromServer || next[t.projectId] === undefined) {
            next[t.projectId] = saved;
          }
        }
        return next;
      });
      setLoading(false);
    };

    const unsubEvals = onSnapshot(collection(db, "evaluations"), (snap) => {
      evaluations = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation));
      recompute(false);
    }, () => setLoading(false));

    const unsubScores = onSnapshot(
      collection(db, "teamScores"),
      (snap) => {
        graceMap = graceMarksMapFromDocs(snap.docs);
        recompute(true);
      },
      (err) => {
        console.error("teamScores listener error:", err);
        setError("Could not load saved grace marks. Check Firestore rules for teamScores.");
        setLoading(false);
      },
    );

    return () => {
      unsubEvals();
      unsubScores();
    };
  }, []);

  const handleSave = async (team: ProjectAggregate) => {
    if (!team.canEditGraceMarks) return;
    setError("");
    setSuccess("");
    const raw = draftMarks[team.projectId] ?? "0";
    const parsed = Number(raw);
    const graceMarks = Math.round(parsed * 100) / 100;
    const validation = validateGraceMarks(team.averageScore, graceMarks);
    if (!validation.ok) {
      setError(`Team ${team.teamId}: ${validation.message}`);
      return;
    }

    setSavingId(team.projectId);
    try {
      await setDoc(
        doc(db, "teamScores", team.projectId),
        {
          projectId: team.projectId,
          teamId: team.teamId,
          graceMarks,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setDraftMarks((prev) => ({ ...prev, [team.projectId]: String(graceMarks) }));
      setSuccess(`Grace marks saved for Team ${team.teamId} (+${graceMarks.toFixed(2)}).`);
    } catch {
      setError(`Failed to save grace marks for Team ${team.teamId}. Please try again.`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Grace Marks</h1>
        <p className="page-subtitle">
          Add grace marks after every submitted evaluation for a team is locked. Final total cannot exceed {MAX_TEAM_SCORE}.
        </p>
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

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : teams.length === 0 ? (
          <div className="empty-state">
            <h3>No teams yet</h3>
            <p>Teams appear here once evaluators submit evaluations.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Team Lead</th>
                  <th>Avg Score</th>
                  <th>Locked Evaluators</th>
                  <th>Grace Marks</th>
                  <th>Final Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const canEdit = t.canEditGraceMarks;
                  const savedGrace = t.graceMarks;
                  const draftRaw = draftMarks[t.projectId] ?? String(savedGrace);
                  const draftGrace = Number(draftRaw);
                  const graceForTotal = Number.isNaN(draftGrace) ? savedGrace : draftGrace;
                  const previewTotal = calculateFinalTotalMarks(t.averageScore, graceForTotal);
                  const maxGrace = getMaxGraceMarks(t.averageScore);
                  const exceedsMax = previewTotal > MAX_TEAM_SCORE;
                  const hasChanges =
                    !Number.isNaN(draftGrace) &&
                    Math.round(draftGrace * 100) / 100 !== savedGrace;

                  return (
                    <tr key={t.projectId}>
                      <td style={{ fontWeight: 700 }}>{t.teamId}</td>
                      <td>{t.teamLead}</td>
                      <td>{t.averageScore.toFixed(2)}</td>
                      <td>
                        <span
                          className={`badge ${t.allEvaluatorsLocked ? "badge-green" : "badge-yellow"}`}
                          title={t.graceBlockReason ?? undefined}
                        >
                          {t.lockedEvaluatorsCount} / {t.evaluatorsCount} submitted & locked
                        </span>
                        {!canEdit && t.graceBlockReason && (
                          <div style={{ fontSize: "0.7rem", color: "hsl(0 72% 51%)", marginTop: 4, maxWidth: 220 }}>
                            {t.graceBlockReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          style={{
                            width: 90,
                            padding: "0.35rem 0.5rem",
                            borderColor: exceedsMax ? "hsl(0 72% 51%)" : undefined,
                          }}
                          min={0}
                          max={maxGrace}
                          step={0.01}
                          value={draftMarks[t.projectId] ?? "0"}
                          disabled={!canEdit || savingId === t.projectId}
                          onChange={(e) =>
                            setDraftMarks((prev) => ({ ...prev, [t.projectId]: e.target.value }))
                          }
                          title={
                            canEdit
                              ? t.graceMarks > 0 || draftMarks[t.projectId] !== undefined
                                ? "Update grace marks for this team"
                                : "Grace marks added to the team average"
                              : t.graceBlockReason ?? "Lock all submitted evaluations for this team first"
                          }
                        />
                        <div style={{ fontSize: "0.68rem", color: "hsl(215 16% 47%)", marginTop: 2 }}>
                          Max grace: {maxGrace.toFixed(2)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 140 }}>
                          <span
                            className={`score-pill ${
                              exceedsMax
                                ? "score-low"
                                : previewTotal >= 80
                                  ? "score-high"
                                  : previewTotal >= 60
                                    ? "score-mid"
                                    : "score-low"
                            }`}
                            style={{ alignSelf: "flex-start" }}
                          >
                            {previewTotal.toFixed(2)}
                          </span>
                          {exceedsMax && (
                            <span style={{ fontSize: "0.68rem", color: "hsl(0 72% 51%)" }}>
                              Cannot exceed {MAX_TEAM_SCORE}
                            </span>
                          )}
                          <span style={{ fontSize: "0.72rem", color: "hsl(215 16% 47%)", lineHeight: 1.35 }}>
                            {t.averageScore.toFixed(2)} avg
                            {graceForTotal > 0 ? (
                              <> + <strong style={{ color: "hsl(221 83% 53%)" }}>{graceForTotal.toFixed(2)}</strong> grace</>
                            ) : graceForTotal === 0 && draftRaw !== "" && !Number.isNaN(draftGrace) ? (
                              <> + 0 grace</>
                            ) : null}
                            {" = "}
                            <strong>{previewTotal.toFixed(2)}</strong>
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!canEdit || !hasChanges || exceedsMax || savingId === t.projectId}
                          onClick={() => handleSave(t)}
                          title={
                            !canEdit
                              ? t.graceBlockReason ?? "Lock all submitted evaluations first"
                              : exceedsMax
                                ? `Final total cannot exceed ${MAX_TEAM_SCORE}`
                                : !hasChanges
                                  ? "Change the value to update grace marks"
                                  : "Save grace marks"
                          }
                        >
                          {savingId === t.projectId ? "Saving…" : t.graceMarks > 0 ? "Update" : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
