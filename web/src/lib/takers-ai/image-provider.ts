// Takers AI — Image Provider Abstraction (v2 — real providers)
//
// Provider selection (first match wins):
//   OPENAI_API_KEY       → DALL-E 3 (best quality, widely available)
//   REPLICATE_API_KEY    → Flux schnell via Replicate (fast, high quality)
//   STABILITY_API_KEY    → Stability AI Ultra (highest resolution)
//   (none)               → Mock (returns ready_to_render + saved prompt)
//
// All providers implement the same ImageProvider interface.
// No additional npm packages required — uses native fetch().
//
// Usage:
//   const provider = getImageProvider();
//   const result = await provider.generate({ prompt, format });
//   if (result.status === "rendered") { /* download result.url */ }
//   if (result.status === "ready_to_render") { /* show ready_to_render note */ }

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
  url?: string;                  // Temporary provider URL — save to Storage immediately
  storedUrl?: string;            // Firebase Storage URL (after saving)
  prompt: string;
  providerType: ImageProviderType;
  providerMessage: string;
  readyToRenderNote?: string;
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

/** Map any AssetFormat to the nearest gpt-image-1 supported size */
function toImageSize(format?: AssetFormat): "1024x1024" | "1024x1536" | "1536x1024" {
  const dim = getDimensionsForFormat(format);
  if (dim.height > dim.width) return "1024x1536";  // vertical (portrait)
  if (dim.width > dim.height) return "1536x1024";  // horizontal (landscape)
  return "1024x1024";
}

/** Cap dimensions to provider limits */
function capDimensions(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// ── Mock Provider ─────────────────────────────────────────────────────────────

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
        "📦 ASSET PACKAGE READY — Image rendering provider not yet connected. " +
        "All prompts are production-ready. Connect a provider in Settings to render directly.",
      width: request.width ?? dimensions.width,
      height: request.height ?? dimensions.height,
      durationMs: 0,
    };
  }
}

// ── gpt-image-1 Provider ──────────────────────────────────────────────────────
// Uses OpenAI Images API directly via fetch (no openai npm package needed).
// gpt-image-1 does NOT support: style, response_format
// quality values: "auto" | "high" | "medium" | "low"   (NOT "hd" or "standard")
// Returns: b64_json (base64-encoded PNG — no temporary URL)

class DalleProvider implements ImageProvider {
  readonly type: ImageProviderType = "dalle3";
  readonly isConnected = true;

  constructor(private readonly apiKey: string) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const size = toImageSize(request.format);
    const [w, h] = size.split("x").map(Number);

    // gpt-image-1 renders graphic design well when the prompt starts with a design frame.
    // Strip any photography/Midjourney residue and ensure design-first framing.
    const rawPrompt = request.prompt.slice(0, 32000);
    const hasDesignFrame = /professionally designed|event flyer|promotional poster|graphic design|poster layout/i.test(rawPrompt);
    const prompt = hasDesignFrame
      ? rawPrompt
      : `A professionally designed event flyer / promotional poster. ${rawPrompt}`;

    const payload = {
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality: "high",
    };

