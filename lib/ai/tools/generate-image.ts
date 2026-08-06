//lib/ai/tools/generate-image.ts
import { generateImage, tool, type UIMessageStreamWriter } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { ChatMessage } from "@/lib/types";
import { put } from "@vercel/blob";
import { generateUUID } from "@/lib/utils";
import { resolveImageModelId } from "@/lib/ai/models";

function mapAspectRatioToOpenAISize(aspectRatio?: string): `${number}x${number}` {
  if (aspectRatio === "16:9") return "1792x1024";
  if (aspectRatio === "9:16") return "1024x1792";
  // Default to square 1024x1024
  return "1024x1024";
}

export const generateImageTool = (
  dataStream?: UIMessageStreamWriter<ChatMessage>
) =>
  tool({
    description: "Generate an image or edit an existing image based on a prompt.",
    inputSchema: z.object({
      prompt: z.string().describe("The prompt to generate the image from. If editing, describe how to edit the image."),
      modelId: z
        .string()
        .optional()
        .describe("Optional explicit image model ID. Overrides the provider selection when provided."),
      aspectRatio: z
        .enum([
          "1:1",
          "2:3",
          "3:2",
          "3:4",
          "4:3",
          "4:5",
          "5:4",
          "9:16",
          "16:9",
          "21:9",
        ])
        .optional()
        .default("1:1")
        .describe("The aspect ratio of the generated image."),
      resolution: z
        .enum(["1K", "2K", "4K"])
        .optional()
        .default("1K")
        .describe("Resolution size of the generated image. Use 2K or 4K only if specified."),
      provider: z
        .enum(["google", "openai", "bytedance", "xai"])
        .optional()
        .default("google")
        .describe("The provider to use. Supported providers are google, openai, bytedance, and xai."),
      editReferenceImageUrl: z
        .string()
        .url()
        .optional()
        .describe("ONLY use this if the user wants to EDIT an existing image. Do NOT use this for generating a new image. Provide the exact URL the user specified."),
    }),
    execute: async ({ prompt, aspectRatio, resolution, provider, editReferenceImageUrl, modelId: explicitModelId }) => {
      try {
        const modelId = resolveImageModelId(provider, explicitModelId);

        console.log(`[Image Gen] Generating image using ${modelId} via Vercel AI SDK & AI Gateway`);

        let promptInput: any = prompt;

        if (editReferenceImageUrl) {
          try {
            console.log("Attempting to fetch source image URL:", editReferenceImageUrl);
            const res = await fetch(editReferenceImageUrl, {
               headers: {
                 "User-Agent": "Mozilla/5.0 (compatible; EtlesAgent/1.0)",
               }
            });
            
            if (!res.ok) {
              if (res.status === 403 || res.status === 401) {
                throw new Error("HTTP_UNAUTHORIZED");
              }
              throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            promptInput = {
              text: prompt,
              images: [buffer],
            };
          } catch (e: any) {
            console.error("Failed to load editReferenceImageUrl. Falling back to plain text-to-image:", e);
            // Gracefully fallback to simple text generation if the URL was hallucinated or expired
            promptInput = prompt;
          }
        }

        const size = provider === "openai" ? mapAspectRatioToOpenAISize(aspectRatio) : undefined;

        const result = await generateImage({
          model: gateway.imageModel(modelId),
          prompt: promptInput,
          ...(provider === "openai"
            ? { size }
            : { aspectRatio }),
        });

        const base64Image = result.image.base64;

        if (!base64Image) {
          throw new Error("No image data found in response");
        }

        // Upload directly to Vercel blob using generic UUID
        const buffer = Buffer.from(base64Image, "base64");
        const filename = `gemini-images/${generateUUID()}.png`;
        const blobData = await put(filename, buffer, {
          access: "public",
          contentType: "image/png",
        });

        // ONLY Return metadata to the model. Do NOT return the base64 string because
        // doing so bloats the AI message token limit severely and slows down the conversation.
        return {
          status: "SUCCESS",
          url: blobData.url,
          originalPrompt: prompt,
          aspectRatioGenerated: aspectRatio,
          resolution,
          providerUsed: provider,
          modelUsed: modelId,
          edited: !!editReferenceImageUrl && promptInput !== prompt, // true only if we successfully attached an image part
        };

      } catch (error) {
        console.error("Image generation failed:", error);
        
        return {
          error: "Failed to generate image.",
          details: error instanceof Error ? error.message : String(error)
        };
      }
    },
  });