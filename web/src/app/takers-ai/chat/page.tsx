"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import type { Agent, PromptTemplate, ChatMessage, OutputType } from "@/lib/takers-ai/types";
import { OUTPUT_TYPE_LABELS } from "@/lib/takers-ai/types";

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getToken() {
  return (await getAuth().currentUser?.getIdToken()) ?? "";
}

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Save output modal ─────────────────────────────────────────────────────────
function SaveOutputModal({
  content,
  agentId,
  onSave,
  onClose,
}: {
  content: string;
  agentId: string;
  onSave: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<OutputType>("other");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, title, content, type }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-white">Save Output</h3>
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title for this output…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as OutputType)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-red-500/50"
        >
          {Object.entries(OUTPUT_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key} className="bg-[#13131f]">
              {label}
            </option>
          ))}
        </select>
        <div className="bg-white/[0.03] rounded-xl p-3 max-h-32 overflow-y-auto">
          <p className="text-white/30 text-xs line-clamp-4">{content.slice(0, 200)}…</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: PromptTemplate[];
  onSelect: (prompt: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="font-bold text-white text-sm">Prompt Templates</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
        </div>
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40"
          />
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-8">No templates found.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.prompt)}
                className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 transition group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm font-medium group-hover:text-white transition">{t.name}</p>
                  <p className="text-white/30 text-xs mt-0.5">{t.description || t.category}</p>
                  {t.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.variables.map((v) => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 border border-red-600/20 text-red-400">
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-white/20 group-hover:text-white/50 transition text-sm shrink-0">→</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  agentId,
  onSave,
}: {
  msg: ChatMessage;
  agentId: string;
  onSave: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-400 text-sm shrink-0 mt-0.5">
          ◎
        </div>
      )}
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-red-600/20 border border-red-600/25 text-white/90 rounded-tr-sm"
              : "bg-white/[0.04] border border-white/[0.08] text-white/80 rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>
        {/* Action row for assistant messages */}
        {!isUser && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition px-1">
            <button
              onClick={handleCopy}
              className="text-[11px] text-white/25 hover:text-white/60 transition flex items-center gap-1"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <span className="text-white/10">·</span>
            <button
              onClick={() => onSave(msg.content)}
              className="text-[11px] text-white/25 hover:text-red-400 transition"
            >
              Save output
            </button>
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs shrink-0 mt-0.5">
          T
        </div>
      )}
    </div>
  );
}

