// app/components/FreeKickWatcher.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebaseClient";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import FreeKickModal from "./FreeKickModal";

/**
 * What this does (safe-by-default, no schema assumptions):
 * - Watches for a "loss" event under users/{uid}/events where:
 *     { type: "LOSS", processed: false }
 * - When found, checks users/{uid} for a free kick flag:
 *     { freeKick: { available: number } } OR { hasFreeKick: boolean }
 * - If available, shows modal; user can "Use Free Kick" or "Let it End".
 * - Writes the outcome back:
 *     - Use: marks event.processed=true, event.action="revived"
 *            and decrements available / clears hasFreeKick
 *     - End: marks event.processed=true, event.action="ended"
 *            and (optionally) sets currentStreak=0 if that field exists
 *
 * If your field names differ, this still compiles and runs; it just
 * won’t find the fields until you add them.
 */

type LossEvent = {
  id: string;
  type?: string;
  processed?: boolean;
  questionId?: string;
  roundId?: string;
  createdAt?: any;
};

export default function FreeKickWatcher() {
  const [user, setUser] = useState<User | null>(null);
  const [pendingEvent, setPendingEvent] = useState<LossEvent | null>(null);
  const [canOffer, setCanOffer] = useState(false);
  const checkingRef = useRef(false);

  // auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // subscribe to loss events for this user
  useEffect(() => {
    if (!user) return;
    const evCol = collection(db, "users", user.uid, "events");
    const q = query(evCol, where("type", "==", "LOSS"), where("processed", "==", false), limit(1));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) return;
        const d = snap.docs[0];
        const event: LossEvent = { id: d.id, ...(d.data() as any) };

        // guard against overlapping checks
        if (checkingRef.current) return;
        checkingRef.current = true;

        try {
          // does user have a free kick available?
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const udata: any = userDoc.exists() ? userDoc.data() : {};
          const available =
            (udata?.freeKick?.available as number | undefined) ??
            (udata?.hasFreeKick ? 1 : 0);

          setCanOffer((available ?? 0) > 0);
          setPendingEvent(event);
        } catch (e) {
          // even if user read fails, still surface the modal as "not available"
          setCanOffer(false);
          setPendingEvent(event);
        } finally {
          checkingRef.current = false;
        }
      },
      // ignore
      () => {}
    );

    return () => unsub();
  }, [user]);

  const clearEvent = useCallback(() => setPendingEvent(null), []);

  const handleUse = useCallback(async () => {
    if (!user || !pendingEvent) return;

    const userRef = doc(db, "users", user.uid);
    const evRef = doc(db, "users", user.uid, "events", pendingEvent.id);

    try {
      // atomically mark processed first to avoid duplicate prompts
      await updateDoc(evRef, { processed: true, action: "revived" }).catch(() => {});

      // Try both shapes safely
      const u = await getDoc(userRef);
      if (u.exists()) {
        const data = u.data() as any;
        if (typeof data?.freeKick?.available === "number") {
          await updateDoc(userRef, {
            "freeKick.available": Math.max(0, (data.freeKick.available as number) - 1),
            // optionally track usage
            "freeKick.used": Math.max(0, Number(data?.freeKick?.used ?? 0)) + 1,
          }).catch(() => {});
        } else if (data?.hasFreeKick === true) {
          await updateDoc(userRef, { hasFreeKick: false }).catch(() => {});
        }
        // optionally keep currentStreak unchanged (revived)
      }

      // toast-like feedback (uses your global Toast if you wire an event)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { title: "Free Kick used", message: "Your streak has been revived." },
          })
        );
      }
    } finally {
      clearEvent();
    }
  }, [user, pendingEvent, clearEvent]);

  const handleDismiss = useCallback(async () => {
    if (!user || !pendingEvent) return;

    const userRef = doc(db, "users", user.uid);
    const evRef = doc(db, "users", user.uid, "events", pendingEvent.id);

    try {
      await updateDoc(evRef, { processed: true, action: "ended" }).catch(() => {});

      // If your schema tracks streak:
      const u = await getDoc(userRef);
      if (u.exists()) {
        const data = u.data() as any;
        if (typeof data?.currentStreak === "number") {
          await updateDoc(userRef, { currentStreak: 0 }).catch(() => {});
        }
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("toast", {
            detail: { title: "Streak ended", message: "Start a new streak with your next pick." },
          })
        );
      }
    } finally {
      clearEvent();
    }
  }, [user, pendingEvent, clearEvent]);

  // When there’s no event or no free kick to offer, render nothing
  return (
    <FreeKickModal
      open={Boolean(pendingEvent && canOffer)}
      onUse={handleUse}
      onDismiss={handleDismiss}
      title="Your streak just lost… use your FREE KICK?"
      message="Use your Free Kick to revive your streak and keep it alive. If you’d rather save it, you can let this streak end and start a new run."
    />
  );
}
