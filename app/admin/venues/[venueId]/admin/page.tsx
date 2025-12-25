"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";

type SubscriptionStatus = "active" | "paused" | "cancelled";

type VenueLeague = {
  id: string;
  name: string;
  code: string;
  venueName?: string | null;
  location?: string | null;
  description?: string | null;
  prizesHeadline?: string | null;
  prizesBody?: string | null;
  venueAdminEmail?: string | null;
  venueAdminUid?: string | null;
  subscriptionStatus: SubscriptionStatus;

  voucherJoinEnabled?: boolean;
  voucherJoinTitle?: string | null;
  voucherJoinDescription?: string | null;
  voucherMilestoneEnabled?: boolean;
  voucherMilestoneTitle?: string | null;
  voucherMilestoneDescription?: string | null;
};

export default function VenueAdminPage() {
  const params = useParams();
  const venueId = params?.venueId as string;
  const router = useRouter();
  const { user, loading, isAdmin } = useAuth();

  const [venue, setVenue] = useState<VenueLeague | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venueId) return;

    getDoc(doc(db, "venueLeagues", venueId)).then((snap) => {
      if (!snap.exists()) return;
      const v = { id: snap.id, ...(snap.data() as VenueLeague) };
      setVenue(v);
      setHeadline(v.prizesHeadline ?? "");
      setBody(v.prizesBody ?? "");
    });
  }, [venueId]);

  if (loading) {
    return <div className="p-10 text-white">Loading venue…</div>;
  }

  if (!venue) {
    return <div className="p-10 text-white">Venue not found</div>;
  }

  const authorized =
    isAdmin ||
    user?.uid === venue.venueAdminUid ||
    user?.email?.toLowerCase() === venue.venueAdminEmail?.toLowerCase();

  if (!authorized) {
    return <div className="p-10 text-red-400">Access denied</div>;
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateDoc(doc(db, "venueLeagues", venue.id), {
      prizesHeadline: headline,
      prizesBody: body,
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 text-white">
      <h1 className="text-2xl font-bold mb-6">{venue.name}</h1>

      <form onSubmit={save} className="space-y-4">
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full p-2 bg-black border border-white/20"
          placeholder="Prize headline"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full p-2 bg-black border border-white/20"
          placeholder="Prize details"
        />
        <button
          disabled={saving}
          className="bg-orange-500 px-4 py-2 rounded text-black font-semibold"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