    console.log("[image-provider] IMAGE PAYLOAD", JSON.stringify(payload, null, 2));

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = `OpenAI API error ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg = errBody?.error?.message ?? errMsg;
      } catch { /* ignore */ }
      console.error("[image-provider] API error:", errMsg);
      return {
        status: "failed",
        prompt: request.prompt,
        providerType: "dalle3",
        providerMessage: errMsg,
        error: errMsg,
        durationMs: Date.now() - start,
      };
    }

    const data = await res.json();
    console.log("[image-provider] API response keys:", Object.keys(data));

    // gpt-image-1 returns b64_json (not a URL)
    const item = (data.data as Array<{ b64_json?: string; url?: string }>)?.[0];
    const b64 = item?.b64_json;
    const directUrl = item?.url;

    if (!b64 && !directUrl) {
      console.error("[image-provider] No image data in response:", JSON.stringify(data).slice(0, 500));
      return {
        status: "failed",
        prompt: request.prompt,
        providerType: "dalle3",
        providerMessage: "OpenAI did not return image data",
        error: "No image data in response",
        durationMs: Date.now() - start,
      };
    }

    // Convert b64 → data URL so saveImageToStorage can handle it
    const imageUrl = b64
      ? `data:image/png;base64,${b64}`
      : directUrl!;

    console.log("[image-provider] Image received — b64 length:", b64?.length ?? 0, "hasUrl:", !!directUrl);

    return {
      status: "rendered",
      url: imageUrl,
      prompt: request.prompt,
      providerType: "dalle3",
      providerMessage: "Rendered via gpt-image-1 (High quality)",
      width: w,
      height: h,
      durationMs: Date.now() - start,
    };
  }
}

// ── Flux Provider (Replicate) ─────────────────────────────────────────────────
// Uses Replicate API directly via fetch.
// Model: black-forest-labs/flux-schnell (fast, high quality)

class FluxProvider implements ImageProvider {
  readonly type: ImageProviderType = "flux";
  readonly isConnected = true;
  private static readonly POLL_INTERVAL_MS = 1500;
  private static readonly MAX_POLLS = 40; // 60s max

  constructor(private readonly apiKey: string) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const rawDim = getDimensionsForFormat(request.format);
    const { width, height } = capDimensions(
      request.width ?? rawDim.width,
      request.height ?? rawDim.height,
      1440 // Flux max dimension
    );

    // Start prediction — use "Prefer: wait" for synchronous response
    const startRes = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.apiKey}`,
          "Content-Type": "application/json",
          "Prefer": "wait=60",
        },
        body: JSON.stringify({
          input: {
            prompt: request.prompt,
            num_outputs: 1,
            width,
            height,
            num_inference_steps: 4,
            output_format: "png",
            disable_safety_checker: false,
          },
        }),
      }
    );

    if (!startRes.ok) {
      let errMsg = `Replicate API error ${startRes.status}`;
      try { errMsg = (await startRes.json())?.detail ?? errMsg; } catch { /* ignore */ }
      return { status: "failed", prompt: request.prompt, providerType: "flux", providerMessage: errMsg, error: errMsg, durationMs: Date.now() - start };
    }

    const prediction = await startRes.json();

    // Check if synchronous response already has result
    if (prediction.status === "succeeded" && prediction.output?.[0]) {
      return {
        status: "rendered",
        url: prediction.output[0] as string,
        prompt: request.prompt,
        providerType: "flux",
        providerMessage: "Rendered via Flux (Replicate)",
        width,
        height,
        durationMs: Date.now() - start,
      };
    }

    // Poll for result
    if (prediction.id && prediction.status !== "failed" && prediction.status !== "canceled") {
      for (let i = 0; i < FluxProvider.MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, FluxProvider.POLL_INTERVAL_MS));
        const pollRes = await fetch(
          `https://api.replicate.com/v1/predictions/${prediction.id as string}`,
          { headers: { "Authorization": `Token ${this.apiKey}` } }
        );
        if (!pollRes.ok) continue;
        const poll = await pollRes.json();

        if (poll.status === "succeeded" && poll.output?.[0]) {
          return {
            status: "rendered",
            url: poll.output[0] as string,
            prompt: request.prompt,
            providerType: "flux",
            providerMessage: "Rendered via Flux (Replicate)",
            width,
            height,
            durationMs: Date.now() - start,
          };
        }
        if (poll.status === "failed" || poll.status === "canceled") {
          const errMsg = (poll.error as string) ?? "Flux generation failed";
          return { status: "failed", prompt: request.prompt, providerType: "flux", providerMessage: errMsg, error: errMsg, durationMs: Date.now() - start };
        }
      }
      return { status: "failed", prompt: request.prompt, providerType: "flux", providerMessage: "Flux timed out after 60 seconds", error: "timeout", durationMs: Date.now() - start };
    }

    const err = (prediction.error as string) ?? "Flux prediction failed";
    return { status: "failed", prompt: request.prompt, providerType: "flux", providerMessage: err, error: err, durationMs: Date.now() - start };
  }
}

