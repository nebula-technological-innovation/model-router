import type { ChatRequest } from '@nebula/gateway-sdk';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TaskType =
  | 'code_review'
  | 'code_generation'
  | 'security_analysis'
  | 'creative_writing'
  | 'reasoning'
  | 'general'
  | 'fast'
  | 'vision'
  | 'voice';

export interface RoutingDecision {
  namespace: string;
  provider: string;
  model: string;
  reason: string;
  free: boolean;
  fallbackChain: FallbackEntry[];
  estimatedCostTier: 'free' | 'low' | 'medium' | 'high';
  taskType: TaskType;
}

export interface FallbackEntry {
  provider: string;
  model: string;
  free: boolean;
}

export interface ProviderHealthStatus {
  provider: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  lastChecked: number;
}

export interface RoutingConfig {
  /** Max tokens allowed for the request (enforces budget). */
  maxTokens?: number;
  /** Latency budget in ms — prefer faster providers when set. */
  latencyBudgetMs?: number;
  /** Cost tier preference — 'free' | 'low' | 'medium' | 'high'. */
  costTier?: 'free' | 'low' | 'medium' | 'high';
  /** Override task type detection. */
  taskType?: TaskType;
  /** Preferred provider (tried first if healthy). */
  preferredProvider?: string;
  /** Provider health map for real-time status. */
  providerHealth?: Record<string, ProviderHealthStatus>;
  /** Token budget enforcement — reject if model can't handle it. */
  tokenBudget?: number;
}

export interface ModelEntry {
  provider: string;
  model: string;
  reason: string;
  free: boolean;
  maxTokens: number;
  avgLatencyMs: number;
  costTier: 'free' | 'low' | 'medium' | 'high';
  taskAffinity: TaskType[];
}

// ─────────────────────────────────────────────────────────────
// Model catalog — single source of truth for routing
// ─────────────────────────────────────────────────────────────

const MODEL_CATALOG: ModelEntry[] = [
  // OpenRouter free models
  {
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    reason: 'free tier — OpenRouter free model for code review and generation',
    free: true,
    maxTokens: 32000,
    avgLatencyMs: 3000,
    costTier: 'free',
    taskAffinity: ['code_review', 'code_generation'],
  },
  {
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    reason: 'free tier — OpenRouter free model for security analysis and reasoning',
    free: true,
    maxTokens: 32000,
    avgLatencyMs: 4000,
    costTier: 'free',
    taskAffinity: ['security_analysis', 'reasoning'],
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-3-4b-it:free',
    reason: 'free tier — OpenRouter free model for general and creative tasks',
    free: true,
    maxTokens: 8000,
    avgLatencyMs: 2000,
    costTier: 'free',
    taskAffinity: ['creative_writing', 'general'],
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-3b-instruct:free',
    reason: 'free tier — OpenRouter free model for fast general tasks',
    free: true,
    maxTokens: 4000,
    avgLatencyMs: 1500,
    costTier: 'free',
    taskAffinity: ['fast', 'general'],
  },
  // Ollama local models
  {
    provider: 'ollama',
    model: 'qwen3:latest',
    reason: 'free tier — local ollama for multi-agent orchestration and systems work',
    free: true,
    maxTokens: 32000,
    avgLatencyMs: 5000,
    costTier: 'free',
    taskAffinity: ['reasoning', 'general'],
  },
  {
    provider: 'ollama',
    model: 'gemma3:1b',
    reason: 'free tier — low-cost local ollama execution path',
    free: true,
    maxTokens: 4000,
    avgLatencyMs: 500,
    costTier: 'free',
    taskAffinity: ['fast', 'voice'],
  },
  {
    provider: 'ollama',
    model: 'qwen3-vl:235b-cloud',
    reason: 'free tier — local ollama for vision and multimodal analysis',
    free: true,
    maxTokens: 32000,
    avgLatencyMs: 8000,
    costTier: 'free',
    taskAffinity: ['vision'],
  },
  // Aether local models (aether-llm-host port 8199)
  {
    provider: 'aether',
    model: 'qwen3:8b',
    reason: 'free tier — local aether-llm-host model for reasoning, code, and general tasks',
    free: true,
    maxTokens: 32000,
    avgLatencyMs: 2000,
    costTier: 'free',
    taskAffinity: ['reasoning', 'general', 'code_review', 'code_generation', 'creative_writing'],
  },
  {
    provider: 'aether',
    model: 'aether-tiny',
    reason: 'free tier — lightweight local aether-llm-host model for fast/cheap tasks',
    free: true,
    maxTokens: 8000,
    avgLatencyMs: 500,
    costTier: 'free',
    taskAffinity: ['fast', 'general'],
  },
  {
    provider: 'aether',
    model: 'aether-vision',
    reason: 'free tier — local aether-llm-host vision model for multimodal analysis',
    free: true,
    maxTokens: 16000,
    avgLatencyMs: 4000,
    costTier: 'free',
    taskAffinity: ['vision'],
  },
];

