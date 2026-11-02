import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/session";

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
