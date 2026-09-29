import { MyRequestsPageClient } from "./MyRequestsPageClient";

// See app/request/page.tsx for the full explanation — route segment
// config only takes effect from a Server Component file.
export const dynamic = "force-dynamic";

export default function MyRequestsPage() {
  return <MyRequestsPageClient />;
}
