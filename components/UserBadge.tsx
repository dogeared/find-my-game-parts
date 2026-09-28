"use client";

import { useSession } from "next-auth/react";

// Split out from NavAuth so the signed-in user's name can render first
// in the nav (upper-left), ahead of Home/About/NavAuth's own admin
// links and sign-out button — NavAuth stays where it is in the nav,
// this just renders earlier in DOM order.
export function UserBadge() {
  const { data: session } = useSession();
  if (!session) return null;
  return <span className="nav-user">{session.user.name ?? session.user.email}</span>;
}
