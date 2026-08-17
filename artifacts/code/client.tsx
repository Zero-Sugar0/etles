import { toast } from "sonner";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import {
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/icons";
import { type CodeLanguage, CodeEditor } from "@/components/code-editor";
import { generateUUID } from "@/lib/utils";

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
}

type Metadata = {
  outputs: ConsoleOutput[];
  activeView: "code" | "preview";
  language: CodeLanguage;
  documentId?: string;
};

function inferCodeLanguage(title: string, content: string): CodeLanguage {
  const lowerTitle = title.toLowerCase();
  if (/\.(ts|tsx)$/.test(lowerTitle)) return "typescript";
  if (/\.(js|jsx|mjs|cjs)$/.test(lowerTitle)) return "javascript";
  if (/\.json$/.test(lowerTitle)) return "json";
  if (/\.html?$/.test(lowerTitle)) return "html";
  if (/\b(import pandas|import numpy|from [\w.]+ import|def \w+\()/i.test(content)) return "python";
  if (/\b(interface|type)\s+\w+\s*[={<]|:\s*(string|number|boolean)\b/.test(content)) return "typescript";
  if (/\b(const|let|function|console\.log|=>)\b/.test(content)) return "javascript";
  if (/^\s*[\[{]/.test(content) && /[\]}]\s*$/.test(content)) return "json";
  return "python";
}

function stripCodeFence(content: string) {
  return content
    .replace(/^\s*```[a-z0-9+#-]*\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function fileExtension(language: CodeLanguage) {
  return {
    python: "py",
    javascript: "js",
    typescript: "ts",
    json: "json",
    html: "html",
    text: "txt",
  }[language];
}

function persistCodeMetadata(metadata: Metadata) {
  if (typeof window === "undefined" || !metadata.documentId) return;
  window.localStorage.setItem(
    `code-artifact:${metadata.documentId}`,
    JSON.stringify(metadata)
  );
}

let pyodidePromise: Promise<any> | null = null;
async function loadPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const loader = (globalThis as any).loadPyodide;
      if (typeof loader !== "function") {
        throw new Error("Python runtime is not loaded yet. Please try again.");
      }
      return loader({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" });
    })().catch((error) => {
      pyodidePromise = null;
      throw error;
    });
  }
  return pyodidePromise;
}

export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",
  description:
    "Useful for code generation with syntax-aware editing, HTML preview, downloads, and optional Python execution.",
  initialize: ({ documentId, setMetadata }) => {
    const language: CodeLanguage = "text";
    let saved: Partial<Metadata> = {};
    try {
      if (typeof window !== "undefined") {
        saved = JSON.parse(
          window.localStorage.getItem(`code-artifact:${documentId}`) || "{}"
        );
      }
    } catch {
      saved = {};
    }
    setMetadata({
      documentId,
      language: saved.language ?? language,
      outputs: saved.outputs ?? [],
      activeView: saved.activeView ?? "code",
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-codeDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: draftArtifact.content + streamPart.data,
        isVisible:
          draftArtifact.status === "streaming" &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: "streaming",
      }));
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    const language = metadata?.language ?? inferCodeLanguage(props.title, props.content);
    const code = stripCodeFence(props.content);
    const isHtml =
      code.toLowerCase().startsWith("<!doctype html") ||
      code.toLowerCase().startsWith("<html");
    const detectedLanguage =
      language === "text" ? inferCodeLanguage(props.title, code) : language;
    const showPreview = isHtml && metadata?.activeView === "preview";
    return (
      <>
        {showPreview ? (
          <div className="h-full min-w-0 overflow-hidden rounded-md border border-border bg-background">
            <iframe
              className="h-full min-h-[70dvh] w-full"
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={code}
              title="HTML Preview"
            />
          </div>
        ) : (
          <div className="h-full min-w-0 px-1">
            <CodeEditor {...props} content={code} language={detectedLanguage} />
          </div>
        )}

        {!showPreview && metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata((current) => {
                const next = { ...current, outputs: [] };
                persistCodeMetadata(next);
                return next;
              });
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <CodeIcon size={18} />,
      description: "Show code",
      isActive: ({ metadata }) => metadata?.activeView !== "preview",
      isDisabled: ({ metadata }) => metadata?.activeView === "code",
      onClick: ({ metadata, setMetadata }) => {
        setMetadata({
          ...metadata,
          activeView: "code",
        });
      },
    },
    {
      icon: <EyeIcon size={18} />,
      description: "Show preview",
      isActive: ({ metadata }) => metadata?.activeView === "preview",
      onClick: async ({ content, metadata, setMetadata }) => {
        const isHtml =
          content.trim().toLowerCase().startsWith("<!doctype html") ||
          content.trim().toLowerCase().startsWith("<html");
        if (!isHtml) {
          toast.info("HTML preview is only available for HTML documents.");
          return;
        }
        setMetadata({
          ...metadata,
          activeView: "preview",
        });
      },
    },
    {
      icon: <PlayIcon size={18} />,
      label: "Run",
      description: "Execute code",
      isDisabled: ({ content, metadata, title }) =>
        (metadata?.language === "text"
          ? inferCodeLanguage(title, stripCodeFence(content))
          : metadata?.language) !== "python" ||
        (metadata?.outputs ?? []).some((output) =>
          ["in_progress", "loading_packages"].includes(output.status)
        ),
      onClick: async ({ content, metadata, setMetadata }) => {
        const language =
          metadata?.language === "text"
            ? inferCodeLanguage("", stripCodeFence(content))
            : metadata?.language;
        if (language !== "python") {
          toast.info("Run is currently available for Python code.");
          return;
        }
        const runId = generateUUID();
        const outputContent: ConsoleOutputContent[] = [];

        const updateRun = (nextOutput: ConsoleOutput) => {
          setMetadata((current) => {
            const next = {
              ...current,
              outputs: [
                ...current.outputs.filter((output) => output.id !== runId),
                nextOutput,
              ],
            };
            persistCodeMetadata(next);
            return next;
          });
        };

        updateRun({ id: runId, contents: [], status: "in_progress" });

        try {
          const currentPyodideInstance = await loadPyodide();

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith("data:image/png;base64")
                  ? "image"
                  : "text",
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              updateRun({
                id: runId,
                contents: [{ type: "text", value: message }],
                status: "loading_packages",
              });
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]
              );

              if (handler === "matplotlib") {
                await currentPyodideInstance.runPythonAsync(
                  "setup_matplotlib_output()"
                );
              }
            }
          }

          await Promise.race([
            currentPyodideInstance.runPythonAsync(stripCodeFence(content)),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Execution timed out after 30 seconds.")), 30_000)
            ),
          ]);

          updateRun({ id: runId, contents: outputContent, status: "completed" });
        } catch (error: any) {
          updateRun({
            id: runId,
            contents: [{ type: "text", value: error?.message || "Execution failed." }],
            status: "failed",
          });
        }
      },
    },
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
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Download code",
      onClick: ({ content, metadata, title }) => {
        const language =
          metadata?.language === "text" || !metadata?.language
            ? inferCodeLanguage(title, stripCodeFence(content))
            : metadata.language;
        const objectUrl = URL.createObjectURL(
          new Blob([stripCodeFence(content)], { type: "text/plain;charset=utf-8" })
        );
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "code"}.${fileExtension(language)}`;
        link.click();
        URL.revokeObjectURL(objectUrl);
        toast.success("Code download started.");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Add comments",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add comments to the code snippet for understanding",
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: "Add logs",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add logs to the code snippet for debugging",
            },
          ],
        });
      },
    },
  ],
});
