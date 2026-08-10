// Curated list of top models from Vercel AI Gateway
//lib/ai/models.ts

export const DEFAULT_CHAT_MODEL = "xai/grok-4.1-fast-reasoning";

export type ImageModelProvider = "google" | "openai" | "bytedance" | "xai";
export type VideoModelProvider = "google" | "bytedance" | "xai" | "minimax";

export type ImageModel = {
  id: string;
  name: string;
  provider: ImageModelProvider;
  description: string;
};

export type VideoModel = {
  id: string;
  name: string;
  provider: VideoModelProvider;
  description: string;
};

export const DEFAULT_IMAGE_MODEL_ID = "xai/grok-imagine-image";
export const DEFAULT_VIDEO_MODEL_ID = "google/veo-3.1-lite-generate-001";

export const imageModels: ImageModel[] = [
  {
    id: "google/gemini-3.1-flash-lite-image",
    name: "Gemini 3.1 Flash Lite Image",
    provider: "google",
    description:
      "Fast image generation model for lightweight edits and renders.",
  },
  {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    provider: "openai",
    description: "OpenAI image generation model for rich visual outputs.",
  },
  {
    id: "bytedance/seedream-5.0-pro",
    name: "Seedream 5.0 Pro",
    provider: "bytedance",
    description: "ByteDance advanced image generation model.",
  },
  {
    id: "bytedance/seedream-4.5",
    name: "Seedream 4.5",
    provider: "bytedance",
    description:
      "ByteDance image generation model for balanced quality and speed.",
  },
  {
    id: "xai/grok-imagine-image",
    name: "Grok Imagine Image",
    provider: "xai",
    description: "xAI image generation model for creative image creation.",
  },
];

export const videoModels: VideoModel[] = [
  {
    id: "minimax/minimax-h3",
    name: "MiniMax H3",
    provider: "minimax",
    description:
      "Text-to-video and image-to-video generation with multimodal references.",
  },
  {
    id: "xai/grok-imagine-video-1.5",
    name: "Grok Imagine Video 1.5",
    provider: "xai",
    description:
      "Fast video generation with prompt-driven motion and style control.",
  },
  {
    id: "bytedance/seedance-2.0",
    name: "Seedance 2.0",
    provider: "bytedance",
    description:
      "Advanced video generation with audio-visual and multimodal inputs.",
  },
  {
    id: "google/veo-3.1-lite-generate-001",
    name: "Veo 3.1 Lite",
    provider: "google",
    description:
      "Fast and cost-effective video generation with Google Veo 3.1 Lite.",
  },
];

export function resolveImageModelId(
  provider?: string,
  explicitModelId?: string
) {
  const normalizedExplicitModelId = explicitModelId?.trim();
  if (normalizedExplicitModelId) {
    return normalizedExplicitModelId;
  }

  const normalizedProvider = provider?.trim().toLowerCase();
  if (!normalizedProvider) {
    return DEFAULT_IMAGE_MODEL_ID;
  }

  const matchedModel = imageModels.find(
    (model) => model.provider === normalizedProvider
  );

  return matchedModel?.id ?? DEFAULT_IMAGE_MODEL_ID;
}

export function resolveVideoModelId(
  provider?: string,
  explicitModelId?: string
) {
  const normalizedExplicitModelId = explicitModelId?.trim();
  if (normalizedExplicitModelId) {
    return normalizedExplicitModelId;
  }

  const normalizedProvider = provider?.trim().toLowerCase();
  if (!normalizedProvider) {
    return DEFAULT_VIDEO_MODEL_ID;
  }

  const matchedModel = videoModels.find(
    (model) => model.provider === normalizedProvider
  );

  return matchedModel?.id ?? DEFAULT_VIDEO_MODEL_ID;
}

