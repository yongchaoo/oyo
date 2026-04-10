import { NextResponse } from "next/server";
import { generateReview } from "@/lib/ai";

export async function POST(req: Request) {
  const { period } = await req.json();
  if (period !== "weekly" && period !== "monthly") {
    return NextResponse.json({ error: "period must be weekly or monthly" }, { status: 400 });
  }

  try {
    const report = await generateReview(period);
    return NextResponse.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
