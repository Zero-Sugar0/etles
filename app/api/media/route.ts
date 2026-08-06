import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  deleteUserMediaById,
  getUserMediaByUserId,
} from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sourceParam = searchParams.get("source");
  const source =
    sourceParam === "upload" || sourceParam === "generated"
      ? sourceParam
      : undefined;

  const media = await getUserMediaByUserId({
    userId: session.user.id,
    source,
  });

  return NextResponse.json({ media });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
  }

  const deleted = await deleteUserMediaById({
    id,
    userId: session.user.id,
  });

  if (!deleted) {
    return NextResponse.json(
      { error: "Media item not found or unauthorized" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, deleted });
}
