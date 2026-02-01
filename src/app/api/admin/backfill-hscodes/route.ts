import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
}
