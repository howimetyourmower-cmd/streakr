// lib/rounds.ts
export type RoundKey =
  | "OR"
  | "R1" | "R2" | "R3" | "R4" | "R5"
  | "R6" | "R7" | "R8" | "R9" | "R10"
  | "R11" | "R12" | "R13" | "R14" | "R15"
  | "R16" | "R17" | "R18" | "R19" | "R20"
  | "R21" | "R22" | "R23"
  | "FINALS";

export const ROUND_OPTIONS: { key: RoundKey; label: string }[] = [
  { key: "OR", label: "Opening Round" },
  { key: "R1", label: "Round 1" },
  { key: "R2", label: "Round 2" },
  { key: "R3", label: "Round 3" },
  { key: "R4", label: "Round 4" },
  { key: "R5", label: "Round 5" },
  { key: "R6", label: "Round 6" },
  { key: "R7", label: "Round 7" },
  { key: "R8", label: "Round 8" },
  { key: "R9", label: "Round 9" },
  { key: "R10", label: "Round 10" },
  { key: "R11", label: "Round 11" },
  { key: "R12", label: "Round 12" },
  { key: "R13", label: "Round 13" },
  { key: "R14", label: "Round 14" },
  { key: "R15", label: "Round 15" },
  { key: "R16", label: "Round 16" },
  { key: "R17", label: "Round 17" },
  { key: "R18", label: "Round 18" },
  { key: "R19", label: "Round 19" },
  { key: "R20", label: "Round 20" },
  { key: "R21", label: "Round 21" },
  { key: "R22", label: "Round 22" },
  { key: "R23", label: "Round 23" },
  { key: "FINALS", label: "Finals" },
];

export const CURRENT_SEASON = 2026;