// ─────────────────────────────────────────────────────────────
// Namespace defaults (backward compatible)
// ─────────────────────────────────────────────────────────────

const NAMESPACE_DEFAULTS: Record<string, { provider: string; model: string; reason: string }> = {
  'nebula-os': {
    provider: 'ollama',
    model: 'qwen3:latest',
    reason: 'free tier — local ollama for multi-agent orchestration and systems work',
  },
  'aethertech-ai': {
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    reason: 'free tier — OpenRouter free model for reasoning and model engineering',
  },
  'roe-acquisitions': {
    provider: 'ollama',
    model: 'qwen3:latest',
    reason: 'free tier — local ollama for general operations and business tasks',
  },
  security: {
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    reason: 'free tier — OpenRouter free model for security analysis and hardening tasks',
  },
  vision: {
    provider: 'ollama',
    model: 'qwen3-vl:235b-cloud',
    reason: 'free tier — local ollama for vision and multimodal analysis',
  },
  voice: {
    provider: 'ollama',
    model: 'gemma3:1b',
    reason: 'free tier — local ollama for speech and voice-oriented tasks',
  },
};

// ─────────────────────────────────────────────────────────────
// Task type detection from message content
// ─────────────────────────────────────────────────────────────

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  code_review: ['code review', 'review code', 'refactor', 'lint', 'pull request', 'pr review'],
  code_generation: [
    'write code',
    'implement',
    'generate code',
    'build',
    'create function',
    'architecture',
    'code gen',
  ],
  security_analysis: [
    'security',
    'audit',
    'vulnerability',
    'penetration',
    'hardening',
    'cve',
    'exploit',
  ],
  creative_writing: [
    'write a story',
    'creative',
    'blog post',
    'marketing',
    'copywriting',
    'narrative',
  ],
  reasoning: ['analyze', 'reason', 'explain', 'compare', 'evaluate', 'assess', 'think through'],
  general: [],
  fast: ['cheap', 'fast', 'quick', 'simple query', 'one-liner'],
  vision: ['image', 'picture', 'visual', 'screenshot', 'diagram', 'photo'],
  voice: ['voice', 'speech', 'audio', 'transcri', 'speak'],
};

