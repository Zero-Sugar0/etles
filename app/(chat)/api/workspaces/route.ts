import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createWorkspaceForUser,
  ensurePersonalWorkspace,
  listWorkspacesForUser,
} from "@/lib/db/queries";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await listWorkspacesForUser(session.user.id);
  if (workspaces.length === 0) {
    const personal = await ensurePersonalWorkspace(session.user.id);
    return NextResponse.json([{ workspace: personal, membership: { role: "owner", status: "active" } }]);
  }
  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid workspace name is required" }, { status: 400 });

  const workspace = await createWorkspaceForUser({ userId: session.user.id, name: parsed.data.name });
  return NextResponse.json(workspace, { status: 201 });
}
