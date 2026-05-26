// Takers AI — Image Provider Abstraction
//
// Defines the interface for image generation providers.
// Currently active: MockProvider (returns ready_to_render status + saved prompt)
//
// Future providers to wire in (set the relevant env var to activate):
//   OPENAI_API_KEY          → DALL-E 3
//   REPLICATE_API_KEY       → Flux / Stable Diffusion
//   STABILITY_API_KEY       → Stability AI
//
// Usage:
//   const provider = getImageProvider();
//   const result = await provider.generate({ prompt, format });
//   if (result.status === "rendered") { /* use result.url */ }
//   if (result.status === "ready_to_render") { /* save prompt, show note to user */ }

import type { AssetFormat } from "./creative-brief";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageProviderType = "mock" | "dalle3" | "flux" | "stability";
export type ImageGenerationStatus = "rendered" | "ready_to_render" | "failed";

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  format?: AssetFormat;
  width?: number;
  height?: number;
  style?: "photographic" | "illustration" | "abstract" | "cinematic";
  seed?: number;
  agentId?: string;
  conversationId?: string;
}

export interface ImageGenerationResult {
  status: ImageGenerationStatus;
  url?: string;                 // Present when status === "rendered"
  thumbnailUrl?: string;
  prompt: string;               // Prompt that was/will be used
  providerType: ImageProviderType;
  providerMessage: string;
  readyToRenderNote?: string;   // User-facing message when not yet rendered
  width?: number;
  height?: number;
  durationMs?: number;
  error?: string;
}

export interface ImageProvider {
  readonly type: ImageProviderType;
  readonly isConnected: boolean;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

// ── Dimension helpers ─────────────────────────────────────────────────────────

export function getDimensionsForFormat(format?: AssetFormat): { width: number; height: number } {
  const map: Record<AssetFormat, { width: number; height: number }> = {
    instagram_post:  { width: 1080, height: 1080 },
    instagram_story: { width: 1080, height: 1920 },
    tiktok_cover:    { width: 1080, height: 1920 },
    event_flyer:     { width: 2550, height: 3300 },
    email_header:    { width: 600,  height: 300  },
    poster:          { width: 1080, height: 1440 },
  };
  return (format && map[format]) ? map[format] : { width: 1080, height: 1080 };
}

// ── Mock Provider ─────────────────────────────────────────────────────────────
// Active when no real provider key is configured.
// Saves the prompt as production-ready for when a real provider is connected.

class MockImageProvider implements ImageProvider {
  readonly type: ImageProviderType = "mock";
  readonly isConnected = false;

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const dimensions = getDimensionsForFormat(request.format);
    return {
      status: "ready_to_render",
      prompt: request.prompt,
      providerType: "mock",
      providerMessage: "No image rendering provider connected.",
      readyToRenderNote:
        "Image rendering provider is not yet connected. " +
        "This prompt has been saved as ready_to_render. " +
        "Connect an image provider in Settings to render directly.",
      width: request.width ?? dimensions.width,
      height: request.height ?? dimensions.height,
      durationMs: 0,
    };
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
// Returns the best available provider based on configured env vars.
// Add real provider implementations here as they become available.

let _provider: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (_provider) return _provider;

  // Future: check env vars and wire real providers
  // Example:
  //   if (process.env.OPENAI_API_KEY) {
  //     _provider = new DalleProvider(process.env.OPENAI_API_KEY);
  //     return _provider;
  //   }
  //   if (process.env.REPLICATE_API_KEY) {
  //     _provider = new FluxProvider(process.env.REPLICATE_API_KEY);
  //     return _provider;
  //   }

  _provider = new MockImageProvider();
  return _provider;
}

/** Reset cached provider instance (useful for testing or hot config changes). */
export function resetImageProvider(): void {
  _provider = null;
}

/** Returns the current provider status for display in the UI. */
export function getProviderStatus(): {
  type: ImageProviderType;
  isConnected: boolean;
  displayName: string;
  connectMessage?: string;
} {
  const provider = getImageProvider();
  if (provider.isConnected) {
    const names: Record<ImageProviderType, string> = {
      mock:      "None",
      dalle3:    "DALL-E 3",
      flux:      "Flux (Replicate)",
      stability: "Stability AI",
    };
    return { type: provider.type, isConnected: true, displayName: names[provider.type] };
  }
  return {
    type: "mock",
    isConnected: false,
    displayName: "Not connected",
    connectMessage:
      "Connect an image provider in Settings to enable direct rendering. " +
      "All prompts are saved as ready_to_render until then.",
  };
}
