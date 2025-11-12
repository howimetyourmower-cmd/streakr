"use client";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, collectionGroup, doc, getDoc, getDocs, limit, query, runTransaction,
  updateDoc, where
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import FreeKickModal from "@/components/FreeKickModal";
import { showToast } from "@/lib/toast";

/**
 * Works with either of these:
 *  A) rounds/{roundId}/picks/{pickId}
 *  B) users/{uid}/picks/{pickId}
 *
 * We query with collectionGroup("picks") so you don't need to rearrange.
 *
 * Required fields on each pick:
 *  - uid: string
 *  - outcome: "pending"|"won"|"lost"|"void"
 *  - freeKickOffered: boolean (default false)
 *  - freeKickApplied: boolean (default false)
 *  - streakBeforeLoss?: number   // optional helper
 *
 * Required fields on users/{uid}:
 *  - freeKickCount: number
 *  - streak: number
 */
const PICKS_GROUP = "picks"; // <- collectionGroup name

export default function FreeKickWatcher() {
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const targetPickPath = useRef<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null)), []);

  useEffect(() => {
    if (!uid) return;
    let stop = false;

    const check = async () => {
      try {
        const uRef = doc(db, "users", uid);
        const uSnap = await getDoc(uRef);
        const freeKicks = uSnap.exists() ? Number(uSnap.data()?.freeKickCount ?? 0) : 0;
        if (freeKicks <= 0) return;

        // ---- CHOOSE ONE (default uses collectionGroup and works for both A & B) ----
        const qP = query(
          collectionGroup(db, PICKS_GROUP),                           // <- A or B (nested)
          where("uid", "==", uid),
          where("outcome", "==", "lost"),
          where("freeKickOffered", "==", false),
          limit(1)
        );

        // If your picks are a flat top-level "userPicks", use this instead:
        // const qP = query(
        //   collection(db, "userPicks"),
        //   where("uid","==", uid),
        //   where("outcome","==","lost"),
        //   where("freeKickOffered","==", false),
        //   limit(1)
        // );

        const snap = await getDocs(qP);
        if (stop) return;
        if (!snap.empty) {
          targetPickPath.current = snap.docs[0].ref.path; // works with collectionGroup
          setOpen(true);
        }
      } catch (e) {
        console.error("[FreeKickWatcher] poll error:", e);
      }
    };

    check();
    const id = setInterval(check, 15000);
    return () => { stop = true; clearInterval(id); };
  }, [uid]);

  const markOffered = async () => {
    if (!targetPickPath.current) return;
    try { await updateDoc(doc(db, targetPickPath.current), { freeKickOffered: true }); } catch {}
  };

  const onUse = async () => {
    if (!uid || !targetPickPath.current) return;
    const pRef = doc(db, targetPickPath.current);
    const uRef = doc(db, "users", uid);

    try {
      await runTransaction(db, async (tx) => {
        const [uSnap, pSnap] = await Promise.all([tx.get(uRef), tx.get(pRef)]);
        if (!uSnap.exists()) throw new Error("User not found");
        if (!pSnap.exists()) throw new Error("Pick not found");

        const freeKicks = Number(uSnap.data().freeKickCount ?? 0);
        if (freeKicks <= 0) throw new Error("No Free Kicks left");

        const pick = pSnap.data();
        if (pick.outcome !== "lost" || pick.freeKickOffered === true) throw new Error("Not eligible");

        const currentStreak = Number(uSnap.data().streak ?? 0);
        const restored = typeof pick.streakBeforeLoss === "number"
          ? Math.max(currentStreak, Number(pick.streakBeforeLoss))
          : currentStreak;

        tx.update(pRef, {
          freeKickOffered: true,
          freeKickApplied: true,
          outcome: "void", // treat the loss as not breaking the streak
        });
        tx.update(uRef, { freeKickCount: freeKicks - 1, streak: restored });
      });

      setOpen(false);
      showToast({ kind: "success", msg: "Free Kick used, your streak has been revived. Make your next pick." });
    } catch (e) {
      console.error("[FreeKickWatcher] use failed:", e);
      setOpen(false);
      showToast({ kind: "error", msg: "Free Kick failed. Please try again." });
    } finally {
      targetPickPath.current = null;
    }
  };

  const onEnd = async () => {
    if (!uid || !targetPickPath.current) return;
    const pRef = doc(db, targetPickPath.current);
    const uRef = doc(db, "users", uid);

    try {
      await runTransaction(db, async (tx) => {
        const pSnap = await tx.get(pRef);
        if (!pSnap.exists()) throw new Error("Pick not found");
        const pick = pSnap.data();
        if (pick.outcome !== "lost" || pick.freeKickOffered === true) return;

        tx.update(pRef, { freeKickOffered: true, freeKickApplied: false });
        const uSnap = await tx.get(uRef);
        if (uSnap.exists()) tx.update(uRef, { streak: 0 });
      });

      setOpen(false);
      showToast({ kind: "info", msg: "Streak lost, make your next pick now." });
    } catch (e) {
      console.error("[FreeKickWatcher] end failed:", e);
      setOpen(false);
    } finally {
      targetPickPath.current = null;
    }
  };

  // Ensure we don’t leave a dangling “offered=false” if the user closes tab
  useEffect(() => { if (!open) markOffered(); }, [open]);

  return <FreeKickModal open={open} onUse={onUse} onEnd={onEnd} />;
}
