import type { DefaultSession, User } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      isAdmin: boolean;
    };
  }

  // Without a database adapter, this is exactly what our provider's
  // `profile()` returns, unchanged, as the `user` param in the jwt
  // callback (verified by reading next-auth/core/lib/callback-handler.js).
  interface User {
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isAdmin?: boolean;
  }
}
