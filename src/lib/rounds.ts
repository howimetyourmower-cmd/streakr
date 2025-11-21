import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export async function getCurrentRound() {
  const roundsRef = collection(db, "rounds");
  const snapshot = await getDocs(roundsRef);

  if (snapshot.empty) {
    return null;
  }

  // Load ALL rounds and sort them by roundNumber
  const rounds = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => a.roundNumber - b.roundNumber);

  // 👉 ALWAYS return Opening Round for testing
  return rounds[0]; // 2026-0
}
