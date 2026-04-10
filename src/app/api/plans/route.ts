import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM plans ORDER BY created_at DESC").all();
  return NextResponse.json(plans);
}
