// Takers AI — Attachment types, validation, and server-side content builders
//
// Upload flow:
//   1. Client validates file (type, size, count) using helpers here
//   2. Client uploads directly to Firebase Storage via uploadBytesResumable()
//   3. Client sends AttachmentMeta[] alongside messages to /api/takers-ai/chat
//   4. Server fetches each file and builds Claude ContentBlockParam[]
//      - Images  (<= MAX_IMAGE_BYTES) : base64 vision block
//      - Text/CSV (<= MAX_TEXT_BYTES)  : injected as fenced code block
//      - PDF      (<= MAX_PDF_BYTES)   : base64 document block (claude-3.5+)
//      - DOC/DOCX / oversized          : text description note
//
// Storage path:  takers-ai/uploads/{userId}/{uploadSessionId}/{sanitized-filename}

// ── Allowed types ─────────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_DOC_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif",
  "pdf", "txt", "csv", "doc", "docx",
]);

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES       = 15 * 1024 * 1024; // 15 MB per file
export const MAX_FILES_PER_MESSAGE     = 5;
export const MAX_IMAGE_BYTES           = 4  * 1024 * 1024; // 4 MB for base64 vision
export const MAX_PDF_BYTES             = 8  * 1024 * 1024; // 8 MB for document block
export const MAX_TEXT_BYTES            = 50 * 1024;        // 50 KB inlined text

// ── Core types ────────────────────────────────────────────────────────────────

export type AttachmentFileType = "image" | "pdf" | "document" | "text";

/** Persisted after a successful upload. Stored in Firestore with each message. */
export interface AttachmentMeta {
  id: string;             // crypto.randomUUID() generated client-side
  name: string;           // original filename
  type: AttachmentFileType;
  mimeType: string;
  size: number;           // bytes
  storagePath: string;    // gs:// relative path, not a public URL
  downloadUrl: string;    // Firebase Storage download URL (token-authenticated)
  uploadedAt: string;     // ISO timestamp
}

// ── Classification ────────────────────────────────────────────────────────────

export function classifyFile(mimeType: string, fileName: string): AttachmentFileType {
  if (ALLOWED_IMAGE_MIME.has(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/plain" || mimeType === "text/csv") return "text";
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) return "document";
  // Fallback to extension
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "csv") return "text";
  return "document";
}

