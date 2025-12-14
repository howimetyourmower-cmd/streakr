// app/seed/page.tsx
"use client";

import { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient explains;

const DEFAULT_AFL_JSON = {
  round: 1,
  season: 2026,
  games: [
    {
      match: "Carlton v Brisbane",
      venue: "MCG, Melbourne",
      startTime: "2026-03-05T19:30:00+11:00",
      questions: [
        {
          id: "carlton-v-brisbane-q1-1",
          quarter: 1,
          question:
            "Will Lachie Neale get 7 or more disposals in the 1st quarter?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "carlton-v-brisbane-q2-2",
          quarter: 2,
          question: "Will Charlie Curnow kick a goal in the 2nd quarter?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "carlton-v-brisbane-q3-3",
          quarter: 3,
          question:
            "Will Patrick Cripps get 6 or more disposals in the 3rd quarter?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "carlton-v-brisbane-q4-4",
          quarter: 4,
          question: "Will Brisbane win the match?",
          status: "open",
          isSponsorQuestion: false,
        },
      ],
    },
  ],
};

const DEFAULT_BBL_JSON = {
  roundNumber: 0,
  season: 2025,
  label: "BBL Match",
  sport: "BBL",
  games: [
    {
      match: "Perth Scorchers v Sydney Sixers",
      venue: "Optus Stadium",
      startTime: "2025-12-14T19:15:00+08:00",
      questions: [
        {
          id: "BBL-Q01",
          quarter: 0,
          question: "Will the Perth Scorchers win the bat flip?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q02",
          quarter: 0,
          question:
            "Will 7 or more runs be scored in the first over of the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q03",
          quarter: 0,
          question: "Will a wicket fall within the first 2 overs?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q04",
          quarter: 0,
          question: "Will Mitch Marsh score 20 or more runs in the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q05",
          quarter: 0,
          question: "Will Ben Dwarshuis take 2 or more wickets in the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q06",
          quarter: 0,
          question: "Will the first innings total exceed 168 runs?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q07",
          quarter: 0,
          question: "Will a batter score 50 or more runs in the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q08",
          quarter: 0,
          question: "Will either team hit 10 or more sixes in the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q09",
          quarter: 0,
          question: "Will a bowler take 3 or more wickets in the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q10",
          quarter: 0,
          question: "Will the team batting second successfully chase the target?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q11",
          quarter: 0,
          question: "Will a run-out occur during the match?",
          status: "open",
          isSponsorQuestion: false,
        },
        {
          id: "BBL-Q12",
          quarter: 0,
          question:
            "Will the winning team win by 20 or more runs (or 4 or more wickets)?",
          status: "open",
          isSponsorQuestion: false,
        },
      ],
    },
  ],
};

type SeedCollection = "games" | "rounds" | "cricketRounds";

export default function SeedPage() {
  const [seedCollection, setSeedCollection] = useState<SeedCollection>("games");
  const [jsonText, setJsonText] = useState(
    JSON.stringify(DEFAULT_AFL_JSON, null, 2)
  );
  const [status, setStatus] = useState("");
  const [docId, setDocId] = useState("round-1");

  function loadTemplate(kind: "AFL" | "BBL") {
    const template = kind === "AFL" ? DEFAULT_AFL_JSON : DEFAULT_BBL_JSON;
    setJsonText(JSON.stringify(template, null, 2));
    setStatus("");
    if (kind === "BBL") {
      setSeedCollection("cricketRounds");
      setDocId("BBL-2025-12-14-SCO-VS-SIX");
    } else {
      setSeedCollection("games");
      setDocId("round-1");
    }
  }

  async function handleSeed() {
    try {
      const parsed
