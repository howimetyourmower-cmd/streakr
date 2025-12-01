// app/settlement/page.tsx
import { redirect } from "next/navigation";

export default function SettlementRootPage() {
  // Always send anyone hitting /settlement to the admin console
  redirect("/admin/settlement");
}
