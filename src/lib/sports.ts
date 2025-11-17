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
    icon: "/sports/nba.svg",
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
    name: "soccer",
    icon: "/sports/soccer.svg",
   },
  nfl: {
    name: "nfl",
    icon: "/sports/nfl.svg",
  },
} as const;

export type SportType = keyof typeof SPORTS;