export const titleModel = {
  description: "Fast model for title generation",
  gatewayOrder: ["google", "fireworks"],
  id: "google/gemma-4-26b-a4b-it",
  name: "Gemma 4 26B",
  provider: "google",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  features: {
    reasoning: boolean;
    vision: boolean;
    tools: boolean;
  };
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  // Anthropic
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and affordable, great for everyday tasks",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description:
      "Flagship balanced model with superb thinking and vision capabilities",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  {
    id: "anthropic/claude-sonnet-4.8",
    name: "Claude Sonnet 4.8",
    provider: "anthropic",
    description: "Advanced next-generation flagship model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    description: "Next-gen pinnacle reasoning model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  // OpenAI
  {
    id: "openai/gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "openai",
    description: "Reasoning-first multimodal model for complex agent work",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["openai", "azure", "bedrock"],
    reasoningEffort: "high",
  },
  {
    id: "openai/gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    provider: "openai",
    description: "Fast coding model with reasoning, vision, and tool use",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["openai", "azure", "bedrock"],
    reasoningEffort: "medium",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "High-performance multimodal model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Affordable and fast multimodal model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Advanced GPT-4.1 flagship model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast and cost-effective for simple tasks",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Ultra-fast compact model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Most capable OpenAI model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Ultra-compact high speed model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["openai", "azure"],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open source large scale model",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
    reasoningEffort: "low",
  },
  // Google (Starts from 3 upwards)
  {
    id: "google/gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    description: "Advanced Gemini 3 architecture speed king",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    description: "Ultra fast and affordable preview model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    description: "Powerful next-gen reasoning intelligence",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "google",
    description: "Highly lightweight Gemini 3.1 model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    provider: "google",
    description: "Latest lightweight preview model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    description:
      "Ultimate speed, efficiency and capabilities in 3.5 generation",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "google/gemma-4-26b-a4b-it",
    name: "Gemma 4 26B",
    provider: "google",
    description: "Gemma 4 open weights model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "fireworks"],
  },
  // DeepSeek (Non-reasoning starts from 3.1+)
  {
    id: "deepseek/deepseek-v3.1",
    name: "DeepSeek V3.1",
    provider: "deepseek",
    description: "Upgraded DeepSeek V3 efficiency",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["deepseek", "bedrock"],
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "deepseek",
    description: "Extremely fast next-gen reasoning model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["deepseek", "bedrock"],
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    description: "High-intelligence flagship DeepSeek V4",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["deepseek", "bedrock"],
  },
  // Perplexity
  {
    id: "perplexity/sonar",
    name: "Sonar",
    provider: "perplexity",
    description: "Search-augmented model",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["perplexity"],
  },
  // NVIDIA
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano",
    provider: "nvidia",
    description: "Compact efficient model",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["nvidia"],
  },
  // MoonshotAI (Kimi)
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Next generation Kimi model",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "moonshotai",
    description: "Latest Kimi model",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "moonshotai/kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    provider: "moonshotai",
    description: "Advanced coding flagship from Moonshot",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "moonshotai/kimi-k2.7-code-highspeed",
    name: "Kimi K2.7 Code Speed",
    provider: "moonshotai",
    description: "Fast-execution programming model",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
  },
  // Minimax (Starts from 2.5+)
  {
    id: "minimax/minimax-m2.5",
    name: "Minimax M2.5",
    provider: "minimax",
    description: "Standard M2.5 performance",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["minimax"],
  },
  {
    id: "minimax/minimax-m2.5-highspeed",
    name: "Minimax M2.5 Speed",
    provider: "minimax",
    description: "Optimized for extreme speed",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["minimax"],
  },
  {
    id: "minimax/minimax-m2.7",
    name: "Minimax M2.7",
    provider: "minimax",
    description: "Advanced multi-modal capabilities",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["minimax"],
  },
  {
    id: "minimax/minimax-m3",
    name: "Minimax M3",
    provider: "minimax",
    description: "Multi-modal reasoning flagship",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["minimax"],
  },
  // ZAI / GLM (Starts from 5.x)
  {
    id: "zai/glm-5",
    name: "GLM-5",
    provider: "zai",
    description: "High performance GLM model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["zai"],
  },
  {
    id: "zai/glm-5-turbo",
    name: "GLM-5 Turbo",
    provider: "zai",
    description: "Agent-optimized GLM-5 Turbo model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["zai"],
  },
  {
    id: "zai/glm-5.1",
    name: "GLM-5.1",
    provider: "zai",
    description: "Enhanced GLM-5 model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["zai"],
  },
  {
    id: "zai/glm-5.2",
    name: "GLM-5.2",
    provider: "zai",
    description: "Ultra long-context flagship GLM-5.2",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["zai"],
  },
  {
    id: "zai/glm-5v-turbo",
    name: "GLM-5V Turbo",
    provider: "zai",
    description: "Multimodal Agentic GLM",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["zai"],
  },
  // xAI (Grok 3 and Grok Build)
  {
    id: "xai/grok-build-0.1",
    name: "Grok Build 0.1",
    provider: "xai",
    description: "Grok software development optimized model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  {
    id: "xai/grok-4.1-fast-reasoning",
    name: "Grok 4.1 Fast Reasoning",
    provider: "xai",
    description: "Fast reasoning-focused Grok model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  {
    id: "xai/grok-4.20-reasoning",
    name: "Grok 4.20 Reasoning",
    provider: "xai",
    description: "Advanced reasoning Grok model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  {
    id: "xai/grok-4.5",
    name: "Grok 4.5",
    provider: "xai",
    description: "Latest Grok flagship model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description: "Pinnacle flagship Grok multimodal model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  // Inception
  {
    id: "inception/mercury-2",
    name: "Mercury 2",
    provider: "inception",
    description: "Advanced reasoning and capabilities",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["inception"],
  },
  // Alibaba (Qwen Latest Only)
  {
    id: "alibaba/qwen-3.6-max-preview",
    name: "Qwen 3.6 Max Preview",
    provider: "alibaba",
    description: "Flagship preview of Qwen 3.6 family",
    features: { reasoning: false, vision: true, tools: true },
    gatewayOrder: ["alibaba"],
  },
  {
    id: "alibaba/qwen3-coder-plus",
    name: "Qwen 3 Coder Plus",
    provider: "alibaba",
    description: "Advanced coding flagship of Qwen 3 series",
    features: { reasoning: false, vision: false, tools: true },
    gatewayOrder: ["alibaba"],
  },
  {
    id: "alibaba/qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    provider: "alibaba",
    description: "High-capability Qwen 3.7 model with strong reasoning",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["alibaba"],
  },
  {
    id: "alibaba/qwen3.8-max",
    name: "Qwen 3.8 Max",
    provider: "alibaba",
    description: "Latest flagship Max model of the Qwen 3.8 family",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["alibaba"],
  },
  // Meta
  {
    id: "meta/muse-spark-1.2",
    name: "Muse Spark 1.2",
    provider: "meta",
    description: "Meta's multimodal reasoning model with vision and tool use",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["meta"],
  },
  {
    id: "meta/muse-spark-1.2-contributor",
    name: "Muse Spark 1.2 Contributor",
    provider: "meta",
    description:
      "Contributor-tier Muse Spark with advanced reasoning and vision",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["meta"],
  },
  // Reasoning models (extended thinking) - classified as provider: reasoning for UI grouping
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "reasoning",
    description: "Google reasoning preview",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["google", "google-vertex"],
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "reasoning",
    description: "Flagship open-source reasoning model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["deepseek", "bedrock"],
  },
  {
    id: "anthropic/claude-sonnet-4.5-thinking",
    name: "Claude Sonnet 4.5 Thinking",
    provider: "reasoning",
    description: "Extended thinking flagship model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  {
    id: "anthropic/claude-sonnet-4.8-thinking",
    name: "Claude Sonnet 4.8 Thinking",
    provider: "reasoning",
    description: "Supreme extended thinking model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["anthropic", "bedrock"],
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "reasoning",
    description: "Moonshot reasoning model",
    features: { reasoning: true, vision: false, tools: true },
    gatewayOrder: ["fireworks", "bedrock"],
  },
  {
    id: "xai/grok-3-thinking",
    name: "Grok 3 Thinking",
    provider: "reasoning",
    description: "Grok 3 extended reasoning capabilities",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["xai"],
  },
  {
    id: "alibaba/qwen3-max-thinking",
    name: "Qwen 3 Max Thinking",
    provider: "reasoning",
    description: "Advanced reasoning Qwen model",
    features: { reasoning: true, vision: true, tools: true },
    gatewayOrder: ["alibaba"],
  },
];

