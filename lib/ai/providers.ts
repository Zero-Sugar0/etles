//lib/ai/providers.ts
import { gateway } from "@ai-sdk/gateway";
import { google } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";
import {
  DEFAULT_CHAT_MODEL,
  resolveImageModelId,
  resolveVideoModelId,
  titleModel,
} from "./models";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.endsWith("-thinking") ||
    (modelId.includes("reasoning") && !modelId.includes("non-reasoning"));

  // Diagnostic log for model selection
  console.log(
    `[AI SDK] Using model: ${modelId} (reasoning: ${isReasoningModel})`
  );

  if (isReasoningModel) {
    // We wrap with reasoning middleware to extract thinking blocks if present.
    // We pass the FULL modelId to the gateway to ensure correct routing.
    return wrapLanguageModel({
      model: gateway.languageModel(modelId),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return gateway.languageModel(modelId);
}

/**
 * @deprecated Use getLanguageModel directly. Routes modelId through the AI Gateway.
 */
export function getGoogleModel(modelId: string) {
  return getLanguageModel(modelId);
}

export function getImageModel(modelId?: string, provider?: string) {
  const resolvedModelId = resolveImageModelId(provider, modelId);
  return gateway.imageModel(resolvedModelId);
}

export function getVideoModel(modelId?: string, provider?: string) {
  const resolvedModelId = resolveVideoModelId(provider, modelId);
  return gateway.videoModel(resolvedModelId);
}

/**
 * Returns a model for background/proactive tasks (heartbeat, scheduled
 * reminders, weekly synthesis). These run without user interaction, so we
 * route them through the AI Gateway (same auth as the main chat) rather than
 * requiring a direct Google API key.
 *
 * The model is configurable via the HEARTBEAT_MODEL env var (mirroring
 * SUBAGENT_MODEL for sub-agents). Defaults to the main chat model.
 */
export function getBackgroundModel() {
  const modelId = process.env.HEARTBEAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
  return getLanguageModel(modelId);
}

/**
 * Returns a model for autonomous mission workflows (planning, lead sequences,
 * social posts, community engagement, daily reports).
 *
 * Configurable via MISSION_MODEL or SUBAGENT_MODEL env vars. Defaults to DEFAULT_CHAT_MODEL.
 */
export function getMissionModel() {
  const modelId =
    process.env.MISSION_MODEL?.trim() ||
    process.env.SUBAGENT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL;
  return getLanguageModel(modelId);
}

/**
 * Returns a model for Telegram bot interactions.
 * Configurable via TELEGRAM_MODEL or SUBAGENT_MODEL env vars. Defaults to DEFAULT_CHAT_MODEL.
 */
export function getTelegramModel() {
  const modelId =
    process.env.TELEGRAM_MODEL?.trim() ||
    process.env.SUBAGENT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL;
  return getLanguageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return gateway.languageModel(titleModel.id);
}

/**
 * Returns a model safe for structured output (streamObject / generateObject).
 * Configurable via ARTIFACT_MODEL or SUBAGENT_MODEL env vars. Defaults to DEFAULT_CHAT_MODEL.
 */
export function getArtifactModel(_modelId?: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }

  const modelId =
    process.env.ARTIFACT_MODEL?.trim() ||
    process.env.SUBAGENT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL;
  return getLanguageModel(modelId);
}
