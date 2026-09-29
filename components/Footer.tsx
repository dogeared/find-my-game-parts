import packageJson from "@/package.json";

const REPO_URL = "https://github.com/dogeared/find-my-game-parts";
const PROFILE_URL = "https://github.com/dogeared";

// Server component (no "use client") — nothing here needs to react to
// session/theme state, so it renders once on the server like the rest of
// the static shell.
export function Footer() {
  return (
    <footer className="site-footer">
      <a href={REPO_URL} className="btn-ghost" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
      <span>v{packageJson.version}</span>
      <span>made with ❤️ by</span>
      <a href={PROFILE_URL} className="btn-ghost" target="_blank" rel="noopener noreferrer">
        dogeared
      </a>
    </footer>
  );
}
