import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { fetchCollectionOnce, fetchUniqueTeams } from "./adminUpload";
import type { EvaluatorRecord, ProblemRecord, TeamRecord } from "./types";

interface EvaluatorDataContextValue {
  teams: TeamRecord[];
  problems: ProblemRecord[];
  evaluators: EvaluatorRecord[];
  myProfile: EvaluatorRecord | null;
  assignedTeams: TeamRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EvaluatorDataContext = createContext<EvaluatorDataContextValue | null>(null);

export function resolveAssignedTeams(
  profile: EvaluatorRecord | null,
  userVenue: string | undefined,
  allTeams: TeamRecord[],
): TeamRecord[] {
  if (allTeams.length === 0) return [];

  const assignedIds = profile?.assignedTeamIds ?? [];

  // Admin explicitly assigned teams — show only those
  if (assignedIds.length > 0) {
    return allTeams.filter((t) =>
      assignedIds.some((id) => id.trim().toLowerCase() === t.teamId.trim().toLowerCase()),
    );
  }

  // Fallback: teams matching evaluator venue
  const venue = (profile?.venue || userVenue || "").trim().toLowerCase();
  if (venue.length > 0) {
    const byVenue = allTeams.filter((t) => (t.venue ?? "").trim().toLowerCase() === venue);
    if (byVenue.length > 0) return byVenue;
  }

  return allTeams;
}

export function EvaluatorDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [problems, setProblems] = useState<ProblemRecord[]>([]);
  const [evaluators, setEvaluators] = useState<EvaluatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamsData, problemsData, evaluatorsData] = await Promise.all([
        fetchUniqueTeams(),
        fetchCollectionOnce("problems", (id, data) => ({
          id,
          problemId: String(data.problemId ?? id),
          description: String(data.description ?? ""),
          createdAt: String(data.createdAt ?? ""),
        })),
        fetchCollectionOnce("evaluators", (id, data) => ({
          id,
          uid: String(data.uid ?? id),
          srNo: data.srNo as number | undefined,
          name: String(data.name ?? ""),
          email: String(data.email ?? ""),
          password: String(data.password ?? ""),
          venue: String(data.venue ?? ""),
          assignedTeamIds: Array.isArray(data.assignedTeamIds)
            ? (data.assignedTeamIds as string[])
            : [],
          createdAt: String(data.createdAt ?? ""),
        })),
      ]);

      setTeams(teamsData);
      setProblems(problemsData.sort((a, b) => a.problemId.localeCompare(b.problemId)));
      setEvaluators(evaluatorsData);
    } catch {
      setError("Failed to load reference data. You can still enter details manually.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "evaluator") {
      loadAll();
    }
  }, [user?.uid, user?.role]);

  const myProfile = useMemo(() => {
    if (!user) return null;
    return evaluators.find((e) => e.uid === user.uid || e.email === user.email) ?? null;
  }, [evaluators, user]);

  const userVenue = (user as { venue?: string } | null)?.venue;

  const assignedTeams = useMemo(
    () => resolveAssignedTeams(myProfile, userVenue, teams),
    [myProfile, userVenue, teams],
  );

  return (
    <EvaluatorDataContext.Provider
      value={{
        teams,
        problems,
        evaluators,
        myProfile,
        assignedTeams,
        loading,
        error,
        refresh: loadAll,
      }}
    >
      {children}
    </EvaluatorDataContext.Provider>
  );
}

export function useEvaluatorData() {
  const ctx = useContext(EvaluatorDataContext);
  if (!ctx) {
    throw new Error("useEvaluatorData must be used within EvaluatorDataProvider");
  }
  return ctx;
}

export function useEvaluatorDataOptional() {
  return useContext(EvaluatorDataContext);
}
