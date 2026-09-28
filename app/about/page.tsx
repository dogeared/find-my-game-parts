import { prisma } from "@/lib/prisma";
import { MarkdownContent } from "@/components/MarkdownContent";

// Admin-editable without a redeploy (content lives in the DB, not a
// file) — never statically prerender this at build time.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const about = await prisma.aboutPage.findUnique({ where: { id: "about" } });

  return (
    <main className="panel">
      {about?.markdown ? (
        <MarkdownContent markdown={about.markdown} />
      ) : (
        <p>Nothing here yet.</p>
      )}
    </main>
  );
}
