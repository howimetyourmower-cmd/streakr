// /app/locker-room/page.tsx
import LeaguesClient from "../leagues/LeaguesClient";

export const dynamic = "force-dynamic";

export default function LockerRoomPage() {
  return <LeaguesClient />;
}
