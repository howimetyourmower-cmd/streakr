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
  basketball: {
    name: "Basketball",
    icon: "/sports/basketball.svg",
  },
  tennis: {
    name: "Tennis",
    icon: "/sports/tennis.svg",
  },
  ufc: {
    name: "UFC",
    icon: "/sports/ufc.svg",
   },
  golf: {
    name: "Golf",
    icon: "/sports/golf.svg",
 },
  soccer: {
    name: "Soccer",
    icon: "/sports/soccer.svg",
   },
  nfl: {
    name: "NFL",
    icon: "/sports/nfl.svg",
  },
} as const;

export type SportType = keyof typeof SPORTS;
