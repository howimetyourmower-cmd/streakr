"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@lib/firebaseClient";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

type Props = {
  children: React.ReactNode;
  className?: string;
  onAuthedClick?: () => void; // what to do when the user IS logged in (optional)
  hrefWhenAuthed?: string;     // or send somewhere else when authed (optional)
};

export default function AuthOrLink({
  children,
  className,
  onAuthedClick,
  hrefWhenAuthed,
}: Props) {
  const auth = useMemo(() => getAuth(app), []);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, [auth]);

  // If NOT logged in -> behave like a link to /auth
  if (!user) {
    return (
      <Link href="/auth" className={className}>
        {children}
      </Link>
    );
  }

  // Logged in -> either run handler or navigate to a provided href
  if (hrefWhenAuthed) {
    return (
      <Link href={hrefWhenAuthed} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onAuthedClick}
    >
      {children}
    </button>
  );
}
