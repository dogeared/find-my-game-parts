"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

// Sign in/out plus direct admin nav — without this, the admin pages are
// only reachable by typing the URL, since nothing else links to them.
export function NavAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return (
      <button className="btn-ghost" onClick={() => signIn("keycloak")}>
        Sign in / Sign up
      </button>
    );
  }

  return (
    <>
      {session.user.isAdmin && (
        <Link href="/admin" className="btn-ghost">
          Admin
        </Link>
      )}
      <button className="btn-ghost" onClick={() => signOut()}>
        Sign out
      </button>
    </>
  );
}
