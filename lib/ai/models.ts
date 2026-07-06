// Curated list of top models from Vercel AI Gateway
//lib/ai/models.ts
export const DEFAULT_CHAT_MODEL = "google/gemini-3-flash-preview";

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
};

export const chatModels: ChatModel[] = [
  // Anthropic
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description: "Fast and lightweight model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description: "Efficient and smart lightweight model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and affordable, great for everyday tasks",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    provider: "anthropic",
    description: "Next-gen pinnacle reasoning model",
    features: { reasoning: true, vision: true, tools: true },
  },
  // OpenAI
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "High-performance multimodal model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Affordable and fast multimodal model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Advanced GPT-4.1 flagship model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast and cost-effective for simple tasks",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Ultra-fast compact model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Most capable OpenAI model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Ultra-compact high speed model",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "openai",
    description: "Open source large scale model",
    features: { reasoning: false, vision: true, tools: true },
  },
  // Google (Starts from 3 upwards)
  {
    id: "google/gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "google",
    description: "Advanced Gemini 3 architecture speed king",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
    description: "Ultra fast and affordable preview model",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    description: "Powerful next-gen reasoning intelligence",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "google",
    description: "Highly lightweight Gemini 3.1 model",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    provider: "google",
    description: "Latest lightweight preview model",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    description: "Ultimate speed, efficiency and capabilities in 3.5 generation",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "google/gemma-4-26b-a4b-it",
    name: "Gemma 4 26B",
    provider: "google",
    description: "Gemma 4 open weights model",
    features: { reasoning: true, vision: true, tools: true },
  },
  // DeepSeek (Non-reasoning starts from 3.1+)
  {
    id: "deepseek/deepseek-v3.1",
    name: "DeepSeek V3.1",
    provider: "deepseek",
    description: "Upgraded DeepSeek V3 efficiency",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "deepseek",
    description: "Extremely fast next-gen reasoning model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    description: "High-intelligence flagship DeepSeek V4",
    features: { reasoning: true, vision: false, tools: true },
  },
  // Perplexity
  {
    id: "perplexity/sonar",
    name: "Sonar",
    provider: "perplexity",
    description: "Search-augmented model",
    features: { reasoning: false, vision: false, tools: true },
  },
  // NVIDIA
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano",
    provider: "nvidia",
    description: "Compact efficient model",
    features: { reasoning: false, vision: false, tools: true },
  },
  // MoonshotAI (Kimi)
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    provider: "moonshotai",
    description: "Next generation Kimi model",
    features: { reasoning: false, vision: false, tools: true },
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "moonshotai",
    description: "Latest Kimi model",
    features: { reasoning: false, vision: false, tools: true },
  },
  {
    id: "moonshotai/kimi-k2.7-code",
    name: "Kimi K2.7 Code",
    provider: "moonshotai",
    description: "Advanced coding flagship from Moonshot",
    features: { reasoning: false, vision: false, tools: true },
  },
  {
    id: "moonshotai/kimi-k2.7-code-highspeed",
    name: "Kimi K2.7 Code Speed",
    provider: "moonshotai",
    description: "Fast-execution programming model",
    features: { reasoning: false, vision: false, tools: true },
  },
  // Minimax (Starts from 2.5+)
  {
    id: "minimax/minimax-m2.5",
    name: "Minimax M2.5",
    provider: "minimax",
    description: "Standard M2.5 performance",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "minimax/minimax-m2.5-highspeed",
    name: "Minimax M2.5 Speed",
    provider: "minimax",
    description: "Optimized for extreme speed",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "minimax/minimax-m2.7",
    name: "Minimax M2.7",
    provider: "minimax",
    description: "Advanced multi-modal capabilities",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "minimax/minimax-m3",
    name: "Minimax M3",
    provider: "minimax",
    description: "Multi-modal reasoning flagship",
    features: { reasoning: true, vision: true, tools: true },
  },
  // ZAI / GLM (Starts from 5.x)
  {
    id: "zai/glm-5",
    name: "GLM-5",
    provider: "zai",
    description: "High performance GLM model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "zai/glm-5-turbo",
    name: "GLM-5 Turbo",
    provider: "zai",
    description: "Agent-optimized GLM-5 Turbo model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "zai/glm-5.1",
    name: "GLM-5.1",
    provider: "zai",
    description: "Enhanced GLM-5 model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "zai/glm-5.2",
    name: "GLM-5.2",
    provider: "zai",
    description: "Ultra long-context flagship GLM-5.2",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "zai/glm-5v-turbo",
    name: "GLM-5V Turbo",
    provider: "zai",
    description: "Multimodal Agentic GLM",
    features: { reasoning: true, vision: true, tools: true },
  },
  // xAI (Grok 3 and Grok Build)
  {
    id: "xai/grok-build-0.1",
    name: "Grok Build 0.1",
    provider: "xai",
    description: "Grok software development optimized model",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "xai/grok-3",
    name: "Grok 3",
    provider: "xai",
    description: "Pinnacle flagship Grok multimodal model",
    features: { reasoning: true, vision: true, tools: true },
  },
  // Inception
  {
    id: "inception/mercury-2",
    name: "Mercury 2",
    provider: "inception",
    description: "Advanced reasoning and capabilities",
    features: { reasoning: true, vision: false, tools: true },
  },
  // Alibaba (Qwen Latest Only)
  {
    id: "alibaba/qwen-3.6-max-preview",
    name: "Qwen 3.6 Max Preview",
    provider: "alibaba",
    description: "Flagship preview of Qwen 3.6 family",
    features: { reasoning: false, vision: true, tools: true },
  },
  {
    id: "alibaba/qwen3-coder-plus",
    name: "Qwen 3 Coder Plus",
    provider: "alibaba",
    description: "Advanced coding flagship of Qwen 3 series",
    features: { reasoning: false, vision: false, tools: true },
  },
  // Reasoning models (extended thinking) - classified as provider: reasoning for UI grouping
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "reasoning",
    description: "Google reasoning preview",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "reasoning",
    description: "Flagship open-source reasoning model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "anthropic/claude-3.7-sonnet-thinking",
    name: "Claude 3.7 Sonnet",
    provider: "reasoning",
    description: "Extended thinking for complex problems",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "reasoning",
    description: "Moonshot reasoning model",
    features: { reasoning: true, vision: false, tools: true },
  },
  {
    id: "xai/grok-3-thinking",
    name: "Grok 3 Thinking",
    provider: "reasoning",
    description: "Grok 3 extended reasoning capabilities",
    features: { reasoning: true, vision: true, tools: true },
  },
  {
    id: "alibaba/qwen3-max-thinking",
    name: "Qwen 3 Max Thinking",
    provider: "reasoning",
    description: "Advanced reasoning Qwen model",
    features: { reasoning: true, vision: true, tools: true },
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