// Group models by provider for UI
export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);

export const isDemo = process.env.IS_DEMO === "1";

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  const results = await Promise.all(
    chatModels.map(async (model) => {
      try {
        const res = await fetch(
          `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
          { next: { revalidate: 86_400 } }
        );
        if (!res.ok) {
          return [model.id, { reasoning: false, tools: false, vision: false }];
        }

        const json = await res.json();
        const endpoints = json.data?.endpoints ?? [];
        const params = new Set(
          endpoints.flatMap(
            (e: { supported_parameters?: string[] }) =>
              e.supported_parameters ?? []
          )
        );
        const inputModalities = new Set(
          json.data?.architecture?.input_modalities ?? []
        );

        return [
          model.id,
          {
            reasoning: params.has("reasoning"),
            tools: params.has("tools"),
            vision: inputModalities.has("image"),
          },
        ];
      } catch {
        return [model.id, { reasoning: false, tools: false, vision: false }];
      }
    })
  );

  return Object.fromEntries(results);
}

type GatewayModel = {
  id: string;
  name: string;
  type?: string;
  tags?: string[];
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter((m: GatewayModel) => m.type === "language")
      .map((m: GatewayModel) => ({
        capabilities: {
          reasoning: m.tags?.includes("reasoning") ?? false,
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
        },
        description: "",
        features: {
          reasoning: m.tags?.includes("reasoning") ?? false,
          tools: m.tags?.includes("tool-use") ?? false,
          vision: m.tags?.includes("vision") ?? false,
        },
        id: m.id,
        name: m.name,
        provider: m.id.split("/")[0],
      }));
  } catch {
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export type ModelAvailability = "healthy" | "impacted" | "unknown";

type GatewayEndpoint = {
  provider_name?: string;
  status?: number;
  uptime_last_15m?: number;
  uptime_last_1h?: number;
  latency_last_1h?: {
    p50?: number;
    p95?: number;
  };
};

const PROVIDER_IMPACTED_UPTIME_THRESHOLD = 99;
const PROVIDER_IMPACTED_P50_MS = 10_000;
const PROVIDER_IMPACTED_P95_MS = 30_000;

function isEndpointImpacted(endpoint: GatewayEndpoint) {
  return (
    (endpoint.status !== undefined && endpoint.status !== 0) ||
    (endpoint.uptime_last_15m !== undefined &&
      endpoint.uptime_last_15m < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.uptime_last_1h !== undefined &&
      endpoint.uptime_last_1h < PROVIDER_IMPACTED_UPTIME_THRESHOLD) ||
    (endpoint.latency_last_1h?.p50 !== undefined &&
      endpoint.latency_last_1h.p50 > PROVIDER_IMPACTED_P50_MS) ||
    (endpoint.latency_last_1h?.p95 !== undefined &&
      endpoint.latency_last_1h.p95 > PROVIDER_IMPACTED_P95_MS)
  );
}

export async function getModelAvailability(
  modelId: string
): Promise<ModelAvailability> {
  const model = chatModels.find((item) => item.id === modelId);

  if (!model) {
    return "unknown";
  }

  try {
    const res = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${model.id}/endpoints`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) {
      return "unknown";
    }

    const json = await res.json();
    const endpoints = (json.data?.endpoints ?? []) as GatewayEndpoint[];

    if (endpoints.length === 0) {
      return "unknown";
    }

    return endpoints.some(isEndpointImpacted) ? "impacted" : "healthy";
  } catch {
    return "unknown";
  }
}
