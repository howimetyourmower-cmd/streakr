// src/lib/sports.ts
export const SPORTS = {
  afl: {
    name: "AFL",
    icon: "/sports/afl.svg",
  },
  nrl: {
    name: "NRL",
    icon: "/sports/nrl.svg",
  },
  cricket: {
    name: "Cricket",
    icon: "/sports/cricket.svg",
  },
  nba: {
    name: "NBA",
    icon: "/sports/basketball.svg", // matches basketball.svg
  },
  tennis: {
    name: "Tennis",
    icon: "/sports/tennis.svg",
  },
  ufc: {
    name: "UFC",
    icon: "/sports/ufc.svg",
  },
  soccer: {
    name: "Soccer",
    icon: "/sports/soccer.svg",
  },
  golf: {
    name: "Golf",
    icon: "/sports/golf.svg",
  },
  nfl: {
    name: "NFL",
    icon: "/sports/nfl.svg",
  },
} as const;

export type SportType = keyof typeof SPORTS;
