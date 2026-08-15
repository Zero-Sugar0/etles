import { guestRegex } from "@/lib/constants";
import { getComposioClient } from "@/lib/composio-client";
import { auth } from "../../../../(auth)/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isGuest = guestRegex.test(session?.user?.email ?? "");
  if (isGuest) {
    return Response.json(
      { error: "Unauthorized: Guest access not allowed" },
      { status: 401 }
    );
  }

  try {
    const composio = await getComposioClient(session.user.id);
    const { triggerId } = await req.json();
    const triggerManager = composio.triggers as any;
    const deleteMethod =
      triggerManager.delete || triggerManager.disable || triggerManager.remove;

    if (deleteMethod) {
      await deleteMethod.call(triggerManager, triggerId);
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete trigger:", error);
    return Response.json(
      { error: "Failed to delete trigger", details: error.message },
      { status: 500 }
    );
  }
}
