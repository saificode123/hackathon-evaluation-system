import { useEffect, useState } from "react";
import ExcelUploadCard from "./ExcelUploadCard";
import { parseExcelFile, parseEvaluatorRows } from "../../lib/excelParse";
import {
  uploadEvaluatorsFromExcel,
  deleteEvaluator,
  deleteAllEvaluators,
  fetchAllEvaluatorsForAdmin,
  fetchUniqueTeams,
  type EvaluatorUploadResult,
} from "../../lib/adminUpload";
import type { EvaluatorRecord, TeamRecord } from "../../lib/types";
import AssignTeamsModal from "./AssignTeamsModal";

const DELETE_ONE_CONFIRM = "i want to delete";
const DELETE_ALL_CONFIRM = "yes i want to delete";

export default function EvaluatorsUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<EvaluatorUploadResult[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [evaluators, setEvaluators] = useState<EvaluatorRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<EvaluatorRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EvaluatorRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);

  const loadEvaluators = async () => {
    setLoadingList(true);
    try {
      const [evaluatorsData, teamsData] = await Promise.all([
        fetchAllEvaluatorsForAdmin(),
        fetchUniqueTeams(),
      ]);
      setEvaluators(evaluatorsData);
      setTeams(teamsData);
    } catch {
      setError("Failed to load evaluators list.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadEvaluators(); }, []);

  const handleFile = async (file: File) => {
    setError("");
    setSuccess("");
    setResults(null);

    try {
      const rows = await parseExcelFile(file);
      const parsed = parseEvaluatorRows(rows);
      if (parsed.length === 0) {
        setError("No valid rows found. Check column headers: Sr. No, EvaluatorName, Venue.");
        return;
      }

      setUploading(true);
      setProgress({ done: 0, total: parsed.length });
      const uploadResults = await uploadEvaluatorsFromExcel(parsed, (done, total) =>
        setProgress({ done, total }),
      );
      setResults(uploadResults);
      const uploaded = uploadResults.filter((r) => r.status === "created").length;
      const skipped = uploadResults.filter((r) => r.status === "skipped").length;
      const failed = uploadResults.filter((r) => r.status === "error").length;
      setSuccess(
        skipped > 0 || failed > 0
          ? `${uploaded} evaluators created/updated.${skipped > 0 ? ` ${skipped} skipped.` : ""}${failed > 0 ? ` ${failed} failed.` : ""}`
          : `${uploaded} evaluators created.`,
      );
      await loadEvaluators();
    } catch {
      setError("Failed to parse or upload file. Please check the format and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim().toLowerCase() !== DELETE_ONE_CONFIRM) {
      setError(`Type exactly "${DELETE_ONE_CONFIRM}" to confirm.`);
      return;
    }
    setDeletingUid(deleteTarget.uid);
    setError("");
    try {
      await deleteEvaluator(deleteTarget.uid);
      setEvaluators((prev) => prev.filter((e) => e.uid !== deleteTarget.uid));
      setSuccess(`Evaluator "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      setDeleteConfirm("");
    } catch {
      setError(`Failed to delete evaluator "${deleteTarget.name}".`);
    } finally {
      setDeletingUid(null);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirm.trim().toLowerCase() !== DELETE_ALL_CONFIRM) {
      setError(`Type exactly "${DELETE_ALL_CONFIRM}" to confirm.`);
      return;
    }
    setDeletingAll(true);
    setError("");
    try {
      const count = await deleteAllEvaluators();
      setEvaluators([]);
      setResults(null);
      setSuccess(count > 0 ? `All ${count} evaluators deleted.` : "No evaluators to delete.");
      setShowDeleteAll(false);
      setDeleteAllConfirm("");
    } catch {
      setError("Failed to delete all evaluators. Check Firestore rules.");
    } finally {
      setDeletingAll(false);
    }
  };

  const downloadCredentials = () => {
    const source = evaluators.length > 0
      ? evaluators.map((e) => ({ name: e.name, email: e.email, password: e.password, venue: e.venue, status: "active" }))
      : results ?? [];
    if (source.length === 0) return;
    const header = "Name,Email,Password,Venue,Status\n";
    const body = source
      .map((r) => `"${r.name}","${r.email}","${r.password}","${r.venue}","${"status" in r ? r.status : "active"}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluator-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = evaluators.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.venue ?? "").toLowerCase().includes(q)
    );
  });

  const created = results?.filter((r) => r.status === "created").length ?? 0;
  const skipped = results?.filter((r) => r.status === "skipped").length ?? 0;
  const failed = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <>
      <ExcelUploadCard
        title="Upload Evaluators (Excel)"
        subtitle="Bulk-create up to 60 evaluator accounts with auto-generated credentials."
        expectedColumns={["Sr. No", "EvaluatorName", "Venue"]}
        optionalColumns={["Team IDs (comma-separated)"]}
        uploading={uploading}
        progress={progress}
        onFileSelected={handleFile}
      >
        {error && !deleteTarget && !showDeleteAll && (
          <div className="alert alert-error" style={{ marginTop: "0.875rem" }}>{error}</div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginTop: "0.875rem" }}>{success}</div>
        )}

        {results && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span className="badge badge-green">{created} created</span>
              {skipped > 0 && <span className="badge badge-yellow">{skipped} skipped</span>}
              {failed > 0 && <span className="badge badge-red">{failed} failed</span>}
            </div>
            {(skipped > 0 || failed > 0) && (
              <ul style={{ fontSize: "0.82rem", color: "hsl(215 25% 35%)", margin: 0, paddingLeft: "1.25rem" }}>
                {results
                  .filter((r) => r.status === "skipped" || r.status === "error")
                  .map((r) => (
                    <li key={`${r.email}-${r.message}`}>
                      <strong>{r.name}</strong> — {r.message ?? r.status}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "hsl(215 16% 47%)" }}>
          Preview format: Hassan Ali → hassan.ali@cust.edu.pk / ali.hassanhack2026
        </div>
      </ExcelUploadCard>

      {/* Evaluators management */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div className="card-title">All Evaluators ({evaluators.length})</div>
            <div className="card-subtitle">Excel-uploaded and manually created evaluators — assign teams, search, or delete.</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {evaluators.length > 0 && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={downloadCredentials}>
                  Download CSV
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => { setShowDeleteAll(true); setDeleteAllConfirm(""); setError(""); setSuccess(""); }}
                >
                  Delete All Evaluators
                </button>
              </>
            )}
          </div>
        </div>

        {evaluators.length > 0 && (
          <div className="search-bar" style={{ marginBottom: "0.875rem" }}>
            <input
              type="search"
              className="form-input search-input"
              placeholder="Search by name, email, or venue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {loadingList ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : evaluators.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.5rem 0" }}>
            <p>No evaluators uploaded yet. Use the Excel upload above.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Venue</th>
                  <th>Teams Assigned</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.uid}>
                    <td>{e.srNo ?? "—"}</td>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td style={{ fontSize: "0.82rem" }}>{e.email}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{e.password}</td>
                    <td>{e.venue || "—"}</td>
                    <td>
                      <span className="badge badge-blue">
                        {(e.assignedTeamIds ?? []).length} teams
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => { setAssignTarget(e); setError(""); setSuccess(""); }}
                        >
                          Assign Teams
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={deletingUid === e.uid}
                          onClick={() => { setDeleteTarget(e); setDeleteConfirm(""); setError(""); setSuccess(""); }}
                        >
                          {deletingUid === e.uid ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign teams modal */}
      {assignTarget && (
        <AssignTeamsModal
          evaluator={assignTarget}
          teams={teams}
          onClose={() => setAssignTarget(null)}
          onSaved={(uid, teamIds) => {
            setEvaluators((prev) =>
              prev.map((ev) => (ev.uid === uid ? { ...ev, assignedTeamIds: teamIds } : ev)),
            );
            setSuccess(`${teamIds.length} team${teamIds.length !== 1 ? "s" : ""} assigned to ${assignTarget.name}.`);
            setAssignTarget(null);
          }}
        />
      )}

      {/* Delete single evaluator modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deletingUid && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#dc2626" }}>Delete Evaluator?</div>
              <button className="modal-close" onClick={() => !deletingUid && setDeleteTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Permanently delete <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
              This removes their profile from the system.
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">
                Type <strong style={{ color: "#dc2626" }}>{DELETE_ONE_CONFIRM}</strong> to confirm:
              </label>
              <input
                className="form-input"
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setError(""); }}
                placeholder={DELETE_ONE_CONFIRM}
                disabled={!!deletingUid}
                autoComplete="off"
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={!!deletingUid}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteOne}
                disabled={!!deletingUid || deleteConfirm.trim().toLowerCase() !== DELETE_ONE_CONFIRM}
              >
                {deletingUid ? "Deleting…" : "Delete Evaluator"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete all evaluators modal */}
      {showDeleteAll && (
        <div className="modal-overlay" onClick={() => !deletingAll && setShowDeleteAll(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#dc2626" }}>Delete All Evaluators?</div>
              <button className="modal-close" onClick={() => !deletingAll && setShowDeleteAll(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              This will permanently delete all <strong>{evaluators.length}</strong> evaluator records
              from Firestore. They will no longer be able to log in.
            </p>
            {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">
                Type <strong style={{ color: "#dc2626" }}>{DELETE_ALL_CONFIRM}</strong> to confirm:
              </label>
              <input
                className="form-input"
                value={deleteAllConfirm}
                onChange={(e) => { setDeleteAllConfirm(e.target.value); setError(""); }}
                placeholder={DELETE_ALL_CONFIRM}
                disabled={deletingAll}
                autoComplete="off"
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteAll(false)} disabled={deletingAll}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAll}
                disabled={deletingAll || deleteAllConfirm.trim().toLowerCase() !== DELETE_ALL_CONFIRM}
              >
                {deletingAll ? "Deleting…" : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
