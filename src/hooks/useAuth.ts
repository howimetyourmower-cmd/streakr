// src/hooks/useAuth.ts
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";

// Shape of what components get when they call useAuth()
type UseAuthReturn = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
};

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // 🔥 Admin check: look for a doc in `admins` collection with this UID
      try {
        const adminDocRef = doc(db, "admins", firebaseUser.uid);
        const adminSnap = await getDoc(adminDocRef);

        // If the doc exists -> user is admin
        setIsAdmin(adminSnap.exists());
      } catch (err) {
        console.error("Error checking admin status", err);
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, isAdmin };
}
