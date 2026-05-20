/**
 * Centralized Gemini Model Configuration
 *
 * FULLY AUTOMATIC: Fetches all available models from the Gemini API,
 * parses version numbers, sorts newest → oldest, and provides a
 * smart fallback chain. No hardcoded model list needed.
 */

// ── Default model (used only as initial UI default / absolute last resort) ──
export const DEFAULT_MODEL = "models/gemini-3.5-flash";

// ── Static fallback list (used ONLY when the API fetch itself fails) ────────
const STATIC_FALLBACK_MODELS = [
  "models/gemini-3.5-flash",
  "models/gemini-3.1-pro",
  "models/gemini-3.1-flash-lite",
  "models/gemini-2.5-flash",
  "models/gemini-2.5-pro",
  "models/gemini-2.0-flash",
];

// ── Known deprecated / removed models — always skip these ───────────────────
export const DEPRECATED_MODELS = new Set([
  // Legacy 1.x
  "models/gemini-1.5-flash",
  "models/gemini-1.5-flash-latest",
  "models/gemini-1.5-flash-001",
  "models/gemini-1.5-flash-002",
  "models/gemini-1.5-pro",
  "models/gemini-1.5-pro-latest",
  "models/gemini-1.5-pro-001",
  "models/gemini-1.5-pro-002",
  // Deprecated 2.x previews
  "models/gemini-2.0-flash-lite",
  "models/gemini-2.0-flash-lite-preview-02-05",
  // Deprecated 3.x previews (superseded by GA releases)
  "models/gemini-3-flash-preview",
  "models/gemini-3.1-flash-lite-preview",
]);

// ── Runtime-discovered deprecated models (detected via 404 / error) ─────────
const runtimeDeprecated = new Set<string>();

/**
 * Mark a model as deprecated at runtime (e.g., after receiving a 404 or
 * deprecation error from the API). It will be skipped in future fallback chains.
 */
export function markModelDeprecated(modelId: string): void {
  const normalised = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
  runtimeDeprecated.add(normalised);
  console.log(`🚫 Model ${normalised} marked as deprecated at runtime`);
}

/**
 * Check whether a model is deprecated (static list OR runtime-detected).
 */
export function isModelDeprecated(modelId: string): boolean {
  const normalised = modelId.startsWith("models/") ? modelId : `models/${modelId}`;
  return DEPRECATED_MODELS.has(normalised) || runtimeDeprecated.has(normalised);
}

