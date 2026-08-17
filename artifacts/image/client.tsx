import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { ImageEditor, parseImageContent } from "@/components/image-editor";

export const imageArtifact = new Artifact({
  kind: "image",
  description: "Useful for image generation",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-imageDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ImageEditor,
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy image to clipboard",
      onClick: ({ content }) => {
        const image = parseImageContent(content)[0];
        if (image?.url && !image.url.startsWith("data:")) {
          void navigator.clipboard.writeText(image.url);
          toast.success("Image URL copied to clipboard!");
          return;
        }
        const img = new Image();
        img.src = image?.url ?? `data:image/png;base64,${content}`;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
            }
          }, "image/png");
        };

        toast.success("Copied image to clipboard!");
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Download generated image(s)",
      onClick: async ({ content, title }) => {
        const images = parseImageContent(content);
        if (!images.length) {
          toast.error("No image is available to download.");
          return;
        }

        const baseName = (title || "generated-image")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "generated-image";

        for (const [index, image] of images.entries()) {
          const filename = `${baseName}${images.length > 1 ? `-${index + 1}` : ""}.png`;
          try {
            const response = await fetch(image.url);
            if (!response.ok) throw new Error("Image download failed");
            const blobUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
          } catch {
            // Some public blob hosts reject browser fetches; let the browser
            // navigate to the public asset as a reliable fallback.
            const link = document.createElement("a");
            link.href = image.url;
            link.download = filename;
            link.target = "_blank";
            link.rel = "noreferrer";
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        }

        toast.success(
          images.length > 1
            ? `${images.length} images queued for download.`
            : "Image download started."
        );
      },
    },
  ],
  toolbar: [],
});
