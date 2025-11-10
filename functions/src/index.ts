import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Recalculate streak for a single user incrementally when a pick is settled.
 * Trigger: when a pick moves to FINAL or VOID, or its result changes.
 */
export const onPickSettled = functions.firestore
  .document("picks/{pickId}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() as any : null;
    const before = change.before.exists ? change.before.data() as any : null;

    // Only react when becoming FINAL/VOID or result changed.
    const becameFinal =
      after && (after.status === "FINAL" || after.status === "VOID") &&
      (!before || before.status !== after.status || before.result !== after.result);

    if (!becameFinal) return;

    const uid: string = after.uid;
    const lbRef = db.collection("leaderboard").doc(uid);
    const userRef = db.collection("users").doc(uid);

    // Get (or derive) display fields
    const userSnap = await userRef.get();
    const user = userSnap.exists ? userSnap.data()! : {};
    const displayName = user.displayName ?? "Player";
    const team = user.team ?? null;
    const avatarUrl = user.avatarUrl ?? null;

    // Read current aggregate (with defaults)
    const lbSnap = await lbRef.get();
    const agg = lbSnap.exists
      ? (lbSnap.data() as any)
      : { currentStreak: 0, longestStreak: 0, totalWins: 0 };

    let { currentStreak, longestStreak, totalWins } = agg;

    // VOID does not change streaks
    if (after.status === "VOID" || after.result === "VOID") {
      // just touch updatedAt & ensure display fields are set
      await lbRef.set(
        { displayName, team, avatarUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      return;
    }

    const isCorrect = after.selection === after.result;

    if (isCorrect) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      totalWins = (totalWins ?? 0) + 1;
    } else {
      currentStreak = 0; // streak broken
    }

    await lbRef.set(
      {
        displayName,
        team,
        avatarUrl,
        currentStreak,
        longestStreak,
        totalWins,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
