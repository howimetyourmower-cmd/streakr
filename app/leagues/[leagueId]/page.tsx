"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Shield, UserIcon, Users } from "lucide-react";
import { toast } from "sonner";

type League = {
  id: string;
  name: string;
  code: string;
  description?: string;
  ownerUid: string;
  createdAt?: Timestamp;
};

type LeagueMemberRole = "owner" | "member";

type LeagueMember = {
  id: string;
  userId: string;
  displayName: string;
  role: LeagueMemberRole;
  joinedAt?: Timestamp;
};

export default function LeagueDetailPage() {
  const params = useParams();
  const leagueId = (params?.leagueId as string) || "";

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [isLoadingLeague, setIsLoadingLeague] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  useEffect(() => {
    if (!leagueId) return;

    const leagueRef = doc(db, "leagues", leagueId);

    const unsubscribe = onSnapshot(
      leagueRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<League, "id">;
          setLeague({ id: snap.id, ...data });
        } else {
          setLeague(null);
        }
        setIsLoadingLeague(false);
      },
      (error) => {
        console.error("Error loading league:", error);
        toast.error("Failed to load league");
        setIsLoadingLeague(false);
      }
    );

    return () => unsubscribe();
  }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;

    const membersRef = collection(db, "leagues", leagueId, "members");
    const q = query(membersRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: LeagueMember[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Omit<LeagueMember, "id">;
          list.push({ id: docSnap.id, ...data });
        });
        setMembers(list);
        setIsLoadingMembers(false);
      },
      (error) => {
        console.error("Error loading members:", error);
        toast.error("Failed to load league members");
        setIsLoadingMembers(false);
      }
    );

    return () => unsubscribe();
  }, [leagueId]);

  const handleCopyCode = async () => {
    if (!league?.code) return;
    try {
      await navigator.clipboard.writeText(league.code);
      toast.success("League code copied");
    } catch (err) {
      console.error(err);
      toast.error("Couldn’t copy code");
    }
  };

  const formatJoined = (joinedAt?: Timestamp) => {
    if (!joinedAt) return "";
    const date = joinedAt.toDate();
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!leagueId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold">League not found</h1>
        <p className="text-sm text-muted-foreground">
          No league id in the URL. Go back to your leagues list and try again.
        </p>
      </div>
    );
  }

  if (isLoadingLeague) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-bold">League not found</h1>
        <p className="text-sm text-muted-foreground">
          This league doesn’t exist or you don’t have access to it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Private league • Invite your mates and see who can keep their
            Streak alive the longest.
          </p>
        </div>

        {/* Code + copy */}
        <div className="flex flex-col items-start gap-2 md:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-muted-foreground">
              League code
            </span>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-muted px-3 py-1 text-lg font-semibold tracking-widest">
              {league.code}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyCode}
              aria-label="Copy league code"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Description / How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-5 w-5" />
            How this league works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {league.description && (
            <>
              <p className="text-foreground">{league.description}</p>
              <Separator className="my-2" />
            </>
          )}
          <ul className="list-disc space-y-1 pl-5">
            <li>Your Streak in this league uses the same picks as public mode.</li>
            <li>
              Even in a private league, your score still counts towards the
              global Streakr ladder.
            </li>
            <li>
              Share your league code with mates — once they join, they’ll appear
              in the members list below.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-[3fr,2fr]">
        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                League members
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {isLoadingMembers
                  ? "Loading…"
                  : `${members.length} ${
                      members.length === 1 ? "member" : "members"
                    }`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMembers && (
              <div className="space-y-2">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            )}

            {!isLoadingMembers && members.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No one’s joined yet. Share your league code so your mates can
                jump in.
              </p>
            )}

            {!isLoadingMembers && members.length > 0 && (
              <div className="space-y-1">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {member.displayName || "Unnamed player"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {member.role === "owner" ? "Commissioner" : "Player"}
                          {member.joinedAt &&
                            ` • Joined ${formatJoined(member.joinedAt)}`}
                        </span>
                      </div>
                    </div>

                    {member.role === "owner" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                        Owner
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite / share box */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Invite your mates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              To join this league, your friends just need to:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Streakr and go to the Leagues page.</li>
              <li>Tap <span className="font-semibold">“Join League”</span>.</li>
              <li>
                Enter this code:{" "}
                <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground">
                  {league.code}
                </span>
              </li>
            </ol>
            <Separator />
            <div className="space-y-2">
              <p>Quick share:</p>
              <Button
                className="w-full justify-center"
                variant="outline"
                onClick={() => {
                  const text = `Join my Streakr league: ${league.name}\nLeague code: ${league.code}`;
                  if (navigator.share) {
                    navigator
                      .share({ text, title: "Join my Streakr league" })
                      .catch((err) => {
                        if (err?.name !== "AbortError") {
                          console.error(err);
                        }
                      });
                  } else {
                    navigator.clipboard
                      .writeText(text)
                      .then(() => {
                        toast.success("Invite text copied");
                      })
                      .catch((err) => {
                        console.error(err);
                        toast.error("Couldn’t copy invite text");
                      });
                  }
                }}
              >
                Share league with friends
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
