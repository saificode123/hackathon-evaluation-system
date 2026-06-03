import { useEffect, useState } from "react";
import { collection, doc, updateDoc, deleteDoc, writeBatch, onSnapshot } from "firebase/firestore";

import { db } from "../../lib/firebase";
import type { Evaluation } from "../../lib/types";
import { RUBRIC_SECTIONS, calculateFinalScore, calculateSectionScores } from "../../lib/rubric";
import type { RubricScores } from "../../lib/types";

interface GroupedProject {
  teamId: string;
  problemId: string;
  teamLead: string;
  venue: string;
  evaluations: Evaluation[];
  averageScore: number;
}

type DeleteTarget =
  | { kind: "team"; teamId: string; ids: string[] }
  | { kind: "single"; evaluatorName: string; id: string };

function groupEvaluations(evaluations: Evaluation[]): GroupedProject[] {
  const map = new Map<string, Evaluation[]>();
  for (const ev of evaluations) {
    const key = ev.teamId.toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  const groups: GroupedProject[] = [];
  map.forEach((evals, teamId) => {
    const avg = evals.reduce((s, e) => s + e.finalScore, 0) / evals.length;
    groups.push({
      teamId,
      problemId: evals[0].problemId,
      teamLead: evals[0].teamLead,
      venue: evals[0].venue ?? "",
      evaluations: evals,
      averageScore: Math.round(avg * 100) / 100,
    });
  });
  return groups.sort((a, b) => b.averageScore - a.averageScore);
}

export default function Evaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailTarget, setDetailTarget] = useState<GroupedProject | null>(null);
  const [editTarget, setEditTarget] = useState<Evaluation | null>(null);
  const [editScores, setEditScores] = useState<RubricScores>({});
  const [editRemarks, setEditRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingLockId, setTogglingLockId] = useState<string | null>(null);
  const [unlockConfirmTarget, setUnlockConfirmTarget] = useState<Evaluation | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "evaluations"), (snap) => {
      setEvaluations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Evaluation)));
      setLoading(false);
    }, () => { setLoading(false); });
    return () => unsub();
  }, []);

  const openEdit = (ev: Evaluation) => {
    setEditTarget(ev);
    setEditScores({ ...ev.rubricScores });
    setEditRemarks(ev.remarks);
  };

  const handleSave = async () => {
    if (!editTarget?.id) return;
    setSaving(true);
    try {
      const newFinal = calculateFinalScore(editScores);
      const newSections = calculateSectionScores(editScores);
      await updateDoc(doc(db, "evaluations", editTarget.id), {
        rubricScores: editScores,
        sectionScores: newSections,
        finalScore: newFinal,
        remarks: editRemarks,
        editedAt: new Date().toISOString(),
      });
      const updated = evaluations.map((e) =>
        e.id === editTarget.id
          ? { ...e, rubricScores: editScores, sectionScores: newSections, finalScore: newFinal, remarks: editRemarks }
          : e
      );
      setEvaluations(updated);
      setSuccess(`Evaluation updated for Team ${editTarget.teamId}.`);
      setEditTarget(null);
      if (detailTarget) {
        const refreshed = groupEvaluations(updated).find(g => g.teamId === detailTarget.teamId);
        if (refreshed) setDetailTarget(refreshed);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "team") {
        const batch = writeBatch(db);
        deleteTarget.ids.forEach((id) => batch.delete(doc(db, "evaluations", id)));
        await batch.commit();
        const updated = evaluations.filter((e) => !deleteTarget.ids.includes(e.id!));
        setEvaluations(updated);
        setSuccess(`All evaluations for Team ${deleteTarget.teamId} have been deleted.`);
        setDetailTarget(null);
      } else {
        await deleteDoc(doc(db, "evaluations", deleteTarget.id));
        const updated = evaluations.filter((e) => e.id !== deleteTarget.id);
        setEvaluations(updated);
        setSuccess(`Evaluation by ${deleteTarget.evaluatorName} has been deleted.`);
        if (detailTarget) {
          const refreshed = groupEvaluations(updated).find(g => g.teamId === detailTarget.teamId);
          if (refreshed) setDetailTarget(refreshed);
          else setDetailTarget(null);
        }
      }
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const toggleLock = async (ev: Evaluation) => {
    if (!ev.id) return;
    // Unlock needs confirmation — show dialog first
    if (ev.locked !== false) {
      setUnlockConfirmTarget(ev);
      return;
    }
    // Lock directly (no confirm needed)
    await performToggle(ev, true);
  };

  const performToggle = async (ev: Evaluation, newLocked: boolean) => {
    if (!ev.id) return;
    setTogglingLockId(ev.id);
    try {
      await updateDoc(doc(db, "evaluations", ev.id), { locked: newLocked });
      // onSnapshot will update evaluations automatically; just update detailTarget if open
      setSuccess(newLocked
        ? `Marks locked for ${ev.evaluatorName}.`
        : `Marks unlocked for ${ev.evaluatorName}. They can now re-submit.`
      );
    } catch {
      // ignore
    } finally {
      setTogglingLockId(null);
      setUnlockConfirmTarget(null);
    }
  };

  // Keep detailTarget in sync when onSnapshot fires live updates
  useEffect(() => {
    if (!detailTarget) return;
    const refreshed = groupEvaluations(evaluations).find(g => g.teamId === detailTarget.teamId);
    if (refreshed) setDetailTarget(refreshed);
    else setDetailTarget(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluations]);

  const groups = groupEvaluations(evaluations).filter((g) =>
    [g.teamId, g.problemId, g.teamLead].some((f) =>
      f.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">All Evaluations</h1>
        <p className="page-subtitle">Project averages across all evaluators. Click Details to see individual scores.</p>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "1rem" }} onClick={() => setSuccess("")}>
          {success}
        </div>
      )}

      <div className="search-bar">
        <input
          type="search"
          className="form-input search-input"
          placeholder="Search by team, problem or team lead..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3>No evaluations found</h3>
            <p>{search ? "Try a different search." : "No evaluations have been submitted yet."}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Problem</th>
                    <th>Team Lead</th>
                    <th>Venue</th>
                    <th>Evaluators</th>
                    <th>Avg Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.teamId}>
                      <td style={{ fontWeight: 600 }}>{g.teamId}</td>
                      <td>{g.problemId}</td>
                      <td>{g.teamLead}</td>
                      <td style={{ color: "hsl(215 16% 47%)", fontSize: "0.85rem" }}>{g.venue || "—"}</td>
                      <td>
                        <span className="badge badge-gray">{g.evaluations.length} evaluator{g.evaluations.length !== 1 ? "s" : ""}</span>
                      </td>
                      <td>
                        <span className={`score-pill ${g.averageScore >= 80 ? "score-high" : g.averageScore >= 60 ? "score-mid" : "score-low"}`}>
                          {g.averageScore.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setDetailTarget(g)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            Details
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget({ kind: "team", teamId: g.teamId, ids: g.evaluations.map(e => e.id!) })}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                            </svg>
                            Delete All
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-card-list">
              {groups.map((g) => (
                <div key={g.teamId} className="mobile-card">
                  <div className="mobile-card-row">
                    <span style={{ fontWeight: 700 }}>{g.teamId}</span>
                    <span className={`score-pill ${g.averageScore >= 80 ? "score-high" : g.averageScore >= 60 ? "score-mid" : "score-low"}`}>
                      Avg: {g.averageScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Problem: {g.problemId} | Lead: {g.teamLead}</span>
                  </div>
                  {g.venue && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Venue: {g.venue}</span>
                    </div>
                  )}
                  <div className="mobile-card-row" style={{ gap: "0.4rem" }}>
                    <span className="badge badge-gray">{g.evaluations.length} evaluator{g.evaluations.length !== 1 ? "s" : ""}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDetailTarget(g)}>Details</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget({ kind: "team", teamId: g.teamId, ids: g.evaluations.map(e => e.id!) })}>Delete All</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailTarget && !editTarget && (
        <div className="modal-overlay" onClick={() => setDetailTarget(null)}>
          <div className="modal" style={{ maxWidth: 820, width: "95vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Team {detailTarget.teamId} — Evaluation Details</div>
              <button className="modal-close" onClick={() => setDetailTarget(null)}>✕</button>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              <span className="badge badge-gray">Problem: {detailTarget.problemId}</span>
              <span className="badge badge-gray">Lead: {detailTarget.teamLead}</span>
              {detailTarget.venue && <span className="badge badge-gray">Venue: {detailTarget.venue}</span>}
              <span className="badge badge-blue">{detailTarget.evaluations.length} Evaluator{detailTarget.evaluations.length !== 1 ? "s" : ""}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(221 83% 53%)" }}>
                Overall Average: {detailTarget.averageScore.toFixed(2)}/100
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
              {detailTarget.evaluations.map((ev) => (
                <div key={ev.id} style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "1rem", background: "hsl(var(--muted))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{ev.evaluatorName}</div>
                      <div style={{ fontSize: "0.75rem", color: "hsl(215 16% 47%)" }}>{new Date(ev.submittedAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span className={`score-pill ${ev.finalScore >= 80 ? "score-high" : ev.finalScore >= 60 ? "score-mid" : "score-low"}`}>
                        {ev.finalScore.toFixed(2)}
                      </span>
                      {/* Lock status badge */}
                      <span
                        className={`badge ${ev.locked === false ? "badge-green" : "badge-yellow"}`}
                        style={{ fontSize: "0.65rem" }}
                      >
                        {ev.locked === false ? "🔓 Unlocked" : "🔒 Locked"}
                      </span>
                      {/* Lock / Unlock toggle */}
                      <button
                        className={`btn btn-sm ${ev.locked === false ? "btn-secondary" : "btn-secondary"}`}
                        style={{ borderColor: ev.locked === false ? "#10b981" : "#f59e0b", color: ev.locked === false ? "#065f46" : "#92400e" }}
                        onClick={() => toggleLock(ev)}
                        disabled={togglingLockId === ev.id}
                        title={ev.locked === false ? "Lock marks" : "Unlock marks for re-submission"}
                      >
                        {togglingLockId === ev.id ? (
                          <div style={{ width: 11, height: 11, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        ) : ev.locked === false ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                          </svg>
                        )}
                        {ev.locked === false ? "Lock" : "Unlock"}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(ev)} title="Edit">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget({ kind: "single", evaluatorName: ev.evaluatorName, id: ev.id! })}
                        title="Delete this evaluation"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {RUBRIC_SECTIONS.map((section) => {
                      const sScore = ev.sectionScores?.[section.id] ?? 0;
                      const pct = (sScore / section.weight) * 100;
                      return (
                        <div key={section.id}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 2 }}>
                            <span style={{ color: "hsl(215 16% 47%)" }}>Section {section.id}: {section.name}</span>
                            <span style={{ fontWeight: 600 }}>{sScore.toFixed(2)}/{section.weight}</span>
                          </div>
                          <div style={{ height: 5, background: "hsl(var(--border))", borderRadius: 3 }}>
                            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {ev.remarks && (
                    <div style={{ marginTop: "0.75rem", padding: "0.5rem", background: "white", borderRadius: 6, fontSize: "0.78rem", color: "hsl(215 25% 35%)", borderLeft: "3px solid hsl(221 83% 53%)" }}>
                      <strong>Remarks:</strong> {ev.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {detailTarget.evaluations.length > 1 && (
              <div style={{ background: "hsl(221 83% 97%)", borderRadius: 10, padding: "1rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.75rem", color: "hsl(221 83% 40%)" }}>
                  Section Averages (across all evaluators)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
                  {RUBRIC_SECTIONS.map((section) => {
                    const sAvg = detailTarget.evaluations.reduce((s, ev) => s + (ev.sectionScores?.[section.id] ?? 0), 0) / detailTarget.evaluations.length;
                    return (
                      <div key={section.id} style={{ background: "white", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem" }}>
                        <div style={{ color: "hsl(215 16% 47%)", marginBottom: 2 }}>Section {section.id} ({section.weight} pts)</div>
                        <div style={{ fontWeight: 700, color: "hsl(221 83% 53%)" }}>{sAvg.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setDeleteTarget({ kind: "team", teamId: detailTarget.teamId, ids: detailTarget.evaluations.map(e => e.id!) })}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
                Delete All Evaluations for this Team
              </button>
              <button className="btn btn-secondary" onClick={() => setDetailTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit scores modal ── */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Scores — {editTarget.evaluatorName} / Team {editTarget.teamId}</div>
              <button className="modal-close" onClick={() => setEditTarget(null)}>✕</button>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <span className="badge badge-blue">Evaluator: {editTarget.evaluatorName}</span>
              <span className="badge badge-gray">Problem: {editTarget.problemId}</span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "hsl(221 83% 53%)" }}>
                New Score: {calculateFinalScore(editScores).toFixed(2)}/100
              </span>
            </div>

            <div style={{ maxHeight: "55vh", overflowY: "auto", marginBottom: "1rem" }}>
              {RUBRIC_SECTIONS.map((section) => (
                <div key={section.id} style={{ marginBottom: "1rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem", color: "hsl(221 83% 53%)" }}>
                    Section {section.id}: {section.name} ({section.weight} pts)
                  </div>
                  {section.criteria.map((criterion) => (
                    <div key={criterion.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid hsl(var(--border))", gap: "1rem" }}>
                      <div style={{ fontSize: "0.82rem" }}>{criterion.name} <span style={{ color: "hsl(215 16% 47%)" }}>({criterion.weight} pts)</span></div>
                      <div className="score-buttons">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`score-btn ${editScores[criterion.id] === n ? `selected-${n}` : ""}`}
                            style={{ width: 30, height: 30, fontSize: "0.75rem", borderRadius: 6 }}
                            onClick={() => setEditScores((prev) => ({ ...prev, [criterion.id]: n }))}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div className="form-group" style={{ marginTop: "0.75rem" }}>
                <label className="form-label">Remarks</label>
                <textarea className="form-textarea" value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} rows={3} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes & Recalculate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlock confirmation modal ── */}
      {unlockConfirmTarget && (
        <div className="modal-overlay" onClick={() => !togglingLockId && setUnlockConfirmTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
                Confirm Unlock
              </div>
              <button className="modal-close" onClick={() => !togglingLockId && setUnlockConfirmTarget(null)}>✕</button>
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "0.85rem 1rem", marginBottom: "1.25rem", fontSize: "0.84rem", color: "#92400e" }}>
              <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
                Unlock marks for <span style={{ color: "hsl(221 83% 53%)" }}>{unlockConfirmTarget.evaluatorName}</span>?
              </div>
              <div>Team: <strong>{unlockConfirmTarget.teamId}</strong> &nbsp;|&nbsp; Current Score: <strong>{unlockConfirmTarget.finalScore.toFixed(2)}/100</strong></div>
            </div>

            <p style={{ fontSize: "0.88rem", color: "hsl(215 25% 30%)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              This will allow <strong>{unlockConfirmTarget.evaluatorName}</strong> to edit and re-submit their marks. Their evaluation will be re-locked automatically after they save.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setUnlockConfirmTarget(null)} disabled={!!togglingLockId}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: "#d97706", borderColor: "#d97706" }}
                onClick={() => performToggle(unlockConfirmTarget, false)}
                disabled={!!togglingLockId}
              >
                {togglingLockId ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                    Yes, Unlock Marks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "hsl(0 84% 45%)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Confirm Deletion
              </div>
              <button className="modal-close" onClick={() => !deleting && setDeleteTarget(null)}>✕</button>
            </div>

            <p style={{ fontSize: "0.9rem", color: "hsl(215 25% 30%)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              {deleteTarget.kind === "team" ? (
                <>Are you sure you want to delete <strong>all {deleteTarget.ids.length} evaluation{deleteTarget.ids.length !== 1 ? "s" : ""}</strong> for Team <strong>{deleteTarget.teamId}</strong>? This cannot be undone.</>
              ) : (
                <>Are you sure you want to delete the evaluation submitted by <strong>{deleteTarget.evaluatorName}</strong>? This cannot be undone.</>
              )}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? (
                  <>
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
