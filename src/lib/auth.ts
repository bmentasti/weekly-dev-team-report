import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/api";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // Backoffice: permite loguearse con el USERNAME del admin (sin "@").
        // Se traduce al email interno antes de validar el schema.
        const adminUsername = process.env.ADMIN_USERNAME ?? "brunoAdmin";
        const adminEmail =
          process.env.ADMIN_EMAIL ?? "brunoadmin@devmetrics.local";
        let input = credentials;
        if (
          input?.email &&
          !input.email.includes("@") &&
          input.email.trim().toLowerCase() === adminUsername.toLowerCase()
        ) {
          input = { ...input, email: adminEmail };
        }

        const parsed = loginSchema.safeParse(input);
        if (!parsed.success) return null;

        // Rate limit por IP para frenar fuerza bruta de contraseñas (H10).
        const xff =
          (req?.headers?.["x-forwarded-for"] as string | undefined) ?? "unknown";
        const ip = xff.split(",")[0]?.trim() || "unknown";
        if (!rateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 }).ok) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isSuperAdmin:
            (user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.isSuperAdmin =
          (user as { isSuperAdmin?: boolean }).isSuperAdmin === true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string | undefined;
        session.user.isSuperAdmin = token.isSuperAdmin === true;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
