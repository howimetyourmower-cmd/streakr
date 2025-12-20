export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { Suspense } from "react";
import PicksClient from "./PicksClient";

export default function PicksPage() {
  return (
    <Suspense fallback={null}>
      <PicksClient />
    </Suspense>
  );
}
