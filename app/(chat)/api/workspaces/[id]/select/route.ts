import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { resolveWorkspaceForUser } from "@/lib/db/queries";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workspace = await resolveWorkspaceForUser(session.user.id, id);
  const response = NextResponse.json({ workspace });
  response.cookies.set("etles-workspace-id", workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
