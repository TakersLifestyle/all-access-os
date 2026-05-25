"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import type {
  Agent, PromptTemplate, ChatMessage, OutputType, AgentRole,
  FeedbackRating,
} from "@/lib/takers-ai/types";
import { OUTPUT_TYPE_LABELS, AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, AGENT_ROLE_ICONS } from "@/lib/takers-ai/types";

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

// ── Routing indicator ─────────────────────────────────────────────────────────
function RoutingBadge({ role, name, reason }: { role: AgentRole; name: string; reason: string }) {
  const [showReason, setShowReason] = useState(false);
  const color = AGENT_ROLE_COLORS[role] ?? "bg-white/10";
  const icon = AGENT_ROLE_ICONS[role] ?? "◎";
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-white/[0.05]" />
      <button
        onClick={() => setShowReason((v) => !v)}
        className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 ${color} bg-opacity-15 text-white/50 hover:text-white/80 transition`}
      >
        <span>{icon}</span>
        <span>Routed → {name}</span>
        <span className="text-white/25 ml-0.5">{showReason ? "▴" : "▾"}</span>
      </button>
      <div className="flex-1 h-px bg-white/[0.05]" />
      {showReason && (
        <div className="absolute mt-6 z-10 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/40 max-w-xs shadow-xl">
          {reason}
        </div>
      )}
    </div>
  );
}

// ── Feedback buttons ─────────────────────────────────────────────────────────
function FeedbackButtons({
  messageContent,
  agentId,
  agentRole,
  agentName,
  conversationId,
  workflowRunId,
}: {
  messageContent: string;
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId?: string;
  workflowRunId?: string;
}) {
  const [given, setGiven] = useState<FeedbackRating | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitFeedback(rating: FeedbackRating, finalComment?: string) {
    if (given) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId, agentRole, agentName,
          conversationId, workflowRunId,
          messageContent,
          rating,
          comment: finalComment ?? "",
        }),
      });
      setGiven(rating);
      setShowComment(false);
    } finally {
      setSaving(false);
    }
  }

  if (given) {
    return (
      <span className="text-[11px] text-white/20">
        {given === "positive" ? "👍 Thanks" : "👎 Noted"}
      </span>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => submitFeedback("positive")}
          disabled={saving}
          className="text-[11px] text-white/20 hover:text-emerald-400 transition px-1"
          title="Good response"
        >👍</button>
        <button
          onClick={() => setShowComment((v) => !v)}
          disabled={saving}
          className="text-[11px] text-white/20 hover:text-red-400 transition px-1"
          title="Poor response"
        >👎</button>
      </div>
      {showComment && (
        <div className="absolute bottom-6 left-0 z-10 bg-[#1a1a2e] border border-white/10 rounded-xl p-3 w-64 shadow-xl space-y-2">
          <p className="text-white/40 text-xs">What was wrong?</p>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment…"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20 resize-none focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowComment(false)}
              className="flex-1 text-xs py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/60 transition"
            >Cancel</button>
            <button
              onClick={() => submitFeedback("negative", comment)}
              disabled={saving}
              className="flex-1 text-xs py-1 rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40 transition"
            >Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Save output modal ─────────────────────────────────────────────────────────
function SaveOutputModal({
  content, agentId, agentRole, onSave, onClose,
}: {
  content: string; agentId: string; agentRole: AgentRole; onSave: () => void; onClose: () => void;
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
        body: JSON.stringify({ agentId, agentRole, title, content, type }),
      });
      onSave();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-white">Save Output</h3>
        <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title for this output…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50" />
        <select value={type} onChange={(e) => setType(e.target.value as OutputType)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none">
          {Object.entries(OUTPUT_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="bg-[#13131f]">{label}</option>
          ))}
        </select>
        <div className="bg-white/[0.03] rounded-xl p-3 max-h-32 overflow-y-auto">
          <p className="text-white/30 text-xs">{content.slice(0, 200)}…</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm transition hover:text-white/70">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({ templates, onSelect, onClose }: {
  templates: PromptTemplate[]; onSelect: (p: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="font-bold text-white text-sm">Prompt Templates</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
        </div>
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none" />
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-8">No templates found.</p>
          ) : filtered.map((t) => (
            <button key={t.id} onClick={() => onSelect(t.prompt)}
              className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 transition group">
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm font-medium group-hover:text-white transition">{t.name}</p>
                <p className="text-white/30 text-xs mt-0.5">{t.description || t.category}</p>
              </div>
              <span className="text-white/20 group-hover:text-white/50 transition text-sm shrink-0">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Extended message type for UI ──────────────────────────────────────────────
interface UIMessage extends ChatMessage {
  routingInfo?: {
    routedToRole: AgentRole;
    routedToAgentId: string;
    routedToName: string;
    routingReason: string;
    workflowRunId?: string;
  };
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, allAgents, conversationId,
  onSave,
}: {
  msg: UIMessage;
  allAgents: Agent[];
  conversationId?: string;
  onSave: (content: string, agentId: string, agentRole: AgentRole) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const respondingAgent = msg.agentId ? allAgents.find((a) => a.id === msg.agentId) : null;
  const agentIcon = respondingAgent ? AGENT_ROLE_ICONS[respondingAgent.role as AgentRole] : "◎";
  const agentColor = respondingAgent ? AGENT_ROLE_COLORS[respondingAgent.role as AgentRole] : "bg-red-600";

  function handleCopy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      {/* Routing indicator above assistant message */}
      {!isUser && msg.routingInfo && msg.routingInfo.routedToRole !== "operator" && (
        <div className="relative">
          <RoutingBadge
            role={msg.routingInfo.routedToRole}
            name={msg.routingInfo.routedToName}
            reason={msg.routingInfo.routingReason}
          />
        </div>
      )}

      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
        {!isUser && (
          <div className={`w-8 h-8 rounded-lg ${agentColor} bg-opacity-20 border border-white/10 flex items-center justify-center text-sm shrink-0 mt-0.5`}>
            {agentIcon}
          </div>
        )}

        <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
          {respondingAgent && !isUser && (
            <span className="text-[10px] text-white/20 px-1">{respondingAgent.name}</span>
          )}
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-red-600/20 border border-red-600/25 text-white/90 rounded-tr-sm"
              : "bg-white/[0.04] border border-white/[0.08] text-white/80 rounded-tl-sm"
          }`}>
            {msg.content}
          </div>

          {!isUser && (
            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition px-1">
              <button onClick={handleCopy} className="text-[11px] text-white/25 hover:text-white/60 transition">
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <span className="text-white/10">·</span>
              <button
                onClick={() => onSave(msg.content, msg.agentId ?? "", msg.agentRole ?? "operator")}
                className="text-[11px] text-white/25 hover:text-red-400 transition"
              >
                Save output
              </button>
              <span className="text-white/10">·</span>
              <FeedbackButtons
                messageContent={msg.content}
                agentId={msg.agentId ?? ""}
                agentRole={msg.agentRole ?? "operator"}
                agentName={respondingAgent?.name ?? "Agent"}
                conversationId={conversationId}
                workflowRunId={msg.routingInfo?.workflowRunId}
              />
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs shrink-0 mt-0.5">
            T
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat inner ────────────────────────────────────────────────────────────────
function ChatInner() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId") ?? "";
  const initialConvId = searchParams.get("convId") ?? "";
  const initialPrompt = searchParams.get("prompt") ?? "";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ? decodeURIComponent(initialPrompt) : "");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<{ role: AgentRole; name: string } | null>(null);
  const [conversationId, setConversationId] = useState(initialConvId || "");
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveModal, setSaveModal] = useState<{ content: string; agentId: string; agentRole: AgentRole } | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load agents + templates
  useEffect(() => {
    Promise.all([
      authFetch("/api/takers-ai/agents"),
      authFetch("/api/takers-ai/templates"),
    ]).then(([agentsData, templatesData]) => {
      const agentList: Agent[] = agentsData.agents ?? [];
      setAgents(agentList);
      setTemplates(templatesData.templates ?? []);
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
        setMessages((msgs ?? []).map((m: ChatMessage) => ({ ...m })));
      })
      .catch(() => {})
      .finally(() => setLoadingConv(false));
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const isOperator = selectedAgent?.isDefault === true;

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedAgentId || streaming) return;

    const userMsg: UIMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setStreamingAgent(null);

    let pendingRoutingInfo: UIMessage["routingInfo"] | undefined;
    let pendingAgentId = selectedAgentId;
    let pendingAgentRole: AgentRole = (selectedAgent?.role as AgentRole) ?? "operator";

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

      if (!res.ok) {
        // Read the error body so we surface the actual server-side message
        let serverError = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          serverError = errBody.detail ?? errBody.error ?? serverError;
        } catch {
          try { serverError = await res.text() || serverError; } catch { /* ignore */ }
        }
        throw new Error(serverError);
      }
      if (!res.body) throw new Error("Stream body is null — check server runtime config");

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
          try {
            const parsed = JSON.parse(raw);

            if (parsed.type === "routing") {
              pendingRoutingInfo = {
                routedToRole: parsed.routedToRole,
                routedToAgentId: parsed.routedToAgentId,
                routedToName: parsed.routedToName,
                routingReason: parsed.routingReason,
                workflowRunId: parsed.workflowRunId,
              };
              pendingAgentId = parsed.routedToAgentId;
              pendingAgentRole = parsed.routedToRole;
              setStreamingAgent({ role: parsed.routedToRole, name: parsed.routedToName });
            }

            if (parsed.type === "text") {
              fullText += parsed.text;
              setStreamingText(fullText);
            }

            if (parsed.type === "done") {
              if (parsed.conversationId) {
                newConvId = parsed.conversationId;
                setConversationId(parsed.conversationId);
              }
            }

            if (parsed.type === "error") {
              throw new Error(`[${parsed.stage ?? "stream"}] ${parsed.error ?? "Unknown stream error"}`);
            }
          } catch (parseErr) {
            // Only re-throw real errors (not JSON parse failures on partial lines)
            if (parseErr instanceof Error && parseErr.message.startsWith("[")) throw parseErr;
            /* ignore JSON parse noise on partial SSE lines */
          }
        }
      }

      const assistantMsg: UIMessage = {
        role: "assistant",
        content: fullText,
        agentId: pendingAgentId,
        agentRole: pendingAgentRole,
        routingInfo: pendingRoutingInfo,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingText("");
      setStreamingAgent(null);
    } catch (err) {
      const errMsg: UIMessage = {
        role: "assistant",
        content: `⚠ Error: ${err instanceof Error ? err.message : "Something went wrong."}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }, [input, selectedAgentId, streaming, messages, conversationId, selectedAgent]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleNewChat() {
    setMessages([]); setConversationId(""); setStreamingText(""); setInput("");
    setStreamingAgent(null); inputRef.current?.focus();
  }

  const streamingIcon = streamingAgent
    ? AGENT_ROLE_ICONS[streamingAgent.role] ?? "◎"
    : AGENT_ROLE_ICONS[selectedAgent?.role as AgentRole] ?? "◎";
  const streamingColor = streamingAgent
    ? AGENT_ROLE_COLORS[streamingAgent.role] ?? "bg-red-600"
    : AGENT_ROLE_COLORS[selectedAgent?.role as AgentRole] ?? "bg-red-600";

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="h-14 shrink-0 border-b border-white/[0.07] flex items-center gap-4 px-5">
        <div className="flex items-center gap-2">
          {selectedAgent && (
            <div className={`w-7 h-7 rounded-lg ${selectedAgent.color} bg-opacity-20 border border-white/10 flex items-center justify-center text-base`}>
              {selectedAgent.icon}
            </div>
          )}
          <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-transparent text-white/70 text-sm font-medium focus:outline-none cursor-pointer hover:text-white transition">
            {agents.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id} className="bg-[#13131f]">{a.name}</option>
            ))}
          </select>
        </div>
        {isOperator && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-600/30 bg-red-600/10 text-red-400 font-bold hidden sm:block">
            AUTO-ROUTES
          </span>
        )}
        {selectedAgent && !isOperator && (
          <span className="text-white/20 text-xs hidden sm:block">{selectedAgent.description}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {conversationId && (
            <span className="text-white/20 text-[11px] font-mono hidden sm:block">{conversationId.slice(0, 8)}…</span>
          )}
          <button onClick={handleNewChat}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white transition">
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
                <div className="h-12 w-64 rounded-2xl bg-white/5 animate-pulse" />
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
                {isOperator
                  ? "Ask me anything. I'll route your request to the right specialist automatically."
                  : selectedAgent?.description || "Specialist AI agent. Ready to help."}
              </p>
            </div>
            {isOperator && (
              <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
                {(["content", "marketing", "events", "strategy", "developer", "operations"] as AgentRole[]).map((role) => (
                  <span key={role} className={`text-[10px] px-2 py-1 rounded-full border border-white/10 ${AGENT_ROLE_COLORS[role]} bg-opacity-10 text-white/40`}>
                    {AGENT_ROLE_ICONS[role]} {role}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {[
                "Write 3 IG captions for our next event",
                "Give me a content plan for this week",
                "Plan logistics for the Mansion Party",
                "How do we grow ALL ACCESS membership?",
              ].map((starter) => (
                <button key={starter} onClick={() => setInput(starter)}
                  className="text-xs text-left px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 text-white/40 hover:text-white/70 transition">
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
                allAgents={agents}
                conversationId={conversationId}
                onSave={(content, aId, aRole) => setSaveModal({ content, agentId: aId, agentRole: aRole })}
              />
            ))}
            {/* Streaming bubble */}
            {streaming && (
              <div className="space-y-1">
                {streamingAgent && streamingAgent.role !== "operator" && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 ${AGENT_ROLE_COLORS[streamingAgent.role]} bg-opacity-15 text-white/50`}>
                      {AGENT_ROLE_ICONS[streamingAgent.role]} Routing → {streamingAgent.name}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                  </div>
                )}
                <div className="flex gap-3 justify-start">
                  <div className={`w-8 h-8 rounded-lg ${streamingColor} bg-opacity-20 border border-white/10 flex items-center justify-center text-sm shrink-0 mt-0.5`}>
                    {streamingIcon}
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
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isOperator ? "Ask anything — I'll route to the right specialist…" : `Message ${selectedAgent?.name ?? "Agent"}…`}
              rows={1} disabled={streaming}
              className="w-full bg-transparent px-5 pt-4 pb-12 text-sm text-white placeholder-white/20 resize-none focus:outline-none min-h-[56px] max-h-48 overflow-y-auto disabled:opacity-50"
              style={{ fieldSizing: "content" } as React.CSSProperties} />
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <button onClick={() => setShowTemplates(true)}
                className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition px-2 py-1 rounded-lg hover:bg-white/5">
                <span>◧</span><span>Templates</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-white/15 text-[11px]">⏎ send · ⇧⏎ newline</span>
                <button onClick={sendMessage} disabled={!input.trim() || streaming || !selectedAgentId}
                  className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L7 13M1 7L7 1L13 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTemplates && <TemplatePicker templates={templates} onSelect={(p) => { setInput(p); setShowTemplates(false); inputRef.current?.focus(); }} onClose={() => setShowTemplates(false)} />}
      {saveModal && (
        <SaveOutputModal content={saveModal.content} agentId={saveModal.agentId} agentRole={saveModal.agentRole}
          onSave={() => { setSaveModal(null); setSavedToast(true); setTimeout(() => setSavedToast(false), 3000); }}
          onClose={() => setSaveModal(null)} />
      )}
      {savedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-500/30 text-emerald-300 text-sm font-medium px-5 py-2.5 rounded-xl backdrop-blur-sm z-70">
          ✓ Output saved
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20">Loading…</div>}>
      <ChatInner />
    </Suspense>
  );
}
