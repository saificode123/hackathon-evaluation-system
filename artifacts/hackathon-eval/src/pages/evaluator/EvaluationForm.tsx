import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";
import { useLocation } from "wouter";
import {
  RUBRIC_SECTIONS, calculateFinalScore, calculateSectionScores,
  isEvaluationComplete, SCORE_LABELS, ALL_CRITERIA,
} from "../../lib/rubric";
import type { RubricScores, Evaluation } from "../../lib/types";

const today = new Date().toISOString().split("T")[0];

interface Props {
  editEvalId?: string; // passed when editing an unlocked evaluation
}

export default function EvaluationForm({ editEvalId }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    teamId: "", problemId: "", date: today,
    teamLead: "", venue: "", remarks: "",
  });
  const [rubricScores, setRubricScores] = useState<RubricScores>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editEvalId);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Existing evaluation (for edit or duplicate-check unlock flow)
  const [existingEval, setExistingEval] = useState<Evaluation | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const finalScore = calculateFinalScore(rubricScores);
  const sectionScores = calculateSectionScores(rubricScores);
  const filled = ALL_CRITERIA.filter((c) => (rubricScores[c.id] ?? 0) > 0).length;
  const total = ALL_CRITERIA.length;
  const progressPct = Math.round((filled / total) * 100);
  const complete = isEvaluationComplete(rubricScores);

  // Load existing evaluation when editEvalId is provided
  useEffect(() => {
    if (!editEvalId) return;
    (async () => {
      setLoadingEdit(true);
      try {
        const snap = await getDoc(doc(db, "evaluations", editEvalId));
        if (!snap.exists()) {
          setError("Evaluation not found.");
          setLoadingEdit(false);
          return;
        }
        const ev = { id: snap.id, ...snap.data() } as Evaluation;

        // Security: only the owner can edit
        if (ev.evaluatorId !== user?.uid) {
          setError("You are not authorised to edit this evaluation.");
          setLoadingEdit(false);
          return;
        }
        // Must be unlocked
        if (ev.locked !== false) {
          setIsLocked(true);
          setExistingEval(ev);
          setLoadingEdit(false);
          return;
        }

        // Pre-populate form
        setExistingEval(ev);
        setForm({
          teamId: ev.teamId,
          problemId: ev.problemId,
          date: ev.date,
          teamLead: ev.teamLead,
          venue: ev.venue ?? "",
          remarks: ev.remarks ?? "",
        });
        setRubricScores({ ...ev.rubricScores });
      } catch {
        setError("Failed to load evaluation. Please try again.");
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editEvalId, user?.uid]);

  const setScore = (criterionId: string, score: number) => {
    setRubricScores((prev) => ({ ...prev, [criterionId]: score }));
  };

  // Called when form is submitted — for new evaluations check for duplicates, then show confirm
  const handleSubmitClick = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.teamId.trim() || !form.problemId.trim() || !form.teamLead.trim()) {
      setError("Please fill in all required fields (Team ID, Problem ID, Team Lead).");
      return;
    }
    if (!complete) {
      setError("Please score all criteria (1–5) before submitting.");
      return;
    }

    // If editing an existing unlocked eval, skip duplicate check and go straight to confirm
    if (existingEval) {
      setShowConfirm(true);
      return;
    }

    // New submission: check for duplicate
    try {
      const dup = await getDocs(
        query(collection(db, "evaluations"),
          where("evaluatorId", "==", user!.uid),
          where("teamId", "==", form.teamId.trim())
        )
      );
      if (!dup.empty) {
        const existing = { id: dup.docs[0].id, ...dup.docs[0].data() } as Evaluation;
        if (existing.locked !== false) {
          setIsLocked(true);
          setExistingEval(existing);
          return;
        } else {
          // Unlocked — treat as edit
          setExistingEval(existing);
          setShowConfirm(true);
          return;
        }
      }
    } catch {
      setError("Could not verify submission status. Please try again.");
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const projectId = `${form.teamId.trim()}-${form.problemId.trim()}`.toLowerCase().replace(/\s+/g, "-");
      const payload = {
        projectId,
        teamId: form.teamId.trim(),
        problemId: form.problemId.trim(),
        teamLead: form.teamLead.trim(),
        venue: form.venue.trim(),
        date: form.date,
        evaluatorId: user!.uid,
        evaluatorName: user!.name,
        rubricScores,
        sectionScores,
        finalScore,
        remarks: form.remarks.trim(),
        submittedAt: new Date().toISOString(),
        locked: true,
      };

      if (existingEval?.id) {
        await updateDoc(doc(db, "evaluations", existingEval.id), payload);
      } else {
        await addDoc(collection(db, "evaluations"), payload);
      }

      setSuccess(true);
    } catch {
      setError("Failed to submit evaluation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state (fetching existing eval) ──
  if (loadingEdit) {
    return (
      <div className="page-content">
        <div className="loading-center"><div className="loading-spinner" /></div>
      </div>
    );
  }

  // ── Locked state ──
  if (isLocked && existingEval) {
    return (
      <div className="page-content" style={{ maxWidth: 600 }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ width: 64, height: 64, background: "#fef3c7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#92400e" }}>Evaluation Locked</h2>
          <p style={{ color: "hsl(215 16% 47%)", marginBottom: "0.4rem" }}>
            Your evaluation for Team <strong>{existingEval.teamId}</strong> is locked.
          </p>
          <p style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)", marginBottom: "0.4rem" }}>
            Score: <strong style={{ color: "hsl(221 83% 53%)" }}>{existingEval.finalScore.toFixed(2)}/100</strong>
          </p>
          <p style={{ fontSize: "0.82rem", color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem" }}>
            <strong>Marks are locked.</strong> Only a Coordinator can unlock your evaluation if changes are needed.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/evaluator")}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="page-content" style={{ maxWidth: 600 }}>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ width: 64, height: 64, background: "#d1fae5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            {existingEval ? "Marks Updated!" : "Evaluation Submitted!"}
          </h2>
          <p style={{ color: "hsl(215 16% 47%)", marginBottom: "0.4rem" }}>
            Team <strong>{form.teamId}</strong> — Final Score: <strong style={{ color: "hsl(221 83% 53%)" }}>{finalScore.toFixed(2)}/100</strong>
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.82rem", color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "0.6rem 1rem", marginBottom: "1.5rem" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Your marks are now <strong style={{ marginLeft: 3 }}>locked</strong>. Contact a Coordinator to make further changes.
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/evaluator")}>Back to Dashboard</button>
            {!editEvalId && (
              <button className="btn btn-primary" onClick={() => {
                setForm({ teamId: "", problemId: "", date: today, teamLead: "", venue: "", remarks: "" });
                setRubricScores({});
                setExistingEval(null);
                setSuccess(false);
              }}>
                Evaluate Another Team
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isEditMode = !!existingEval;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">
          {isEditMode ? "Edit Evaluation" : "Evaluation Form"}
        </h1>
        <p className="page-subtitle">
          {isEditMode
            ? `Updating marks for Team ${existingEval.teamId} — unlocked by Coordinator`
            : "Hackathon 2026 — AI for a Sustainable Future"}
        </p>
      </div>

      {/* Edit mode banner */}
      {isEditMode && (
        <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          This evaluation has been <strong>unlocked by the Coordinator</strong>. Your updated marks will replace the previous submission and will be re-locked after saving.
        </div>
      )}

      {/* Sticky score bar */}
      <div className="score-sticky" style={{ position: "sticky", top: 0, zIndex: 30, background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))", padding: "0.75rem 0", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(215 16% 47%)" }}>Live Score</div>
            <div className="score-total">{finalScore.toFixed(2)}<span style={{ fontSize: "0.9rem", fontWeight: 400, color: "hsl(215 16% 47%)" }}>/100</span></div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "hsl(215 16% 47%)", marginBottom: 4 }}>
              <span>Progress</span><span>{filled}/{total} criteria</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
          </div>
          {complete && <span className="badge badge-green">All scored</span>}
        </div>
      </div>

      <form onSubmit={handleSubmitClick}>
        {/* Project Info */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="card-header"><div className="card-title">Project Information</div></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Team ID *</label>
              <input className="form-input" required value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                placeholder="e.g. T001"
                readOnly={isEditMode}
                style={isEditMode ? { background: "hsl(var(--muted))" } : undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Problem ID *</label>
              <input className="form-input" required value={form.problemId}
                onChange={(e) => setForm({ ...form, problemId: e.target.value })}
                placeholder="e.g. P001"
                readOnly={isEditMode}
                style={isEditMode ? { background: "hsl(var(--muted))" } : undefined}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Team Lead *</label>
              <input className="form-input" required value={form.teamLead}
                onChange={(e) => setForm({ ...form, teamLead: e.target.value })}
                placeholder="Name of team lead"
                readOnly={isEditMode}
                style={isEditMode ? { background: "hsl(var(--muted))" } : undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                readOnly={isEditMode}
                style={isEditMode ? { background: "hsl(var(--muted))" } : undefined}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Venue</label>
              <input className="form-input" value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Hall A, Lab 3"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Evaluator</label>
              <input className="form-input" value={user?.name ?? ""} readOnly style={{ background: "hsl(var(--muted))" }} />
            </div>
          </div>
        </div>

        {/* Score legend */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", flex: "wrap", gap: "0.75rem", flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem" }}>
                <div className={`score-btn selected-${n}`} style={{ width: 28, height: 28, fontSize: "0.75rem", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, border: "2px solid" }}>{n}</div>
                <span><strong>{SCORE_LABELS[n].label}</strong> — {SCORE_LABELS[n].desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rubric sections */}
        {RUBRIC_SECTIONS.map((section) => {
          const sScore = sectionScores[section.id] ?? 0;
          return (
            <div key={section.id} className="rubric-section" style={{ marginBottom: "1rem" }}>
              <div className="rubric-section-header">
                <div>
                  <span style={{ color: "hsl(221 83% 53%)", marginRight: "0.5rem" }}>Section {section.id}</span>
                  {section.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "hsl(215 16% 47%)" }}>{sScore.toFixed(2)}/{section.weight}</span>
                  <span className="rubric-section-weight">{section.weight} pts</span>
                </div>
              </div>
              {section.criteria.map((criterion) => {
                const score = rubricScores[criterion.id];
                const selectedGuide = score && criterion.scoreGuides?.[score];
                return (
                  <div key={criterion.id} className="rubric-criterion">
                    <div className="rubric-criterion-body">
                      <div className="criterion-name">{criterion.name}</div>
                      <div className="criterion-weight">Max: {criterion.weight} pts</div>
                      {selectedGuide && (
                        <p className="criterion-selected-guide">
                          <strong>Score {score}:</strong> {selectedGuide}
                        </p>
                      )}
                      {criterion.scoreGuides && (
                        <details className="criterion-guides">
                          <summary>View score guide (1–5)</summary>
                          <ul>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <li key={n} className={score === n ? "criterion-guide-active" : undefined}>
                                <span className="criterion-guide-score">{n}</span>
                                {criterion.scoreGuides![n]}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                    <div className="score-buttons">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button"
                          className={`score-btn ${score === n ? `selected-${n}` : ""}`}
                          onClick={() => setScore(criterion.id, n)}
                          title={criterion.scoreGuides?.[n] ?? SCORE_LABELS[n].label}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Additional remarks */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <div className="card-title">Additional Remarks</div>
            <div className="card-subtitle">Optional feedback for this team</div>
          </div>
          <textarea className="form-textarea" rows={4} value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="Enter any additional feedback, observations, or recommendations..."
          />
        </div>

        {/* Score summary */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header"><div className="card-title">Score Summary</div></div>
          <div className="score-summary">
            {RUBRIC_SECTIONS.map((s) => (
              <div key={s.id} className="score-summary-item">
                <div className="score-summary-label">Section {s.id} ({s.weight} pts)</div>
                <div className="score-summary-value">{(sectionScores[s.id] ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.75rem", borderTop: "1px solid hsl(var(--border))" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>Total Score</div>
            <div style={{ fontWeight: 800, fontSize: "1.5rem", color: "hsl(221 83% 53%)" }}>
              {finalScore.toFixed(2)}<span style={{ fontWeight: 400, fontSize: "1rem", color: "hsl(215 16% 47%)" }}>/100</span>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/evaluator")}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !complete}>
            {submitting
              ? "Saving..."
              : complete
                ? isEditMode ? "Save Updated Marks" : "Submit Evaluation"
                : `Score all criteria (${filled}/${total})`}
          </button>
        </div>
      </form>

      {/* ── Submission Confirmation Dialog ── */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(221 83% 53%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {isEditMode ? "Confirm Mark Update" : "Confirm Submission"}
              </div>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>

            {/* Score preview */}
            <div style={{ background: "hsl(210 40% 96%)", borderRadius: 10, padding: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", fontSize: "0.83rem", marginBottom: "0.75rem" }}>
                <div><span style={{ color: "hsl(215 16% 47%)" }}>Team:</span> <strong>{form.teamId}</strong></div>
                <div><span style={{ color: "hsl(215 16% 47%)" }}>Problem:</span> <strong>{form.problemId}</strong></div>
                <div><span style={{ color: "hsl(215 16% 47%)" }}>Team Lead:</span> <strong>{form.teamLead}</strong></div>
                <div><span style={{ color: "hsl(215 16% 47%)" }}>Evaluator:</span> <strong>{user?.name}</strong></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid hsl(var(--border))", paddingTop: "0.75rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Final Score</span>
                <span style={{ fontWeight: 800, fontSize: "1.4rem", color: "hsl(221 83% 53%)" }}>
                  {finalScore.toFixed(2)}<span style={{ fontWeight: 400, fontSize: "0.9rem", color: "hsl(215 16% 47%)" }}>/100</span>
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, marginBottom: "1.25rem", fontSize: "0.84rem", color: "#92400e" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>
                {isEditMode
                  ? "Your marks will be updated and <strong>re-locked</strong>. Contact a Coordinator for any further changes."
                  : "Once submitted, your marks will be <strong>locked</strong>. You will not be able to change them unless a Coordinator unlocks your evaluation."}
              </span>
            </div>

            <p style={{ fontSize: "0.88rem", color: "hsl(215 25% 30%)", marginBottom: "1.25rem" }}>
              {isEditMode ? "Are you sure you want to save these updated marks?" : "Are you sure you want to submit this evaluation?"}
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Go Back & Review</button>
              <button className="btn btn-primary" onClick={handleConfirmedSubmit}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {isEditMode ? "Yes, Save & Lock" : "Yes, Submit & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
