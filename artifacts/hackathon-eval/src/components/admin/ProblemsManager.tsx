import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { saveProblem, updateProblem } from "../../lib/adminUpload";
import { formatPrefixedId, isValidPrefixedId, prefixedIdError } from "../../lib/idFormat";
import type { ProblemRecord } from "../../lib/types";

export default function ProblemsManager() {
  const [problems, setProblems] = useState<ProblemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [problemId, setProblemId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editTarget, setEditTarget] = useState<ProblemRecord | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadProblems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "problems"));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ProblemRecord))
        .sort((a, b) => a.problemId.localeCompare(b.problemId));
      setProblems(list);
    } catch {
      setError("Failed to load problems.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProblems(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!isValidPrefixedId("P", problemId)) {
      setError(prefixedIdError("P", "Problem ID"));
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setSaving(true);
    try {
      const id = problemId.trim().toUpperCase();
      await saveProblem(id, description);
      setSuccess(`Problem ${id} saved.`);
      setProblemId("");
      setDescription("");
      await loadProblems();
    } catch {
      setError("Failed to save problem. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (problem: ProblemRecord) => {
    setEditTarget(problem);
    setEditDescription(problem.description);
    setEditError("");
    setError("");
    setSuccess("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    if (!editDescription.trim()) {
      setEditError("Description is required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      await updateProblem(editTarget.id, editDescription);
      setProblems((prev) =>
        prev.map((p) =>
          p.id === editTarget.id ? { ...p, description: editDescription.trim() } : p,
        ),
      );
      setSuccess(`Problem ${editTarget.problemId} updated.`);
      setEditTarget(null);
      setEditDescription("");
    } catch {
      setEditError("Failed to update problem.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "problems", id));
      setProblems((prev) => prev.filter((p) => p.id !== id));
      setSuccess("Problem deleted.");
    } catch {
      setError("Failed to delete problem.");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Problem IDs &amp; Descriptions</div>
        <div className="card-subtitle">Add problem statements for evaluators to select during evaluation.</div>
      </div>

      {success && <div className="alert alert-success" style={{ marginBottom: "0.875rem" }}>{success}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: "0.875rem" }}>{error}</div>}

      <form onSubmit={handleAdd} style={{ marginBottom: "1.25rem" }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Problem ID *</label>
            <input
              className="form-input"
              placeholder="e.g. P001"
              value={problemId}
              onChange={(e) => setProblemId(formatPrefixedId("P", e.target.value))}
              maxLength={4}
              disabled={saving}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Detailed problem statement…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Add Problem"}
        </button>
      </form>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : problems.length === 0 ? (
        <div className="empty-state" style={{ padding: "1.5rem 0" }}>
          <p>No problems added yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Problem ID</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => (
                <tr key={p.id ?? p.problemId}>
                  <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{p.problemId}</td>
                  <td style={{ fontSize: "0.85rem", color: "hsl(215 25% 30%)" }}>{p.description}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => p.id && handleDelete(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={() => !editSaving && setEditTarget(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Problem — {editTarget.problemId}</div>
              <button className="modal-close" onClick={() => !editSaving && setEditTarget(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {editError && (
                <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{editError}</div>
              )}
              <div className="form-group">
                <label className="form-label">Problem ID</label>
                <input
                  className="form-input"
                  value={editTarget.problemId}
                  readOnly
                  style={{ background: "hsl(var(--muted))" }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={editSaving}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditTarget(null)}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
