//lib/ai/tools/generate-image.ts

import { gateway } from "@ai-sdk/gateway";
import { put } from "@vercel/blob";
import { generateImage, tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { resolveImageModelId } from "@/lib/ai/models";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

function mapAspectRatioToOpenAISize(
  aspectRatio?: string
): `${number}x${number}` {
  if (aspectRatio === "16:9") {
    return "1792x1024";
  }
  if (aspectRatio === "9:16") {
    return "1024x1792";
  }
  // Default to square 1024x1024
  return "1024x1024";
}

import { saveDocument, saveUserMedia } from "@/lib/db/queries";

export const generateImageTool = ({
  userId,
  dataStream,
}: {
  userId?: string;
  dataStream?: UIMessageStreamWriter<ChatMessage>;
} = {}) =>
  tool({
    description:
      "Generate an image or edit an existing image based on a prompt.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "The prompt to generate the image from. If editing, describe how to edit the image."
        ),
      modelId: z
        .string()
        .optional()
        .describe(
          "Optional explicit image model ID. Overrides the provider selection when provided."
        ),
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
        .describe(
          "Resolution size of the generated image. Use 2K or 4K only if specified."
        ),
      count: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional()
        .default(1)
        .describe("Number of image variations to generate and show in the gallery."),
      provider: z
        .enum(["google", "openai", "bytedance", "xai"])
        .optional()
        .default("google")
        .describe(
          "The provider to use. Supported providers are google, openai, bytedance, and xai."
        ),
      editReferenceImageUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "ONLY use this if the user wants to EDIT an existing image. Do NOT use this for generating a new image. Provide the exact URL the user specified."
        ),
    }),
    execute: async ({
      prompt,
      aspectRatio,
      resolution,
      provider,
      editReferenceImageUrl,
      modelId: explicitModelId,
      count,
    }) => {
      const artifactId = generateUUID();

      dataStream?.write({
        type: "data-kind",
        data: "image",
        transient: true,
      });
      dataStream?.write({
        type: "data-id",
        data: artifactId,
        transient: true,
      });
      dataStream?.write({
        type: "data-title",
        data: prompt,
        transient: true,
      });
      dataStream?.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      try {
        const modelId = resolveImageModelId(provider, explicitModelId);

        console.log(
          `[Image Gen] Generating image using ${modelId} via Vercel AI SDK & AI Gateway`
        );

        let promptInput: any = prompt;

        if (editReferenceImageUrl) {
          try {
            console.log(
              "Attempting to fetch source image URL:",
              editReferenceImageUrl
            );
            const res = await fetch(editReferenceImageUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; EtlesAgent/1.0)",
              },
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
            console.error(
              "Failed to load editReferenceImageUrl. Falling back to plain text-to-image:",
              e
            );
            // Gracefully fallback to simple text generation if the URL was hallucinated or expired
            promptInput = prompt;
          }
        }

        const size =
          provider === "openai"
            ? mapAspectRatioToOpenAISize(aspectRatio)
            : undefined;

        const images: Array<{
          url: string;
          prompt: string;
          provider: string;
          model: string;
          resolution: string;
          aspectRatio: string;
          createdAt: string;
        }> = [];

        for (let index = 0; index < count; index += 1) {
          const result = await generateImage({
            model: gateway.imageModel(modelId),
            prompt: promptInput,
            ...(provider === "openai" ? { size } : { aspectRatio }),
          });

          const base64Image = result.image.base64;
          if (!base64Image) throw new Error("No image data found in response");

          dataStream?.write({
            type: "data-imageDelta",
            data: base64Image,
            transient: true,
          });

          const createdAt = new Date().toISOString();
          const blobData = await put(
            `generated-images/${generateUUID()}.png`,
            Buffer.from(base64Image, "base64"),
            { access: "public", contentType: "image/png" }
          );

          images.push({
            url: blobData.url,
            prompt,
            provider,
            model: modelId,
            resolution,
            aspectRatio: aspectRatio ?? "1:1",
            createdAt,
          });

          if (userId) {
            await saveUserMedia({
              userId,
              url: blobData.url,
              name: `Generated Image (${prompt.slice(0, 30)})`,
              mimeType: "image/png",
              source: "generated",
              prompt,
            }).catch((err) => {
              console.error(
                "[generateImageTool] Failed to save generated image to userMedia:",
                err instanceof Error ? err.message : "unknown error"
              );
            });
          }
        }

        const persistedContent = JSON.stringify({
          version: 1,
          type: "image-gallery",
          images,
        });

        if (userId) {
          await saveDocument({
            id: artifactId,
            title: prompt,
            kind: "image",
            content: persistedContent,
            userId,
          });
        }

        // Replace the transient preview with the durable gallery payload.
        dataStream?.write({
          type: "data-imageDelta",
          data: persistedContent,
          transient: true,
        });
        dataStream?.write({
          type: "data-finish",
          data: null,
          transient: true,
        });

        // ONLY Return metadata to the model. Do NOT return the base64 string because
        // doing so bloats the AI message token limit severely and slows down the conversation.
        return {
          status: "SUCCESS",
          artifactId,
          url: images[0]?.url,
          images,
          originalPrompt: prompt,
          aspectRatioGenerated: aspectRatio,
          resolution,
          providerUsed: provider,
          modelUsed: modelId,
          edited: !!editReferenceImageUrl && promptInput !== prompt, // true only if we successfully attached an image part
        };
      } catch (error) {
        console.error("Image generation failed:", error);

        dataStream?.write({
          type: "data-finish",
          data: null,
          transient: true,
        });

        return {
          error: "Failed to generate image.",
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
