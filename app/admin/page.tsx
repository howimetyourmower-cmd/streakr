const ADMIN_TOOLS: AdminTool[] = [
  {
    title: "Rounds & publishing",
    description:
      "Upload questions for each round and control when they go live on the Picks page.",
    href: "/admin/rounds",
    badge: "Primary",
  },
  {
    title: "Season settings",
    description:
      "Set which round is currently active for AFL 2026. Updates live via Firestore.",
    href: "/admin/settings",
  },
  {
    title: "Settlement console",
    description:
      "Lock questions and settle results (YES / NO / VOID). Updates player streaks and picks.",
    href: "/admin/settlement",
  },
  {
    title: "Marketing list",
    description:
      "View all players who opted in to marketing and export your mailing list.",
    href: "/admin/marketing",
  },
];
