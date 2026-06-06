import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "../SearchableSelect";
import SearchableMultiSelect from "../SearchableMultiSelect";
import {
  fetchCollectionOnce,
  fetchUniqueTeams,
  saveEvaluatorTeamAssignment,
} from "../../lib/adminUpload";
import type { EvaluatorRecord, TeamRecord } from "../../lib/types";

function teamsForVenue(teams: TeamRecord[], venue: string): TeamRecord[] {
  const v = venue.trim().toLowerCase();
  if (!v) return teams;
  return teams.filter((t) => (t.venue ?? "").trim().toLowerCase() === v);
}

export default function EvaluatorTeamAssignment() {
  const [evaluators, setEvaluators] = useState<EvaluatorRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [evaluatorsData, teamsData] = await Promise.all([
        fetchCollectionOnce("evaluators", (id, d) => ({
          id,
          uid: String(d.uid ?? id),
          srNo: d.srNo as number | undefined,
          name: String(d.name ?? ""),
          email: String(d.email ?? ""),
          password: String(d.password ?? ""),
          venue: String(d.venue ?? ""),
          assignedTeamIds: Array.isArray(d.assignedTeamIds) ? (d.assignedTeamIds as string[]) : [],
        })),
        fetchUniqueTeams(),
      ]);
      setEvaluators(
        evaluatorsData.sort((a, b) => (a.srNo ?? 0) - (b.srNo ?? 0) || a.name.localeCompare(b.name)),
      );
      setTeams(teamsData.sort((a, b) => a.teamId.localeCompare(b.teamId)));
    } catch {
      setError("Failed to load evaluators or teams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectedEvaluator = evaluators.find((e) => e.uid === selectedUid) ?? null;

  useEffect(() => {
    if (selectedEvaluator) {
      setSelectedTeamIds(selectedEvaluator.assignedTeamIds ?? []);
    } else {
      setSelectedTeamIds([]);
    }
  }, [selectedEvaluator?.uid]);

  const venueTeams = useMemo(() => {
    if (!selectedEvaluator) return [];
    return teamsForVenue(teams, selectedEvaluator.venue);
  }, [teams, selectedEvaluator]);

  const teamOptions = useMemo(
    () =>
      venueTeams.map((t) => ({
        value: t.teamId,
        label: `${t.teamId}${t.teamName ? ` — ${t.teamName}` : ""}`,
      })),
    [venueTeams],
  );

  const evaluatorOptions = evaluators.map((e) => ({
    value: e.uid,
    label: `${e.name} (${e.venue || "No venue"})`,
  }));

  const handleSave = async () => {
    if (!selectedEvaluator) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveEvaluatorTeamAssignment(selectedEvaluator.uid, selectedTeamIds);
      setEvaluators((prev) =>
        prev.map((e) =>
          e.uid === selectedEvaluator.uid ? { ...e, assignedTeamIds: [...selectedTeamIds] } : e,
        ),
      );
      setSuccess(
        `${selectedTeamIds.length} team${selectedTeamIds.length !== 1 ? "s" : ""} assigned to ${selectedEvaluator.name}.`,
      );
    } catch {
      setError("Failed to save team assignment. Check Firestore rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Assign Teams to Evaluators</div>
        <div className="card-subtitle">
          Pick an evaluator — only teams matching their venue appear in the list (searchable).
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: "0.875rem" }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: "0.875rem" }}>{success}</div>}

      {loading ? (
        <div className="loading-center"><div className="loading-spinner" /></div>
      ) : evaluators.length === 0 ? (
        <div className="empty-state" style={{ padding: "1.5rem 0" }}>
          <p>Upload evaluators first, then assign teams here.</p>
        </div>
      ) : (
        <>
          <SearchableSelect
            label="Evaluator"
            value={selectedUid}
            onChange={setSelectedUid}
            options={evaluatorOptions}
            placeholder="Search evaluators…"
            emptyMessage="No evaluators match your search"
          />

          {selectedEvaluator && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                background: "hsl(210 40% 96%)",
                borderRadius: 8,
                fontSize: "0.85rem",
              }}
            >
              <strong>{selectedEvaluator.name}</strong>
              {" · "}
              Venue: <strong>{selectedEvaluator.venue || "—"}</strong>
              {" · "}
              {venueTeams.length} team{venueTeams.length !== 1 ? "s" : ""} at this venue
            </div>
          )}

          {selectedEvaluator && (
            <>
              {venueTeams.length === 0 ? (
                <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
                  No teams found for venue <strong>{selectedEvaluator.venue}</strong>.
                  Upload teams with matching Venue column, or assign teams without venue filter from all teams below.
                </div>
              ) : null}

              <SearchableMultiSelect
                label={`Teams at ${selectedEvaluator.venue || "all venues"}`}
                options={
                  venueTeams.length > 0
                    ? teamOptions
                    : teams.map((t) => ({
                        value: t.teamId,
                        label: `${t.teamId} — ${t.teamName || t.teamLeadName || "Team"} (${t.venue || "no venue"})`,
                      }))
                }
                selected={selectedTeamIds}
                onChange={setSelectedTeamIds}
                placeholder="Search team IDs…"
                emptyMessage="No teams match your search"
              />

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Assignment"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
