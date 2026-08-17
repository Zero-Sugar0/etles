import cn from "classnames";
import { LoaderIcon } from "./icons";
import { GeneratedImageCarousel } from "./generated-image-carousel";

export type ImageGalleryItem = {
  url: string;
  prompt?: string;
  createdAt?: string;
  alt?: string;
};

export function parseImageContent(content: string): ImageGalleryItem[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { images?: unknown };
    if (Array.isArray(parsed.images)) {
      return parsed.images.filter(
        (image): image is ImageGalleryItem =>
          Boolean(image && typeof image === "object" && "url" in image && typeof image.url === "string")
      );
    }
  } catch {
    // Legacy image documents store raw base64 content.
  }

  if (content.startsWith("http://") || content.startsWith("https://")) {
    return [{ url: content }];
  }

  return [{ url: `data:image/png;base64,${content}` }];
}

type ImageEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline: boolean;
};

export function ImageEditor({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) {
  const images = parseImageContent(content);

  return (
    <div
      className={cn("flex min-w-0 w-full flex-row items-center justify-center overflow-hidden", {
        "h-[calc(100dvh-60px)]": !isInline,
        "h-[200px]": isInline,
      })}
    >
      {status === "streaming" ? (
        <div className="flex flex-row items-center gap-4">
          {!isInline && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
          <div>Generating Image...</div>
        </div>
      ) : images.length > 0 ? (
        <div className={cn("w-full min-w-0", !isInline && "px-3 py-6 sm:px-8 md:px-16")}>
          <GeneratedImageCarousel
            images={images.map((image, index) => ({
              ...image,
              alt: image.alt ?? `${title} ${index + 1}`,
            }))}
          />
        </div>
      ) : (
        <div className="px-6 text-sm text-muted-foreground">No image available.</div>
      )}
    </div>
  );
}
