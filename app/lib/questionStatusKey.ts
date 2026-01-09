// /lib/questionStatusKey.ts
export function inferRoundNumberFromQuestionId(questionId: string): number | null {
  const q = String(questionId || "").trim().toUpperCase();
  if (!q) return null;

  if (q.startsWith("OR-")) return 0;

  const m = q.match(/^R(\d+)-/);
  if (m?.[1]) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

export function questionStatusDocId(roundNumber: number, questionId: string) {
  return `${roundNumber}__${questionId}`;
}
