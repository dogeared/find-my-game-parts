import ReactMarkdown from "react-markdown";

// Shared by the public /about page and the admin editor's preview, so
// what an admin previews is exactly what visitors see. react-markdown
// never renders raw HTML from the source by default (no rehype-raw), so
// admin-authored markdown can't inject scripts/tags even though only
// admins can write it anyway.
export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
