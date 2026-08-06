import assert from "node:assert/strict";
import test from "node:test";

import { resolveImageModelId } from "../lib/ai/models";

test("defaults to the Google lite image model", () => {
  assert.equal(resolveImageModelId(), "google/gemini-3.1-flash-lite-image");
});

test("maps provider aliases to supported image models", () => {
  assert.equal(
    resolveImageModelId("google"),
    "google/gemini-3.1-flash-lite-image"
  );
  assert.equal(resolveImageModelId("openai"), "openai/gpt-image-2");
  assert.equal(resolveImageModelId("bytedance"), "bytedance/seedream-5.0-pro");
  assert.equal(resolveImageModelId("xai"), "xai/grok-imagine-image");
});

test("allows an explicit model id to override the provider default", () => {
  assert.equal(
    resolveImageModelId("google", "bytedance/seedream-4.5"),
    "bytedance/seedream-4.5"
  );
});
