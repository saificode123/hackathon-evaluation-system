import { useEffect, useMemo, useState } from "react";
import SearchableMultiSelect from "../SearchableMultiSelect";
import { saveEvaluatorTeamAssignment } from "../../lib/adminUpload";
import type { EvaluatorRecord, TeamRecord } from "../../lib/types";

function teamsForVenue(teams: TeamRecord[], venue: string): TeamRecord[] {
  const v = venue.trim().toLowerCase();
  if (!v) return teams;
  return teams.filter((t) => (t.venue ?? "").trim().toLowerCase() === v);
}

interface AssignTeamsModalProps {
  evaluator: EvaluatorRecord;
  teams: TeamRecord[];
  onClose: () => void;
  onSaved: (uid: string, teamIds: string[]) => void;
}

export default function AssignTeamsModal({
  evaluator,
  teams,
  onClose,
  onSaved,
}: AssignTeamsModalProps) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(evaluator.assignedTeamIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedTeamIds(evaluator.assignedTeamIds ?? []);
  }, [evaluator.uid, evaluator.assignedTeamIds]);

  const venueTeams = useMemo(
    () => teamsForVenue(teams, evaluator.venue),
    [teams, evaluator.venue],
  );

  const teamOptions = useMemo(
    () =>
      (venueTeams.length > 0 ? venueTeams : teams).map((t) => ({
        value: t.teamId,
        label: `${t.teamId}${t.teamName ? ` — ${t.teamName}` : ""}${t.venue ? ` (${t.venue})` : ""}`,
      })),
    [venueTeams, teams],
  );

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveEvaluatorTeamAssignment(evaluator.uid, selectedTeamIds, {
        name: evaluator.name,
        email: evaluator.email,
        venue: evaluator.venue,
      });
      onSaved(evaluator.uid, selectedTeamIds);
      onClose();
    } catch {
      setError("Failed to save. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Assign Teams — {evaluator.name}</div>
          <button className="modal-close" onClick={() => !saving && onClose()}>✕</button>
        </div>

        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "hsl(210 40% 96%)",
            borderRadius: 8,
            fontSize: "0.85rem",
          }}
        >
          Venue: <strong>{evaluator.venue || "—"}</strong>
          {" · "}
          {venueTeams.length} team{venueTeams.length !== 1 ? "s" : ""} at this venue
        </div>

        {venueTeams.length === 0 && (
          <div className="alert alert-info" style={{ marginBottom: "1rem", fontSize: "0.82rem" }}>
            No teams match venue <strong>{evaluator.venue}</strong>. Showing all teams instead.
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: "0.875rem" }}>{error}</div>}

        <SearchableMultiSelect
          label={`Teams for ${evaluator.name}`}
          options={teamOptions}
          selected={selectedTeamIds}
          onChange={setSelectedTeamIds}
          placeholder="Search team IDs…"
          emptyMessage="No teams match your search"
          disabled={saving}
        />

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
