// app/components/AuthOrLink.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

type Props = {
  /** Where to send the user if they ARE logged in */
  hrefWhenAuthed: string;
  /** Where to send the user if they are NOT logged in */
  hrefWhenUnauthed: string;
  className?: string;
  children: React.ReactNode;
};

export default function AuthOrLink({
  hrefWhenAuthed,
  hrefWhenUnauthed,
  className,
  children,
}: Props) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const href = user ? hrefWhenAuthed : hrefWhenUnauthed;

  return (
    <Link href={href} className={className}>
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
