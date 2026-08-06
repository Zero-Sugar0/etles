import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VIDEO_MODEL_ID, resolveVideoModelId } from "@/lib/ai/models";

test("returns an explicit video model id when supplied", () => {
  assert.equal(
    resolveVideoModelId("google", "minimax/minimax-h3"),
    "minimax/minimax-h3"
  );
});

test("returns the default video model when no provider or model is supplied", () => {
  assert.equal(resolveVideoModelId(), DEFAULT_VIDEO_MODEL_ID);
});

test("returns the matching video model for a provider", () => {
  assert.equal(resolveVideoModelId("xai"), "xai/grok-imagine-video-1.5");
});
