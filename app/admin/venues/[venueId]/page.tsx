// app/admin/venues/[venueId]/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: { venueId: string };
};

export default function Page({ params }: Props) {
  // Admin path just redirects to the real venue admin console.
  redirect(`/venues/${params.venueId}/admin`);
}
