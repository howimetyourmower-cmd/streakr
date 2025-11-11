"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import React, { useState, useEffect, Suspense } from "react";
import { db } from "@/lib/firebaseClient";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import "dayjs/locale/en";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

const LOCAL_TZ = "Australia/Melbourne";

function PicksContent() {
  const [picks, setPicks] = useState<PickData[]>([]);

  useEffect(() => {
    const fetchPicks = async () => {
      try {
        const roundsRef = collection(db, "rounds");
        const q = query(roundsRef, orderBy("match", "asc"));
        const snapshot = await getDocs(q);
        const data: = PickData[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data() as Omit<PickData, "id">),
        }));
        setPicks(data);
      } catch (error) {
        console.error("Error fetching picks:", error);
      }
    };
    fetchPicks();
  }, []);

  const formatDate = (raw) => {
    if (!raw) return "TBD";
    try {
      const d = dayjs(raw).tz(LOCAL_TZ);
      return d.isValid() ? d.format("ddd, D MMM h:mm A z") : "TBD";
    } catch {
      return "TBD";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 text-white">
      <h1 className="text-3xl font-bold mb-6">Make Picks</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm md:text-base">
          <thead>
            <tr className="text-left border-b border-gray-600 text-gray-300">
              <th className="p-2">START</th>
              <th className="p-2">MATCH · VENUE</th>
              <th className="p-2">Q#</th>
              <th className="p-2">QUESTION</th>
              <th className="p-2 text-center">YES %</th>
              <th className="p-2 text-center">NO %</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick) => (
              <tr
                key={pick.id}
                className="border-b border-gray-700 hover:bg-gray-800 transition"
              >
                <td className="p-2">
                  {pick.startTime ? formatDate(pick.startTime) : "TBD"}
                  <div className="mt-1">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        pick.status === "open"
                          ? "bg-green-700 text-green-200"
                          : pick.status === "pending"
                          ? "bg-yellow-700 text-yellow-200"
                          : pick.status === "final"
                          ? "bg-blue-700 text-blue-200"
                          : pick.status === "void"
                          ? "bg-red-700 text-red-200"
                          : "bg-gray-700 text-gray-200"
                      }`}
                    >
                      {pick.status?.toUpperCase() || "OPEN"}
                    </span>
                  </div>
                </td>

                <td className="p-2">
                  <div className="font-semibold text-orange-400">
                    {pick.match || "TBD"}
                  </div>
                  <div className="text-xs text-gray-400">{pick.venue || ""}</div>
                </td>

                <td className="p-2 font-semibold text-gray-300">
                  {pick.quarter || "Q?"}
                </td>

                <td className="p-2 font-bold">{pick.question}</td>

                <td className="p-2 text-center text-green-400">
                  {pick.yesPercentage ?? "0%"}
                </td>
                <td className="p-2 text-center text-purple-400">
                  {pick.noPercentage ?? "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PicksPage() {
  return (
    <Suspense fallback={<div className="text-center text-white mt-10">Loading...</div>}>
      <PicksContent />
    </Suspense>
  );
}
