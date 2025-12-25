// /app/venues/page.tsx
import dynamic from "next/dynamic";

const VenuesClient = dynamic(() => import("./VenuesClient"), {
  ssr: false,
});

export default function VenuesPage() {
  return <VenuesClient />;
}
