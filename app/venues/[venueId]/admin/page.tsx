// /app/venues/[venueId]/admin/page.tsx
import VenueAdminClient from "./VenueAdminClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return <VenueAdminClient />;
}
