import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      isSuperAdmin?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isSuperAdmin?: boolean;
  }
}