// ── Stability AI Provider ─────────────────────────────────────────────────────
// Uses Stability AI Stable Image Ultra API directly via fetch.

class StabilityProvider implements ImageProvider {
  readonly type: ImageProviderType = "stability";
  readonly isConnected = true;

  constructor(private readonly apiKey: string) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const rawDim = getDimensionsForFormat(request.format);

    // Stability Ultra accepts arbitrary sizes (1:1 to 21:9)
    const { width, height } = capDimensions(
      request.width ?? rawDim.width,
      request.height ?? rawDim.height,
      1536
    );

    const formData = new FormData();
    formData.append("prompt", request.prompt.slice(0, 10000));
    if (request.negativePrompt) formData.append("negative_prompt", request.negativePrompt);
    formData.append("output_format", "png");
    formData.append("aspect_ratio", height > width ? "9:16" : width > height ? "16:9" : "1:1");

    const res = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/ultra",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "image/*",
        },
        body: formData,
      }
    );

    if (!res.ok) {
      let errMsg = `Stability AI error ${res.status}`;
      try { errMsg = (await res.json())?.errors?.join(", ") ?? errMsg; } catch { /* ignore */ }
      return { status: "failed", prompt: request.prompt, providerType: "stability", providerMessage: errMsg, error: errMsg, durationMs: Date.now() - start };
    }

    // Returns raw image bytes
    const imageBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return {
      status: "rendered",
      url: dataUrl, // caller must convert to blob and upload to Storage
      prompt: request.prompt,
      providerType: "stability",
      providerMessage: "Rendered via Stability AI Ultra",
      width,
      height,
      durationMs: Date.now() - start,
    };
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
// Singleton — reset with resetImageProvider() if env changes.

let _provider: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (_provider) return _provider;

  // Always-on diagnostic log — visible in Vercel function logs
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasReplicate = !!process.env.REPLICATE_API_KEY;
  const hasStability = !!process.env.STABILITY_API_KEY;
  console.log("[image-provider] getImageProvider() called", {
    hasOpenAI,
    hasReplicate,
    hasStability,
    nodeEnv: process.env.NODE_ENV,
    openAIKeyPrefix: process.env.OPENAI_API_KEY?.slice(0, 8) ?? "NOT_SET",
  });

  if (process.env.OPENAI_API_KEY) {
    console.log("[image-provider] selected: DalleProvider (gpt-image-1)");
    _provider = new DalleProvider(process.env.OPENAI_API_KEY);
    return _provider;
  }
  if (process.env.REPLICATE_API_KEY) {
    console.log("[image-provider] selected: FluxProvider (Replicate)");
    _provider = new FluxProvider(process.env.REPLICATE_API_KEY);
    return _provider;
  }
  if (process.env.STABILITY_API_KEY) {
    console.log("[image-provider] selected: StabilityProvider");
    _provider = new StabilityProvider(process.env.STABILITY_API_KEY);
    return _provider;
  }

  console.warn("[image-provider] selected: MockImageProvider — NO API KEY FOUND");
  _provider = new MockImageProvider();
  return _provider;
}

export function resetImageProvider(): void {
  _provider = null;
}

export function getProviderStatus(): {
  type: ImageProviderType;
  isConnected: boolean;
  displayName: string;
  connectMessage?: string;
} {
  const provider = getImageProvider();
  const names: Record<ImageProviderType, string> = {
    mock:      "Not connected",
    dalle3:    "DALL-E 3 (OpenAI)",
    flux:      "Flux Schnell (Replicate)",
    stability: "Stable Image Ultra",
  };
  if (provider.isConnected) {
    return { type: provider.type, isConnected: true, displayName: names[provider.type] };
  }
  return {
    type: "mock",
    isConnected: false,
    displayName: names.mock,
    connectMessage:
      "Set OPENAI_API_KEY, REPLICATE_API_KEY, or STABILITY_API_KEY in Vercel environment variables " +
      "to enable direct image rendering. All prompts are saved as ready_to_render until then.",
  };
}
