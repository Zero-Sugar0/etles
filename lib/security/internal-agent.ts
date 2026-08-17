import { timingSafeEqual } from "node:crypto";

/** Shared secret used only for trusted server-to-server agent requests. */
export function getInternalAgentSecret() {
  return process.env.INTERNAL_AGENT_API_KEY || process.env.AUTH_SECRET || "";
}

export function isTrustedInternalAgentRequest(request: Request) {
  const supplied = request.headers.get("x-etles-internal-key") || "";
  const expected = getInternalAgentSecret();
  if (!supplied || !expected) return false;

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}
