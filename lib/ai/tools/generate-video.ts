import { put } from "@vercel/blob";
import { tool } from "ai";
import { z } from "zod";
import { resolveVideoModelId } from "@/lib/ai/models";
import { getVideoModel } from "@/lib/ai/providers";
import { generateUUID } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper — converts a base64 string + mime type into the inlineData shape
// Veo expects for image inputs
// ---------------------------------------------------------------------------
function toImagePayload(base64: string, mimeType: string) {
  return {
    imageBytes: base64,
    mimeType,
  };
}

// ---------------------------------------------------------------------------
// Main tool
// ---------------------------------------------------------------------------
export const generateVideoTool = () =>
  tool({
    description: `Generate a video via the AI Gateway using the requested provider/model.

Modes:
- Text-to-video: provide only a prompt.
- Image-to-video: provide a startFrameBase64 to animate from a specific first frame.
- First + last frame: provide both startFrameBase64 and endFrameBase64 to guide start and end.
- Reference images: provide up to 3 referenceImages to lock in a subject's appearance.
- Video extension: provide videoToExtendUri (when supported by the selected model).`,

    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "Detailed cinematic description of the video. Include camera movement, lighting, audio cues, and style."
        ),

      // ── Output controls ──────────────────────────────────────────────────
      aspectRatio: z
        .enum(["16:9", "9:16"])
        .optional()
        .default("16:9")
        .describe("16:9 for landscape (default), 9:16 for portrait."),

      resolution: z
        .enum(["720p", "1080p", "4k"])
        .optional()
        .default("720p")
        .describe(
          "Output resolution. Higher = slower + more expensive. 4k not available for Lite model."
        ),

      modelId: z
        .string()
        .optional()
        .describe(
          "Optional explicit video model ID. Overrides provider selection when provided."
        ),

      provider: z
        .enum(["google", "bytedance", "xai", "minimax"])
        .optional()
        .default("google")
        .describe("The provider to use for video generation."),

      // ── Image-to-video / first frame ─────────────────────────────────────
      startFrameBase64: z
        .string()
        .optional()
        .describe(
          "Base64-encoded image to use as the first frame of the video."
        ),
      startFrameMimeType: z
        .enum(["image/png", "image/jpeg", "image/webp"])
        .optional()
        .default("image/png")
        .describe("MIME type of startFrameBase64."),

      // ── Last frame ───────────────────────────────────────────────────────
      endFrameBase64: z
        .string()
        .optional()
        .describe(
          "Base64-encoded image to use as the last frame. Requires startFrameBase64 to also be set."
        ),
      endFrameMimeType: z
        .enum(["image/png", "image/jpeg", "image/webp"])
        .optional()
        .default("image/png")
        .describe("MIME type of endFrameBase64."),

      // ── Reference images (up to 3) ───────────────────────────────────────
      referenceImages: z
        .array(
          z.object({
            base64: z.string().describe("Base64-encoded reference image."),
            mimeType: z
              .enum(["image/png", "image/jpeg", "image/webp"])
              .default("image/png"),
          })
        )
        .max(3)
        .optional()
        .describe(
          "Up to 3 reference images to lock in the appearance of a person, character, or product. Veo 3.1 full model only."
        ),

      // ── Video extension ──────────────────────────────────────────────────
      videoToExtendUri: z
        .string()
        .optional()
        .describe(
          "URI of a previously generated Veo video to extend. Only works at 720p."
        ),
    }),

    execute: async ({
      prompt,
      aspectRatio,
      resolution,
      modelId: explicitModelId,
      provider,
      startFrameBase64,
      startFrameMimeType,
      endFrameBase64,
      endFrameMimeType,
      referenceImages,
      videoToExtendUri,
    }) => {
      try {
        const model = resolveVideoModelId(provider, explicitModelId);
        console.log(
          `[Video Gen] Generating video using ${model} via Vercel AI SDK & AI Gateway`
        );

        const videoModel = getVideoModel(model);
        const result = await videoModel.doGenerate({
          prompt,
          n: 1,
          aspectRatio: aspectRatio as `${number}:${number}`,
          resolution: undefined,
          duration: 8,
          fps: undefined,
          seed: undefined,
          image: undefined,
          providerOptions: {},
        });

        const rawVideoUris =
          result.videos
            ?.map((video: any) => video.url ?? video.data)
            .filter(Boolean) ?? [];

        if (rawVideoUris.length === 0) {
          throw new Error("No videos found in the AI Gateway response.");
        }

        const videoUris: string[] = [];

        for (const rawUri of rawVideoUris) {
          try {
            console.log(`Fetching video from gateway URI: ${rawUri}`);
            const videoRes = await fetch(rawUri, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; EtlesAgent/1.0)",
              },
            });

            if (!videoRes.ok) {
              console.error(
                `Failed to fetch video from gateway URI: ${rawUri} | Status: ${videoRes.status} ${videoRes.statusText}`
              );
              continue;
            }

            const videoBuffer = await videoRes.arrayBuffer();
            if (videoBuffer.byteLength === 0) {
              console.error(`Fetched video buffer is empty for URI: ${rawUri}`);
              continue;
            }

            const contentType =
              videoRes.headers.get("content-type") || "video/mp4";
            const extension = contentType.split("/")[1] || "mp4";
            const filename = `gemini-videos/${generateUUID()}.${extension}`;
            const blobData = await put(filename, Buffer.from(videoBuffer), {
              access: "public",
              contentType,
            });

            if (blobData?.url) {
              videoUris.push(blobData.url);
            }
          } catch (err) {
            console.error(`Error persisting video ${rawUri} to Blob:`, err);
          }
        }

        if (videoUris.length === 0) {
          throw new Error(
            "Failed to persist any generated videos to Blob storage. Check logs for fetch/put errors."
          );
        }

        return {
          status: "SUCCESS",
          url: videoUris[0],
          videoUris,
          prompt,
          model,
          aspectRatio,
          resolution,
          videoCount: videoUris.length,
          ...(startFrameBase64 && {
            mode: endFrameBase64 ? "first-and-last-frame" : "image-to-video",
          }),
          ...(referenceImages && {
            referenceImageCount: referenceImages.length,
          }),
          ...(videoToExtendUri && { mode: "video-extension" }),
          ...(!startFrameBase64 &&
            !videoToExtendUri && { mode: "text-to-video" }),
          markdown: videoUris.map((uri) => `![Video](${uri})`).join("\n\n"),
        };
      } catch (error) {
        console.error("Video generation failed:", error);

        return {
          error: "Failed to generate video.",
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
