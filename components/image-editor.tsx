import cn from "classnames";
import { LoaderIcon } from "./icons";

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
      ) : (
        <picture className="block min-w-0 max-w-full">
          <img
            alt={title}
            className={cn("h-fit w-full max-w-[800px]", {
              "p-3 sm:p-8 md:p-20": !isInline,
            })}
            src={`data:image/png;base64,${content}`}
          />
        </picture>
      )}
    </div>
  );
}
