import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { updateUserNames } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { firstName, lastName } = (await req.json()) as {
      firstName?: string;
      lastName?: string;
    };

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and Last name are required" },
        { status: 400 }
      );
    }

    await updateUserNames(session.user.id, firstName, lastName);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[update-profile-api] Failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
