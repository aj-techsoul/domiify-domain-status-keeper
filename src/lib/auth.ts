import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, notificationPreferences } from "./schema";
import { eq } from "drizzle-orm";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email.trim().toLowerCase();
        const user = await db.query.users.findFirst({ where: eq(users.email, email) });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          currency: user.currency,
          theme: user.theme,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.currency = user.currency;
        token.theme = user.theme;
      }
      // When the client calls `update()` (e.g. after saving profile
      // settings), re-read the latest values from the database so the
      // session reflects the change without requiring a fresh login.
      if (trigger === "update" && token.id) {
        const fresh = await db.query.users.findFirst({ where: eq(users.id, token.id as string) });
        if (fresh) {
          token.currency = fresh.currency;
          token.theme = fresh.theme;
          token.name = fresh.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.currency = (token.currency as string) ?? "INR";
        session.user.theme = (token.theme as string) ?? "system";
      }
      return session;
    },
  },
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as { id: string; name: string; email: string; currency: string; theme: string };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function ensureNotificationPreferences(userId: string) {
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });
  if (!existing) {
    await db.insert(notificationPreferences).values({ userId });
  }
}
