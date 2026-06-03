import { getTeamEvaluationProgress } from "../lib/settings";

interface Props {
  totalTeams: number;
  evaluatedTeams: number;
  /** Shown on coordinator view when admin has not configured total yet. */
  showUnsetHint?: boolean;
}

export default function TeamEvaluationProgress({
  totalTeams,
  evaluatedTeams,
  showUnsetHint = false,
}: Props) {
  const progress = getTeamEvaluationProgress(totalTeams, evaluatedTeams);

  if (totalTeams <= 0) {
    return (
      <div
        className="alert"
        style={{
          marginBottom: 0,
          background: "hsl(45 93% 94%)",
          border: "1px solid hsl(45 93% 70%)",
          color: "hsl(32 95% 30%)",
          fontSize: "0.85rem",
        }}
      >
        {showUnsetHint
          ? "Total teams not configured yet. Ask an Admin to set the team count on the Admin Dashboard."
          : "Set the total number of teams below so Coordinators can track remaining evaluations."}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(215 16% 47%)", fontWeight: 600 }}>
            Total Teams
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>{progress.totalTeams}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(215 16% 47%)", fontWeight: 600 }}>
            Evaluated
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>{progress.evaluatedTeams}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(215 16% 47%)", fontWeight: 600 }}>
            Remaining
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: progress.remaining > 0 ? "#d97706" : "#10b981",
            }}
          >
            {progress.remaining}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "0.35rem", display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
        <span style={{ color: "hsl(215 16% 47%)" }}>Evaluation progress</span>
        <span style={{ fontWeight: 700 }}>{progress.percentComplete}%</span>
      </div>
      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "hsl(var(--muted))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress.percentComplete}%`,
            borderRadius: 999,
            background: progress.isComplete
              ? "linear-gradient(90deg, #10b981, #059669)"
              : "linear-gradient(90deg, hsl(221 83% 53%), #6366f1)",
            transition: "width 0.35s ease",
          }}
        />
      </div>
      <p style={{ marginTop: "0.65rem", marginBottom: 0, fontSize: "0.8rem", color: "hsl(215 16% 47%)" }}>
        {progress.isComplete
          ? "All teams have at least one evaluation on record."
          : `${progress.remaining} team${progress.remaining !== 1 ? "s" : ""} still need evaluation${progress.remaining !== 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
