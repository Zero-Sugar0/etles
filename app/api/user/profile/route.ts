import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { decryptUserCredential, credentialHint, encryptUserCredential } from "@/lib/security/user-credentials";
import { deleteUserCredential, getUserCredentialById, listUserCredentials, updateUserNames, upsertUserCredential } from "@/lib/db/queries";

const PROVIDERS = new Set(["ai-gateway", "composio", "upstash", "daytona", "oracle", "e2b"]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ credentials: await listUserCredentials(session.user.id) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      action?: string;
      id?: string;
      firstName?: string;
      lastName?: string;
      provider?: string;
      keyName?: string;
      value?: string;
    };

    if (body.action === "revealCredential") {
      if (!body.id) {
        return NextResponse.json({ error: "Credential id is required" }, { status: 400 });
      }
      const credential = await getUserCredentialById(session.user.id, body.id);
      if (!credential) {
        return NextResponse.json({ error: "Credential not found" }, { status: 404 });
      }
      return NextResponse.json(
        {
          provider: credential.provider,
          keyName: credential.keyName,
          value: decryptUserCredential(credential.encryptedValue),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.provider || body.keyName || body.value) {
      const provider = body.provider?.trim().toLowerCase();
      const keyName = body.keyName?.trim();
      const value = body.value?.trim();
      if (!provider || !PROVIDERS.has(provider) || !keyName || keyName.length > 128 || !value || value.length > 100_000) {
        return NextResponse.json({ error: "A valid provider, key name, and credential are required" }, { status: 400 });
      }
      const credential = await upsertUserCredential({
        userId: session.user.id,
        provider,
        keyName,
        encryptedValue: encryptUserCredential(value),
        valueHint: credentialHint(value),
      });
      return NextResponse.json({ ok: true, credential });
    }

    const { firstName, lastName } = body;

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

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Credential id is required" }, { status: 400 });
  const deleted = await deleteUserCredential(session.user.id, id);
  return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
