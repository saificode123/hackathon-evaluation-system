import { useEffect, useState } from "react";
import ExcelUploadCard from "./ExcelUploadCard";
import { parseExcelFile, parseTeamRows } from "../../lib/excelParse";
import {
  uploadTeamsFromExcel,
  deleteTeam,
  deleteAllTeams,
  type TeamUploadResult,
} from "../../lib/adminUpload";
import type { TeamRecord } from "../../lib/types";

interface TeamsUploadProps {
  onTeamsChanged?: () => void;
}

export default function TeamsUpload({ onTeamsChanged }: TeamsUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<TeamUploadResult[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const { fetchUniqueTeams } = await import("../../lib/adminUpload");
      const data = await fetchUniqueTeams();
      setTeams(data);
      onTeamsChanged?.();
    } catch {
      setError("Failed to load teams list.");
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => { loadTeams(); }, []);

  const handleFile = async (file: File) => {
    setError("");
    setSuccess("");
    setResults(null);

    try {
      const rows = await parseExcelFile(file);
      const parsed = parseTeamRows(rows);
      if (parsed.length === 0) {
        setError("No valid rows found. Check column headers: team id, team name, team lead name.");
        return;
      }

      setUploading(true);
      setProgress({ done: 0, total: parsed.length });
      const uploadResults = await uploadTeamsFromExcel(parsed, (done, total) =>
        setProgress({ done, total }),
      );
      setResults(uploadResults);
      const uploaded = uploadResults.filter((r) => r.status === "created").length;
      const skipped = uploadResults.filter((r) => r.status === "duplicate").length;
      setSuccess(
        skipped > 0
          ? `${uploaded} teams uploaded. ${skipped} duplicate Team ID${skipped !== 1 ? "s" : ""} skipped.`
          : `${uploaded} teams uploaded.`,
      );
      await loadTeams();
    } catch {
      setError("Failed to parse or upload file. Please check the format and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteOne = async (team: TeamRecord) => {
    if (!team.id) return;
    setDeletingId(team.id);
    setError("");
    setSuccess("");
    try {
      await deleteTeam(team.id);
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setSuccess(`Team ${team.teamId} deleted.`);
    } catch {
      setError(`Failed to delete team ${team.teamId}.`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirm.trim().toLowerCase() !== "delete all teams") {
      setError('Type exactly "delete all teams" to confirm.');
      return;
    }
    setDeletingAll(true);
    setError("");
    try {
      const count = await deleteAllTeams();
      setTeams([]);
      setResults(null);
      setSuccess(count > 0 ? `All ${count} teams deleted.` : "No teams to delete.");
      setShowDeleteAll(false);
      setDeleteAllConfirm("");
    } catch {
      setError("Failed to delete all teams. Check Firestore rules.");
    } finally {
      setDeletingAll(false);
    }
  };

  const filtered = teams.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.teamId.toLowerCase().includes(q) ||
      t.teamName.toLowerCase().includes(q) ||
      t.teamLeadName.toLowerCase().includes(q) ||
      (t.venue ?? "").toLowerCase().includes(q)
    );
  });

  const created = results?.filter((r) => r.status === "created").length ?? 0;
  const duplicates = results?.filter((r) => r.status === "duplicate").length ?? 0;
  const failed = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <>
      <ExcelUploadCard
        title="Upload Teams (Excel)"
        subtitle="Bulk-import up to 220 teams into Firestore."
        expectedColumns={["team id", "team name", "team lead name"]}
        optionalColumns={["Venue"]}
        uploading={uploading}
        progress={progress}
        onFileSelected={handleFile}
      >
        {error && <div className="alert alert-error" style={{ marginTop: "0.875rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginTop: "0.875rem" }}>{success}</div>}

        {results && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <span className="badge badge-green">{created} uploaded</span>
              {duplicates > 0 && <span className="badge badge-yellow">{duplicates} duplicate skipped</span>}
              {failed > 0 && <span className="badge badge-red">{failed} failed</span>}
            </div>
            {duplicates > 0 && (
              <ul style={{ fontSize: "0.82rem", color: "hsl(215 25% 35%)", margin: 0, paddingLeft: "1.25rem" }}>
                {results.filter((r) => r.status === "duplicate").slice(0, 10).map((r) => (
                  <li key={r.teamId}>{r.teamId} — {r.message}</li>
                ))}
                {duplicates > 10 && <li>…and {duplicates - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </ExcelUploadCard>

      {/* Teams management */}
      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div className="card-title">Uploaded Teams ({teams.length})</div>
            <div className="card-subtitle">View, search, or delete team records.</div>
          </div>
          {teams.length > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => { setShowDeleteAll(true); setDeleteAllConfirm(""); setError(""); }}
            >
              Delete All Teams
            </button>
          )}
        </div>

        {teams.length > 0 && (
          <div className="search-bar" style={{ marginBottom: "0.875rem" }}>
            <input
              type="search"
              className="form-input search-input"
              placeholder="Search by team ID, name, lead, or venue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {loadingTeams ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : teams.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.5rem 0" }}>
            <p>No teams uploaded yet. Use the Excel upload above.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Team ID</th>
                  <th>Team Name</th>
                  <th>Team Lead</th>
                  <th>Venue</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id ?? t.teamId}>
                    <td style={{ fontWeight: 600 }}>{t.teamId}</td>
                    <td>{t.teamName || "—"}</td>
                    <td>{t.teamLeadName || "—"}</td>
                    <td style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)" }}>{t.venue || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={deletingId === t.id}
                        onClick={() => handleDeleteOne(t)}
                      >
                        {deletingId === t.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete all confirmation modal */}
      {showDeleteAll && (
        <div className="modal-overlay" onClick={() => !deletingAll && setShowDeleteAll(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#dc2626" }}>Delete All Teams?</div>
              <button className="modal-close" onClick={() => !deletingAll && setShowDeleteAll(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              This will permanently delete all <strong>{teams.length}</strong> team records from Firestore.
              Evaluators will no longer see these teams in their dropdown.
            </p>
            <div className="form-group">
              <label className="form-label">
                Type <strong style={{ color: "#dc2626" }}>delete all teams</strong> to confirm:
              </label>
              <input
                className="form-input"
                value={deleteAllConfirm}
                onChange={(e) => setDeleteAllConfirm(e.target.value)}
                placeholder="delete all teams"
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
                disabled={deletingAll || deleteAllConfirm.trim().toLowerCase() !== "delete all teams"}
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
