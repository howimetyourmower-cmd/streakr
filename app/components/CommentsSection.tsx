"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, User } from "firebase/auth";

type Props = {
  pickId: string;            // e.g. "round-1-0-2"
  userName?: string;
  compact?: boolean;         // when true, show just “Comments (##)” pill
};

type CommentDoc = {
  text: string;
  userName: string;
  createdAt: any;
};

export default function CommentsSection({ pickId, userName, compact = true }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<CommentDoc[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, setUser);
    // live count + list
    const colRef = collection(db, "comments", pickId, "items");
    const unsubComments = onSnapshot(colRef, (snap) => {
      setCount(snap.size);
      setItems(
        snap.docs
          .map((d) => d.data() as CommentDoc)
          // newest first (firestore client ordering not guaranteed without orderBy)
          .sort((a, b) => (b?.createdAt?.seconds ?? 0) - (a?.createdAt?.seconds ?? 0))
      );
    });

    return () => {
      unsubAuth();
      unsubComments();
    };
  }, [pickId]);

  const post = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const colRef = collection(db, "comments", pickId, "items");
    const clean = text.trim();
    if (!clean) return;
    await addDoc(colRef, {
      text: clean,
      userName: userName || user.displayName || "Anonymous",
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  if (compact) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20"
          aria-label="Open comments"
          title="Open comments"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-white/60" />
          Comments ({count})
        </button>

        {/* Simple modal */}
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-xl bg-[#10141a] p-4 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold">Comments ({count})</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20"
                >
                  Close
                </button>
              </div>

              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {items.length === 0 && (
                  <div className="text-sm text-white/60">No comments yet.</div>
                )}
                {items.map((c, i) => (
                  <div key={i} className="rounded-md bg-white/5 p-2">
                    <div className="text-xs text-white/60">{c.userName}</div>
                    <div className="text-sm">{c.text}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a comment…"
                  className="flex-1 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/40"
                />
                <button
                  onClick={post}
                  className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // (Unused in this app; compact=true is the default)
  return null;
}
