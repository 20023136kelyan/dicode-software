import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const configured = !!apiKey;

  return NextResponse.json({ configured });
}