// ── Main chat inner (uses searchParams) ──────────────────────────────────────
function ChatInner() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId") ?? "";
  const initialConvId = searchParams.get("convId") ?? "";
  const initialPrompt = searchParams.get("prompt") ?? "";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ? decodeURIComponent(initialPrompt) : "");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [conversationId, setConversationId] = useState(initialConvId || "");
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveModal, setSaveModal] = useState<{ content: string } | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load agents and templates
  useEffect(() => {
    Promise.all([
      authFetch("/api/takers-ai/agents"),
      authFetch("/api/takers-ai/templates"),
    ]).then(([agentsData, templatesData]) => {
      const agentList: Agent[] = agentsData.agents ?? [];
      setAgents(agentList);
      setTemplates(templatesData.templates ?? []);
      // Set default agent if none selected
      if (!selectedAgentId && agentList.length > 0) {
        const def = agentList.find((a) => a.isDefault) ?? agentList[0];
        setSelectedAgentId(def.id);
      }
    }).catch(() => {});
  }, []);

  // Load existing conversation
  useEffect(() => {
    if (!conversationId) return;
    setLoadingConv(true);
    authFetch(`/api/takers-ai/conversations/${conversationId}`)
      .then(({ conversation, messages: msgs }) => {
        setSelectedAgentId(conversation.agentId);
        setMessages(msgs ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingConv(false));
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedAgentId || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");

    try {
      const token = await getToken();
      const res = await fetch("/api/takers-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          agentId: selectedAgentId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId: conversationId || undefined,
          saveConversation: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let newConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamingText(fullText);
            }
            if (parsed.conversationId) {
              newConvId = parsed.conversationId;
              setConversationId(parsed.conversationId);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Commit streamed response as real message
      const assistantMsg: ChatMessage = { role: "assistant", content: fullText, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingText("");
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `⚠ Error: ${err instanceof Error ? err.message : "Something went wrong. Please try again."}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, selectedAgentId, streaming, messages, conversationId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleTemplateSelect(prompt: string) {
    setInput(prompt);
    setShowTemplates(false);
    inputRef.current?.focus();
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId("");
    setStreamingText("");
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="h-14 shrink-0 border-b border-white/[0.07] flex items-center gap-4 px-5">
        {/* Agent selector */}
        <div className="flex items-center gap-2">
          {selectedAgent && (
            <div className={`w-7 h-7 rounded-lg ${selectedAgent.color} bg-opacity-20 border border-white/10 flex items-center justify-center text-base`}>
              {selectedAgent.icon}
            </div>
          )}
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-transparent text-white/70 text-sm font-medium focus:outline-none cursor-pointer hover:text-white transition"
          >
            {agents.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id} className="bg-[#13131f]">
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {selectedAgent && (
          <span className="text-white/20 text-xs hidden sm:block">{selectedAgent.description}</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {conversationId && (
            <span className="text-white/20 text-[11px] font-mono hidden sm:block">
              {conversationId.slice(0, 8)}…
            </span>
          )}
          <button
            onClick={handleNewChat}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white transition"
          >
            New chat
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loadingConv ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex gap-3 ${i % 2 ? "justify-end" : "justify-start"}`}>
                <div className={`h-12 w-64 rounded-2xl bg-white/5 animate-pulse`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !streamingText ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-3xl">
              {selectedAgent?.icon ?? "◎"}
            </div>
            <div>
              <h2 className="text-white/70 font-bold text-lg">{selectedAgent?.name ?? "Takers Operator"}</h2>
              <p className="text-white/30 text-sm mt-1 max-w-xs">
                {selectedAgent?.description || "Your executive AI operator. Ask me anything about the brand, events, content, or strategy."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {[
                "What events should we run next?",
                "Write an IG caption for the Sea Bears event",
                "Give me a content plan for this week",
                "How should we grow ALL ACCESS membership?",
              ].map((starter) => (
                <button
                  key={starter}
                  onClick={() => setInput(starter)}
                  className="text-xs text-left px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 text-white/40 hover:text-white/70 transition"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                agentId={selectedAgentId}
                onSave={(content) => setSaveModal({ content })}
              />
            ))}
            {/* Streaming bubble */}
            {streaming && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-400 text-sm shrink-0 mt-0.5">
                  ◎
                </div>
                <div className="max-w-[78%] bg-white/[0.04] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                  {streamingText || (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-white/[0.07] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-white/[0.04] border border-white/[0.09] hover:border-white/15 focus-within:border-red-500/40 rounded-2xl transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedAgent?.name ?? "Takers Operator"}…`}
              rows={1}
              disabled={streaming}
              className="w-full bg-transparent px-5 pt-4 pb-12 text-sm text-white placeholder-white/20 resize-none focus:outline-none min-h-[56px] max-h-48 overflow-y-auto disabled:opacity-50"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {/* Bottom toolbar */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <button
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition px-2 py-1 rounded-lg hover:bg-white/5"
              >
                <span>◧</span>
                <span>Templates</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-white/15 text-[11px]">⏎ to send, ⇧⏎ for newline</span>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming || !selectedAgentId}
                  className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L7 13M1 7L7 1L13 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showTemplates && (
        <TemplatePicker
          templates={templates}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {saveModal && (
        <SaveOutputModal
          content={saveModal.content}
          agentId={selectedAgentId}
          onSave={() => {
            setSaveModal(null);
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 3000);
          }}
          onClose={() => setSaveModal(null)}
        />
      )}
      {savedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-500/30 text-emerald-300 text-sm font-medium px-5 py-2.5 rounded-xl backdrop-blur-sm z-70">
          ✓ Output saved
        </div>
      )}
    </div>
  );
}

// ── Export with Suspense for useSearchParams ──────────────────────────────────
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20">Loading…</div>}>
      <ChatInner />
    </Suspense>
  );
}
