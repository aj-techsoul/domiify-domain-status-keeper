import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { registerSchema, firstZodError } from "@/lib/validations";
import { hashPassword } from "@/lib/auth";
import { newId } from "@/lib/ids";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in instead." },
        { status: 409 },
      );
    }

    const userId = newId("user");
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash,
      currency: "INR",
      theme: "system",
    });

    const { notificationPreferences } = await import("@/lib/schema");
    await db.insert(notificationPreferences).values({ userId });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
