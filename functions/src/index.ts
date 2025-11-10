// Import Firebase Admin and Cloud Functions SDKs
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize the Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

// Create a Firestore database reference
const db = admin.firestore();

/**
 * Example Cloud Function:
 * When called, this function adds an admin user to the /admins collection.
 * You can modify or add more admin-only utilities here.
 */
export const addAdmin = functions.https.onCall(async (data, context) => {
  // Ensure only authenticated users can call this
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can add admins."
    );
  }

  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A user UID must be provided."
    );
  }

  await db.collection("admins").doc(uid).set({
    role: "admin",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: `User ${uid} has been made an admin.` };
});

/**
 * Example Cloud Function to log new user creation (optional).
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log("New user signed up:", user.uid, user.email);
  await db.collection("users").doc(user.uid).set({
    email: user.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
