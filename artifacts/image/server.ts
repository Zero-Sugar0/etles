import { generateImage } from "ai";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { imageModels } from "@/lib/ai/models";
import { getImageModel } from "@/lib/ai/providers";

const SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
  "9:21",
]);

function resolveAspectRatio(data: unknown): `${number}:${number}` {
  const value =
    data && typeof data === "object"
      ? (data as { aspectRatio?: unknown }).aspectRatio
      : undefined;
  return typeof value === "string" && SUPPORTED_ASPECT_RATIOS.has(value)
    ? (value as `${number}:${number}`)
    : "1:1";
}

// Only trust a modelId when it is a known image model; the chat model passed
// through create/update-document is a language model and will not route.
function resolveImageModel(modelId?: string) {
  const isImageModel =
    typeof modelId === "string" &&
    imageModels.some((model) => model.id === modelId);
  return getImageModel(isImageModel ? modelId : undefined);
}

// Legacy image artifacts store raw base64, while the generate-image tool
// persists an "image-gallery" JSON payload with public blob URLs. Resolve both
// so updating an existing artifact feeds a real reference image instead of
// base64-decoding garbage into the prompt.
async function resolveReferenceImage(
  content: string | null
): Promise<Buffer | undefined> {
  const trimmed = content?.trim();
  if (!trimmed) return undefined;

  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 64) {
    try {
      return Buffer.from(trimmed, "base64");
    } catch {
      // Not base64; try the other formats below.
    }
  }

  if (trimmed.startsWith("data:image/")) {
    const separator = trimmed.indexOf(",");
    if (separator > 0) {
      try {
        return Buffer.from(trimmed.slice(separator + 1), "base64");
      } catch {
        // Fall through to URL extraction.
      }
    }
  }

  let url = /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
  if (!url) {
    try {
      const parsed = JSON.parse(trimmed) as {
        images?: Array<{ url?: unknown }>;
      };
      const first = Array.isArray(parsed.images)
        ? parsed.images.find((image) => typeof image?.url === "string")
        : undefined;
      url = typeof first?.url === "string" ? first.url : undefined;
    } catch {
      url = undefined;
    }
  }

  if (url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch {
      // Protected or unreachable references fall back to text-to-image below.
    }
  }

  return undefined;
}

export const imageDocumentHandler = createDocumentHandler<"image">({
  kind: "image",
  onCreateDocument: async ({ title, dataStream, modelId, data }) => {
    dataStream.write({
      type: "data-imageDelta",
      data: "",
      transient: true,
    });

    const { image } = await generateImage({
      model: resolveImageModel(modelId),
      prompt: title,
      aspectRatio: resolveAspectRatio(data),
    });

    dataStream.write({
      type: "data-imageDelta",
      data: image.base64,
      transient: true,
    });

    return image.base64;
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    dataStream.write({
      type: "data-imageDelta",
      data: "",
      transient: true,
    });

    const referenceImage = await resolveReferenceImage(
      document.content ?? null
    );

    const { image } = await generateImage({
      model: resolveImageModel(modelId),
      prompt: referenceImage
        ? { text: description, images: [referenceImage] }
        : description,
      aspectRatio: "1:1",
    });

    dataStream.write({
      type: "data-imageDelta",
      data: image.base64,
      transient: true,
    });

    return image.base64;
  },
});