export function isAllowedFile(mimeType: string, fileName: string): boolean {
  if (ALLOWED_IMAGE_MIME.has(mimeType) || ALLOWED_DOC_MIME.has(mimeType)) return true;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.has(ext);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Returns a friendly label for display in chips */
export function attachmentTypeLabel(type: AttachmentFileType): string {
  switch (type) {
    case "image":    return "Image";
    case "pdf":      return "PDF";
    case "text":     return "Text";
    case "document": return "Document";
  }
}

/**
 * Builds the Firebase Storage path for an upload.
 * takers-ai/uploads/{userId}/{uploadSessionId}/{sanitizedFilename}
 */
export function buildStoragePath(
  userId: string,
  uploadSessionId: string,
  fileName: string
): string {
  const sanitized = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
  return `takers-ai/uploads/${userId}/${uploadSessionId}/${sanitized}`;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File, existingCount: number): FileValidationResult {
  if (existingCount >= MAX_FILES_PER_MESSAGE) {
    return { valid: false, error: `Maximum ${MAX_FILES_PER_MESSAGE} files per message.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `${file.name} exceeds the 15 MB limit.` };
  }
  if (!isAllowedFile(file.type, file.name)) {
    return {
      valid: false,
      error: `${file.name}: unsupported type. Allowed: JPG, PNG, WEBP, GIF, PDF, TXT, CSV, DOC, DOCX.`,
    };
  }
  return { valid: true };
}

// ── Server-side Claude content builder ───────────────────────────────────────
// Only imported in server routes (uses fetch + Buffer).

import type Anthropic from "@anthropic-ai/sdk";

type ContentBlock = Anthropic.Messages.ContentBlockParam;

function textBlock(text: string): ContentBlock {
  return { type: "text", text };
}

async function safeFetch(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Converts an attachment into one or more Claude ContentBlockParams.
 * - Image    → base64 vision block (or text note if fetch fails / too large)
 * - PDF      → base64 document block (or text note)
 * - Text/CSV → inlined fenced code block (or text note)
 * - DOC/DOCX → text description note
 *
 * Never throws — always returns at least a text description block.
 */
export async function attachmentToContentBlocks(
  att: AttachmentMeta,
  log: (msg: string, err?: string) => void
): Promise<ContentBlock[]> {
  const sizeLabel = formatFileSize(att.size);

  // ── Image ─────────────────────────────────────────────────────────────────
  if (att.type === "image") {
    if (att.size > MAX_IMAGE_BYTES) {
      return [textBlock(
        `[Image attached: ${att.name} (${sizeLabel}) — too large for vision analysis. Please describe what you'd like to know about it.]`
      )];
    }
    const buf = await safeFetch(att.downloadUrl);
    if (!buf) {
      log(`image fetch failed for ${att.name}`);
      return [textBlock(`[Image attached: ${att.name} — could not be loaded for analysis.]`)];
    }
    const validMime = (["image/jpeg", "image/png", "image/gif", "image/webp"] as const)
      .find((m) => m === att.mimeType) ?? "image/jpeg";
    return [{
      type: "image",
      source: {
        type: "base64",
        media_type: validMime,
        data: buf.toString("base64"),
      },
    } as ContentBlock];
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (att.type === "pdf") {
    if (att.size > MAX_PDF_BYTES) {
      return [textBlock(
        `[PDF attached: ${att.name} (${sizeLabel}) — too large for direct analysis. ` +
        `Please ask me specific questions about it.]`
      )];
    }
    const buf = await safeFetch(att.downloadUrl);
    if (!buf) {
      log(`pdf fetch failed for ${att.name}`);
      return [textBlock(`[PDF attached: ${att.name} (${sizeLabel}) — could not be loaded.]`)];
    }
    // Claude 3.5+ document block
    return [{
      type: "document",
      source: {
        type: "base64",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        media_type: "application/pdf" as any,
        data: buf.toString("base64"),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as ContentBlock];
  }

  // ── Plain text / CSV ──────────────────────────────────────────────────────
  if (att.type === "text") {
    if (att.size > MAX_TEXT_BYTES) {
      return [textBlock(
        `[Text file attached: ${att.name} (${sizeLabel}) — file is too large to inline fully. ` +
        `Ask me specific questions about its contents.]`
      )];
    }
    const buf = await safeFetch(att.downloadUrl);
    if (!buf) {
      log(`text fetch failed for ${att.name}`);
      return [textBlock(`[Text file attached: ${att.name} — could not be read.]`)];
    }
    const content = buf.toString("utf-8");
    const truncated = content.length > 8000
      ? content.slice(0, 8000) + "\n...[truncated at 8000 chars]"
      : content;
    return [textBlock(
      `[Attached file: ${att.name} (${sizeLabel})]\n\`\`\`\n${truncated}\n\`\`\``
    )];
  }

  // ── DOC / DOCX / unknown ──────────────────────────────────────────────────
  return [textBlock(
    `[Document attached: ${att.name} (${att.mimeType}, ${sizeLabel}). ` +
    `The file was uploaded successfully. Acknowledge it and offer to help with it ` +
    `once the user describes what they need.]`
  )];
}

/**
 * Rewrites the last user message to include attachment content blocks.
 * All prior messages are passed through unchanged.
 */
export async function buildMessagesWithAttachments(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  attachments: AttachmentMeta[],
  log: (msg: string, err?: string) => void
): Promise<Anthropic.Messages.MessageParam[]> {
  if (!attachments.length) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  const allButLast = messages
    .slice(0, -1)
    .map((m) => ({ role: m.role, content: m.content }));

  const lastMsg = messages[messages.length - 1];
  const contentBlocks: ContentBlock[] = [];

  // Process each attachment (never throws — each returns at least a text note)
  for (const att of attachments) {
    try {
      const blocks = await attachmentToContentBlocks(att, log);
      contentBlocks.push(...blocks);
    } catch (err) {
      log(`Unexpected error processing attachment ${att.name}`, String(err));
      contentBlocks.push(textBlock(
        `[Attachment: ${att.name} — processing failed. It was saved successfully.]`
      ));
    }
  }

  // Always end with the user's typed text (even if empty, keeps the message valid)
  if (lastMsg.content.trim()) {
    contentBlocks.push(textBlock(lastMsg.content));
  } else if (contentBlocks.length === 0) {
    contentBlocks.push(textBlock("I've attached some files. Please review them."));
  }

  return [
    ...allButLast,
    { role: lastMsg.role, content: contentBlocks },
  ] as Anthropic.Messages.MessageParam[];
}
