// if (!auth.currentUser) redirect to /auth
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../config/firebaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const auth = getAuth(app);

const [loggedIn, setLoggedIn] = useState(false);
const router = useRouter();

useEffect(() => {
  const unsub = onAuthStateChanged(auth, (u) => setLoggedIn(!!u));
  return () => unsub();
}, []);

const handlePick = (choice: "YES" | "NO") => {
  if (!loggedIn) {
    router.push("/auth");
    return;
  }
  // … existing pick logic …
};