// ── In-memory cache for auto-fetched models ─────────────────────────────────
let cachedModels: string[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse a Gemini version number from a model ID.
 * "models/gemini-3.5-flash" → 3.5
 * "models/gemini-2.0-flash" → 2.0
 * "models/gemini-3.1-pro"   → 3.1
 */
function parseModelVersion(modelId: string): number {
  const match = modelId.match(/gemini-(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse model tier for secondary sorting within the same version.
 * pro > flash > flash-lite > other
 */
function parseModelTier(modelId: string): number {
  if (modelId.includes("pro") && !modelId.includes("preview")) return 4;
  if (modelId.includes("pro")) return 3;
  if (modelId.includes("flash-lite")) return 1;
  if (modelId.includes("flash")) return 2;
  return 0;
}

/**
 * Prefer stable (non-preview) models over preview ones.
 */
function isStable(modelId: string): number {
  return modelId.includes("preview") ? 0 : 1;
}

/**
 * Auto-fetch all available Gemini models from the API, filter to only
 * those that support generateContent, remove deprecated ones, and
 * sort newest-first (by version → tier → stability).
 *
 * Results are cached for 5 minutes to avoid hammering the API.
 *
 * @param authToken – Either "Bearer <oauth_token>" or "key=<api_key>" format
 */
export async function fetchAvailableModels(authToken: string): Promise<string[]> {
  // Return cache if fresh
  if (cachedModels.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedModels;
  }

  try {
    // Determine auth header format
    const headers: Record<string, string> = {};
    if (authToken.startsWith("Bearer ")) {
      headers["Authorization"] = authToken;
    } else {
      // Assume it's a raw API key
      headers["x-goog-api-key"] = authToken;
    }

    // Fetch ALL models with pagination
    let allRawModels: any[] = [];
    let nextPageToken: string | undefined;

    do {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "100");
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

      const res = await fetch(url.toString(), { headers });

      if (!res.ok) {
        console.warn(`[Models] Failed to fetch models (${res.status}), using cache/fallback`);
        return cachedModels.length > 0 ? cachedModels : STATIC_FALLBACK_MODELS;
      }

      const data = await res.json();
      allRawModels.push(...(data.models || []));
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    const models: string[] = allRawModels
      .filter((m: any) => {
        const name = (m.name || "").toLowerCase();
        const methods = m.supportedGenerationMethods || [];

        const supportsGenerate = methods.includes("generateContent");
        const isGemini = name.includes("gemini");

        // Exclude embedding-only, TTS, image-gen, and live models
        const isEmbedding = name.includes("embedding") || (methods.length > 0 && methods.every((method: string) => method === "embedContent"));
        const isTTS = name.includes("tts");
        const isImageGen = name.includes("imagen");
        const isLive = name.includes("live");

        return supportsGenerate && isGemini && !isEmbedding && !isTTS && !isImageGen && !isLive;
      })
      .map((m: any) => m.name as string)
      .filter((id: string) => !isModelDeprecated(id)) // skip deprecated (static + runtime)
      .sort((a: string, b: string) => {
        // 1. Higher version first
        const vDiff = parseModelVersion(b) - parseModelVersion(a);
        if (vDiff !== 0) return vDiff;

        // 2. Stable > preview
        const sDiff = isStable(b) - isStable(a);
        if (sDiff !== 0) return sDiff;

        // 3. Higher tier first (pro > flash > lite)
        return parseModelTier(b) - parseModelTier(a);
      });

    if (models.length > 0) {
      cachedModels = models;
      cacheTimestamp = Date.now();
      console.log(`[Models] Auto-fetched ${models.length} models. Top: ${models.slice(0, 5).join(", ")}`);
    }

    return models.length > 0 ? models : STATIC_FALLBACK_MODELS;
  } catch (e) {
    console.warn("[Models] Error fetching models:", e);
    return cachedModels.length > 0 ? cachedModels : STATIC_FALLBACK_MODELS;
  }
}

/**
 * Build a dynamic fallback chain:
 *  1. Start with the user's selected model (if not deprecated)
 *  2. Then ALL auto-fetched models, sorted newest → oldest
 *
 * @param selectedModel – The model the user selected (may include "models/" or not)
 * @param authToken – Auth string for the API fetch
 */
export async function getModelFallbackChain(
  selectedModel: string | undefined,
  authToken: string
): Promise<string[]> {
  // Normalise
  const normalised = selectedModel
    ? selectedModel.startsWith("models/")
      ? selectedModel
      : `models/${selectedModel}`
    : DEFAULT_MODEL;

  // Fetch all available models dynamically
  const allModels = await fetchAvailableModels(authToken);

  const chain: string[] = [];

  // 1. User's pick first (if not deprecated)
  if (!isModelDeprecated(normalised)) {
    chain.push(normalised);
  }

  // 2. Fill with auto-fetched models (newest first), skip duplicates
  for (const m of allModels) {
    if (!chain.includes(m)) {
      chain.push(m);
    }
  }

  // 3. Safety net
  if (chain.length === 0) {
    chain.push(DEFAULT_MODEL);
  }

  return chain;
}

/**
 * Sort a UI model list by version (newest first), deprecated last.
 * Used by the /api/models route for the dropdown.
 */
export function sortModelsByRecency<T extends { id: string }>(models: T[]): T[] {
  return [...models].sort((a, b) => {
    const aDeprecated = isModelDeprecated(a.id);
    const bDeprecated = isModelDeprecated(b.id);

    // Deprecated always goes to the bottom
    if (aDeprecated && !bDeprecated) return 1;
    if (!aDeprecated && bDeprecated) return -1;

    // Higher version first
    const vDiff = parseModelVersion(b.id) - parseModelVersion(a.id);
    if (vDiff !== 0) return vDiff;

    // Stable > preview
    const sDiff = isStable(b.id) - isStable(a.id);
    if (sDiff !== 0) return sDiff;

    // Higher tier first
    return parseModelTier(b.id) - parseModelTier(a.id);
  });
}
