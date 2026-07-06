"use client";

import Image from "next/image";
import { type ComponentProps, type ReactNode, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModelSelectorProps = ComponentProps<typeof Dialog>;

export const ModelSelector = (props: ModelSelectorProps) => (
  <Dialog {...props} />
);

export type ModelSelectorTriggerProps = ComponentProps<typeof DialogTrigger>;

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <DialogTrigger {...props} />
);

export type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode;
};

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
  ...props
}: ModelSelectorContentProps) => (
  <DialogContent className={cn("p-0 sm:max-w-[340px] overflow-hidden border border-border/40 bg-popover/95 backdrop-blur-md shadow-2xl rounded-xl", className)} {...props}>
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command className="**:data-[slot=command-input-wrapper]:h-auto bg-transparent">
      {children}
    </Command>
  </DialogContent>
);

export type ModelSelectorDialogProps = ComponentProps<typeof CommandDialog>;

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => (
  <CommandDialog {...props} />
);

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

export const ModelSelectorInput = ({
  className,
  ...props
}: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-10 text-xs bg-transparent border-b border-border/20", className)} {...props} />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

export const ModelSelectorList = ({ className, ...props }: ModelSelectorListProps) => (
  <CommandList className={cn("max-h-[300px] p-1.5 overflow-y-auto overflow-x-hidden", className)} {...props} />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
  <CommandEmpty {...props} />
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

export const ModelSelectorGroup = ({ className, ...props }: ModelSelectorGroupProps) => (
  <CommandGroup
    className={cn(
      "px-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2",
      className
    )}
    {...props}
  />
);

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>;

export const ModelSelectorItem = ({ className, ...props }: ModelSelectorItemProps) => (
  <CommandItem
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors duration-150 data-[selected=true]:bg-accent/80 data-[selected=true]:text-accent-foreground",
      className
    )}
    {...props}
  />
);

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
);

export type ModelSelectorLogoProps = {
  className?: string;
  provider:
    | "moonshotai-cn"
    | "lucidquery"
    | "moonshotai"
    | "zai-coding-plan"
    | "alibaba"
    | "xai"
    | "vultr"
    | "nvidia"
    | "upstage"
    | "groq"
    | "github-copilot"
    | "mistral"
    | "vercel"
    | "nebius"
    | "deepseek"
    | "alibaba-cn"
    | "google-vertex-anthropic"
    | "venice"
    | "chutes"
    | "cortecs"
    | "github-models"
    | "togetherai"
    | "azure"
    | "baseten"
    | "huggingface"
    | "opencode"
    | "fastrouter"
    | "google"
    | "google-vertex"
    | "cloudflare-workers-ai"
    | "inception"
    | "wandb"
    | "openai"
    | "zhipuai-coding-plan"
    | "perplexity"
    | "openrouter"
    | "zenmux"
    | "v0"
    | "iflowcn"
    | "synthetic"
    | "deepinfra"
    | "zhipuai"
    | "submodel"
    | "zai"
    | "inference"
    | "requesty"
    | "morph"
    | "lmstudio"
    | "anthropic"
    | "aihubmix"
    | "fireworks-ai"
    | "modelscope"
    | "llama"
    | "scaleway"
    | "amazon-bedrock"
    | "cerebras"
    | (string & {});
};

export const ModelSelectorLogo = ({
  provider,
  className,
}: ModelSelectorLogoProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className={cn("size-3.5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0", className)}>
        <span className="text-[8px] font-bold text-primary/80 uppercase">
          {provider ? provider[0] : "?"}
        </span>
      </div>
    );
  }

  return (
    <Image
      alt={`${provider} logo`}
      className={cn("size-3.5 dark:invert rounded-sm object-contain shrink-0", className)}
      height={14}
      src={`https://models.dev/logos/${provider}.svg`}
      unoptimized
      width={14}
      onError={() => setHasError(true)}
    />
  );
};

export type ModelSelectorLogoGroupProps = ComponentProps<"div">;

export const ModelSelectorLogoGroup = ({
  className,
  ...props
}: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      "flex shrink-0 items-center -space-x-1 [&>img]:rounded-full [&>img]:bg-background [&>img]:p-px [&>img]:ring-1 dark:[&>img]:bg-foreground ring-border/20",
      className
    )}
    {...props}
  />
);

export type ModelSelectorNameProps = ComponentProps<"span">;

export const ModelSelectorName = ({
  className,
  ...props
}: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left font-medium", className)} {...props} />
);
