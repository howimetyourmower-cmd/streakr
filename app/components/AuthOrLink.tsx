"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

type Props = {
  hrefWhenAuthed: string;
  hrefWhenUnauthed: string;
  children: React.ReactNode;
};

export default function AuthOrLink({ hrefWhenAuthed, hrefWhenUnauthed, children }: Props) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const href = user ? hrefWhenAuthed : hrefWhenUnauthed;

  return (
    <Link href={href} className="hover:underline">
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