function detectTaskType(content: string): TaskType {
  const lower = content.toLowerCase();
  // Check specific task types first (order matters — more specific first)
  const priorityOrder: TaskType[] = [
    'security_analysis',
    'code_review',
    'code_generation',
    'creative_writing',
    'vision',
    'voice',
    'fast',
    'reasoning',
  ];
  for (const task of priorityOrder) {
    if (TASK_KEYWORDS[task].some((kw) => lower.includes(kw))) {
      return task;
    }
  }
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Provider health helpers
// ─────────────────────────────────────────────────────────────

const HEALTH_CACHE_TTL_MS = 30_000; // 30 seconds

let healthCache: Record<string, ProviderHealthStatus> = {};
let healthCacheTime = 0;

/**
 * Check provider health by polling the openclaw-gateway health endpoint.
 * Falls back to config-based health if gateway is unreachable.
 */
export async function checkProviderHealth(
  gatewayUrl = 'http://localhost:8090',
): Promise<Record<string, ProviderHealthStatus>> {
  const now = Date.now();
  if (now - healthCacheTime < HEALTH_CACHE_TTL_MS && Object.keys(healthCache).length > 0) {
    return healthCache;
  }

  try {
    const resp = await fetch(`${gatewayUrl}/health`);
    if (resp.ok) {
      const data = await resp.json();
      const statuses: Record<string, ProviderHealthStatus> = {};
      for (const [provider, info] of Object.entries(data.providers ?? {})) {
        const p = info as Record<string, unknown>;
        statuses[provider] = {
          provider,
          healthy: p.healthy === true,
          latencyMs: typeof p.latency_ms === 'number' ? p.latency_ms : undefined,
          error: typeof p.error === 'string' ? p.error : undefined,
          lastChecked: now,
        };
      }
      healthCache = statuses;
      healthCacheTime = now;
      return statuses;
    }
  } catch {
    // Gateway unreachable — assume all providers healthy (graceful degradation)
  }

  // Fallback: assume all providers healthy
  healthCache = {
    openrouter: { provider: 'openrouter', healthy: true, lastChecked: now },
    ollama: { provider: 'ollama', healthy: true, lastChecked: now },
    aether: { provider: 'aether', healthy: true, lastChecked: now },
  };
  healthCacheTime = now;
  return healthCache;
}

/** Synchronous health check using cached data. */
export function getCachedProviderHealth(): Record<string, ProviderHealthStatus> {
  return { ...healthCache };
}

// ─────────────────────────────────────────────────────────────
// Core routing engine
// ─────────────────────────────────────────────────────────────

/**
 * Score a model entry against routing constraints.
 * Higher is better.
 */
function scoreModel(
  entry: ModelEntry,
  taskType: TaskType,
  config: RoutingConfig,
  health: Record<string, ProviderHealthStatus>,
): number {
  let score = 0;

  // Task affinity — strongest signal
  if (entry.taskAffinity.includes(taskType)) {
    score += 100;
  }

  // Cost preference — free models preferred when costTier is 'free' or unset
  const costPref = config.costTier ?? 'free';
  if (costPref === 'free' && entry.free) score += 50;
  if (costPref === 'free' && !entry.free) score -= 100;

  // Latency awareness — prefer faster providers within budget
  if (config.latencyBudgetMs != null) {
    if (entry.avgLatencyMs <= config.latencyBudgetMs) {
      score += 30;
    } else {
      score -= 50; // penalize models that exceed latency budget
    }
  }
  // Even without explicit budget, slight preference for faster models
  score += Math.max(0, 20 - entry.avgLatencyMs / 200);

  // Token budget enforcement
  if (config.tokenBudget != null && entry.maxTokens < config.tokenBudget) {
    score -= 200; // heavy penalty — model can't handle the token budget
  }

  // Provider health — unhealthy providers get massive penalty
  const providerHealth = health[entry.provider];
  if (providerHealth && !providerHealth.healthy) {
    score -= 500;
  }

  // Preferred provider boost
  if (config.preferredProvider && entry.provider === config.preferredProvider) {
    score += 25;
  }

  return score;
}

/**
 * Build the fallback chain from the scored model catalog.
 * The primary model is first, then remaining models sorted by score.
 */
function buildFallbackChain(
  scored: Array<{ entry: ModelEntry; score: number }>,
  primary: ModelEntry,
): FallbackEntry[] {
  return scored
    .filter((s) => s.entry.provider !== primary.provider || s.entry.model !== primary.model)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // max 3 fallbacks
    .map((s) => ({
      provider: s.entry.provider,
      model: s.entry.model,
      free: s.entry.free,
    }));
}

/**
 * Route a request to the best model based on task type, cost, latency, health, and token budget.
 * Falls back through: OpenRouter free → Ollama local → error.
 */
export function routeModel(
  request: Pick<ChatRequest, 'namespace' | 'mode' | 'messages' | 'metadata'>,
  config: RoutingConfig = {},
): RoutingDecision {
  const latest = request.messages.at(-1)?.content || '';
  const taskType = config.taskType ?? detectTaskType(latest);
  const health = config.providerHealth ?? getCachedProviderHealth();

  // Score all models in catalog
  const scored = MODEL_CATALOG.map((entry) => ({
    entry,
    score: scoreModel(entry, taskType, config, health),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const primary = scored[0];

  // If no model scores well (all unhealthy or over budget), fall back to namespace default
  if (!primary || primary.score < -100) {
    const base = NAMESPACE_DEFAULTS[request.namespace] || NAMESPACE_DEFAULTS['nebula-os'];
    return {
      namespace: request.namespace,
      provider: base.provider,
      model: base.model,
      reason: `${base.reason} (fallback: no suitable model found for task=${taskType})`,
      free: true,
      fallbackChain: [],
      estimatedCostTier: 'free',
      taskType,
    };
  }

  const fallbackChain = buildFallbackChain(scored, primary.entry);

  return {
    namespace: request.namespace,
    provider: primary.entry.provider,
    model: primary.entry.model,
    reason: `${primary.entry.reason} (task=${taskType}, score=${primary.score.toFixed(0)})`,
    free: primary.entry.free,
    fallbackChain,
    estimatedCostTier: primary.entry.costTier,
    taskType,
  };
}

// ─────────────────────────────────────────────────────────────
// Backward-compatible export (preserves existing import signature)
// ─────────────────────────────────────────────────────────────

/**
 * @deprecated Use routeModel(request, config) instead. This signature is preserved for backward compatibility.
 */
export function routeModelSimple(
  request: Pick<ChatRequest, 'namespace' | 'mode' | 'messages' | 'metadata'>,
): { namespace: string; provider: string; model: string; reason: string; free: boolean } {
  const decision = routeModel(request);
  return {
    namespace: decision.namespace,
    provider: decision.provider,
    model: decision.model,
    reason: decision.reason,
    free: decision.free,
  };
}
