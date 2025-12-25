// /app/venues/page.tsx
import dynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const VenuesClient = dynamic(() => import("./VenuesClient"), {
  ssr: false,
});

export default function VenuesPage() {
  return <VenuesClient />;
}
