import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  addWorkspaceMember,
  getWorkspaceMembership,
  getWorkspaceMembers,
  removeWorkspaceMember,
} from "@/lib/db/queries";
import { canManageWorkspace } from "@/lib/tenancy/policy";

const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

async function requireWorkspaceManager(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId);
  return membership && canManageWorkspace(membership.role) ? membership : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await getWorkspaceMembership(session.user.id, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getWorkspaceMembers(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await requireWorkspaceManager(session.user.id, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid email and role are required" }, { status: 400 });
  try {
    const member = await addWorkspaceMember({ actorUserId: session.user.id, workspaceId: id, ...parsed.data });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add member" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await requireWorkspaceManager(session.user.id, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid userId is required" }, { status: 400 });
  try {
    return NextResponse.json(await removeWorkspaceMember({ actorUserId: session.user.id, workspaceId: id, memberUserId: parsed.data.userId }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove member" }, { status: 400 });
  }
}
