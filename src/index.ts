// ── Types ──────────────────────────────────────────────────────────
// Self-contained types compatible with OpenCode's plugin system.
// No external dependency on @opencode-ai/plugin needed.

type PluginInput = {
  directory: string;
  [key: string]: unknown;
};

type ModelConfig = {
  id: string;
  name: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  speed?: string;
  options?: Record<string, unknown>;
  variants?: Record<string, Record<string, unknown>>;
  limit?: { context?: number; output?: number };
};

type ProviderConfig = {
  api: string;
  npm: string;
  options?: Record<string, unknown>;
  models: Record<string, ModelConfig>;
};

type OpenCodeConfig = {
  provider?: Record<string, ProviderConfig>;
  [key: string]: unknown;
};

type Hooks = {
  config?: (config: OpenCodeConfig) => Promise<OpenCodeConfig>;
  "chat.headers"?: () => Promise<Record<string, string>>;
};

type Plugin = (input: PluginInput) => Promise<Hooks>;

// ── API Response Types ─────────────────────────────────────────────

type Capabilities = {
  reasoning: boolean;
  reasoning_levels?: string[];
  tool_calling: boolean;
  attachments: boolean;
};

type EnhancedModel = {
  id: string;
  name: string;
  context_length: number;
  max_output_tokens: number;
  capabilities: Capabilities;
};

type ModelsResponse = {
  object: string;
  data: EnhancedModel[];
};

// ── Constants ──────────────────────────────────────────────────────

const API_BASE = "https://api.lightweight.one/v1";
const CACHE_TTL = 3600_000; // 1 hour in ms
const VERSION = "1.0.0";

// ── Model Cache ────────────────────────────────────────────────────

let cachedModels: Record<string, ModelConfig> | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return cachedModels !== null && Date.now() - cacheTimestamp < CACHE_TTL;
}

// ── API Key Resolution ─────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.LIGHTWEIGHT_API_KEY;
  if (!key) {
    throw new Error(
      "[lightweight] LIGHTWEIGHT_API_KEY environment variable is required.\n" +
        "Set it in your shell: export LIGHTWEIGHT_API_KEY=lw_sk_...",
    );
  }
  if (!key.startsWith("lw_sk_")) {
    throw new Error(
      "[lightweight] Invalid API key format. Keys must start with 'lw_sk_'.",
    );
  }
  return key;
}

// ── Model Fetching ─────────────────────────────────────────────────

async function fetchModels(
  apiKey: string,
): Promise<Record<string, ModelConfig>> {
  if (isCacheValid()) return cachedModels!;

  const url = `${API_BASE}/models`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": `lightweight-opencode-plugin/${VERSION}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 429) {
    console.warn("[lightweight] Rate limited. Using cached models if available.");
    if (cachedModels) return cachedModels;
    throw new Error("[lightweight] Rate limited and no cached models available.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[lightweight] Failed to fetch models: ${res.status} ${body}`,
    );
  }

  const json = (await res.json()) as ModelsResponse;
  const models: Record<string, ModelConfig> = {};

  for (const m of json.data) {
    const isReasoning = m.capabilities.reasoning;
    const levels: string[] = m.capabilities.reasoning_levels || [];
    const hasXhigh = levels.includes("xhigh");

    // Build reasoning variants from API-reported levels
    let variants: Record<string, Record<string, unknown>> | undefined;
    if (isReasoning && levels.length > 0) {
      variants = {};
      for (const level of levels) {
        variants[level] = { reasoningEffort: level };
      }
    }

    models[m.id] = {
      id: m.id,
      name: m.name,
      attachment: m.capabilities.attachments,
      reasoning: isReasoning,
      tool_call: m.capabilities.tool_calling,
      ...(isReasoning && {
        speed: hasXhigh ? "slow" : "medium",
        options: { reasoningEffort: "high" },
        ...(variants && { variants }),
      }),
      limit: {
        context: m.context_length,
        output: m.max_output_tokens,
      },
    };
  }

  cachedModels = models;
  cacheTimestamp = Date.now();

  console.log(
    `[lightweight] Loaded ${Object.keys(models).length} models from API.`,
  );

  return models;
}

// ── Plugin Entry Point ─────────────────────────────────────────────

const plugin: Plugin = async () => {
  const apiKey = getApiKey();

  return {
    async config(config) {
      try {
        const models = await fetchModels(apiKey);

        config.provider = config.provider || {};
        config.provider.lightweight = {
          api: API_BASE,
          npm: "@ai-sdk/openai",
          options: {
            baseURL: API_BASE,
            apiKey,
          },
          models,
        };

        return config;
      } catch (err) {
        console.error(
          `[lightweight] Plugin config error: ${err instanceof Error ? err.message : err}`,
        );
        return config;
      }
    },

    async "chat.headers"() {
      return {
        "X-Client": "opencode",
        "X-Plugin-Version": VERSION,
      };
    },
  };
};

export default plugin;
