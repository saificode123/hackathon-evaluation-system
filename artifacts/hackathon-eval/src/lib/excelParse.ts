import * as XLSX from "xlsx";

/** Normalize header strings for flexible column matching. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/** Read the first sheet of an Excel/CSV file into row objects keyed by normalized headers. */
export async function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = String(value ?? "").trim();
    }
    return normalized;
  });
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[normalizeHeader(key)];
    if (val) return val;
  }
  return "";
}

export interface ParsedEvaluatorRow {
  srNo: number;
  name: string;
  venue: string;
  assignedTeamIds: string[];
}

export interface ParsedTeamRow {
  teamId: string;
  teamName: string;
  teamLeadName: string;
  venue: string;
}

export function parseEvaluatorRows(rows: Record<string, string>[]): ParsedEvaluatorRow[] {
  return rows
    .map((row, index) => {
      const name = pick(row, "evaluatorname", "evaluator name", "name");
      if (!name) return null;

      const srRaw = pick(row, "sr no", "srno", "s no", "serial");
      const srNo = srRaw ? Number(srRaw) : index + 1;
      const venue = pick(row, "venue");
      const teamsRaw = pick(row, "team ids", "team id", "assigned teams", "teams");
      const assignedTeamIds = teamsRaw
        ? teamsRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
        : [];

      return { srNo, name, venue, assignedTeamIds };
    })
    .filter((r): r is ParsedEvaluatorRow => r !== null);
}

export function parseTeamRows(rows: Record<string, string>[]): ParsedTeamRow[] {
  return rows
    .map((row) => {
      const teamId = pick(row, "team id", "teamid", "id");
      if (!teamId) return null;

      return {
        teamId,
        teamName: pick(row, "team name", "teamname", "name"),
        teamLeadName: pick(row, "team lead name", "team lead", "teamlead", "lead"),
        venue: pick(row, "venue"),
      };
    })
    .filter((r): r is ParsedTeamRow => r !== null);
}
