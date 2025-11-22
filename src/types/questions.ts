export type QuestionStatus = "open" | "pending" | "final" | "void";

export interface ApiQuestion {
  id: string;
  quarter: number;
  question: string;
  status: QuestionStatus;
  sport: string;
  match: string;
  venue: string;
  startTime: string;
  commentCount?: number;
  yesPercent?: number;
  noPercent?: number;
  userPick?: "yes" | "no";
}

export interface ApiGame {
  id: string;
  match: string;
  venue: string;
  startTime: string;
  sport: string;
  questions: ApiQuestion[];
}
