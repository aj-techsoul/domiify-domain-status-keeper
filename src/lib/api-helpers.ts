import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError("Unauthorized. Please log in.", 401);
  }
  return user;
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("API error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
