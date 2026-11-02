import { NextResponse } from "next/server";
import { handleApiError, requireUser } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser(undefined, { allowPasswordChangePending: true });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
