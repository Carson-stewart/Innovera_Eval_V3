import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, signToken } from "@/lib/auth";

const TWENTY_FOUR_HOURS = 60 * 60 * 24;

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || password !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signToken({ authenticated: true });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TWENTY_FOUR_HOURS,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
