export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export function canManageWorkspace(role: WorkspaceRole | string | null | undefined) {
  return role === "owner" || role === "admin";
}

export function canAccessWorkspace(
  membership: { status: string; role: string } | null | undefined
) {
  return membership?.status === "active";
}

export function canRemoveWorkspaceMember(
  actorRole: WorkspaceRole | string | null | undefined,
  targetRole: WorkspaceRole | string | null | undefined
) {
  return canManageWorkspace(actorRole) && targetRole !== "owner";
}
