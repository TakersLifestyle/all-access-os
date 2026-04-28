"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LeadFormData {
  name: string;
  email: string;
  instagram: string;
  message: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey 👋 I'm OpenClaw — your ALL ACCESS concierge. Ask me about membership, upcoming events, or how to get involved. What's on your mind?",
};

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function LeadForm({
  onSubmit,
  onSkip,
}: {
  onSubmit: (data: LeadFormData) => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<LeadFormData>({
    name: "",
    email: "",
    instagram: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<LeadFormData>>({});

  const validate = () => {
    const e: Partial<LeadFormData> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
  };

  return (
    <div className="mx-3 mb-3 rounded-xl border border-purple-500/30 bg-purple-950/40 p-4">
      <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-3">
        Lock In Your Spot
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div>
          <input
            type="text"
            placeholder="Your name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
          />
          {errors.name && <p className="text-red-400 text-xs mt-0.5">{errors.name}</p>}
        </div>
        <div>
          <input
            type="email"
            placeholder="Email address *"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
          />
          {errors.email && <p className="text-red-400 text-xs mt-0.5">{errors.email}</p>}
        </div>
        <input
          type="text"
          placeholder="Instagram handle (optional)"
          value={form.instagram}
          onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
        />
        <div className="flex gap-2 mt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 py-2 text-sm font-semibold text-white transition"
          >
            {submitting ? "Sending…" : "Send It"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="px-3 rounded-lg border border-white/10 text-white/40 hover:text-white/60 text-sm transition"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}

export default function OpenClaw() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leadFormShownRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, showLeadForm]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const appendAssistantChunk = useCallback((chunk: string, replace = false) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !replace) {
        return [...prev.slice(0, -1), { role: "assistant", content: last.content + chunk }];
      }
      return [...prev, { role: "assistant", content: chunk }];
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/openclaw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Strip [LEAD_FORM] marker from visible text
        const visible = accumulated.replace("[LEAD_FORM]", "").trimEnd();

        if (firstChunk) {
          setMessages((prev) => [...prev, { role: "assistant", content: visible }]);
          firstChunk = false;
        } else {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: visible },
          ]);
        }
      }

      // After streaming completes, check if lead form should appear
      if (accumulated.includes("[LEAD_FORM]") && !leadFormShownRef.current && !leadCaptured) {
        leadFormShownRef.current = true;
        setShowLeadForm(true);
      }

      if (!isOpen) setHasUnread(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Something went wrong on my end. Reach out directly at hello@allaccesswinnipeg.ca and we'll sort you out.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, isOpen, leadCaptured, appendAssistantChunk]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLeadSubmit = async (data: LeadFormData) => {
    try {
      await fetch("/api/openclaw/capture-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {}

    setShowLeadForm(false);
    setLeadCaptured(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `Got you, ${data.name.split(" ")[0]} 🔥 You're on the list. We'll be in touch — keep an eye on your inbox. In the meantime, check out allaccesswinnipeg.ca to learn more.`,
      },
    ]);
  };

  const handleLeadSkip = () => {
    setShowLeadForm(false);
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-50 flex flex-col w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
          style={{ background: "#0e0a1a", maxHeight: "min(560px, calc(100dvh - 120px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-white/3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
              <ClawIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">OpenClaw</p>
              <p className="text-xs text-white/40 leading-tight">ALL ACCESS Concierge</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/30 hover:text-white/70 transition p-1"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-purple-700 text-white rounded-tr-sm"
                      : "bg-white/6 text-white/90 rounded-tl-sm border border-white/5"
                  }`}
                >
                  {msg.content || <TypingDots />}
                </div>
              </div>
            ))}

            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-white/6 border border-white/5 rounded-2xl rounded-tl-sm">
                  <TypingDots />
                </div>
              </div>
            )}

            {showLeadForm && (
              <LeadForm onSubmit={handleLeadSubmit} onSkip={handleLeadSkip} />
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/8 bg-white/2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              disabled={isStreaming}
              className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="w-9 h-9 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition flex-shrink-0"
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 8L2 2l3 6-3 6 12-6z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-purple-900/50 transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
          boxShadow: "0 0 24px rgba(124, 58, 237, 0.35)",
        }}
        aria-label={isOpen ? "Close OpenClaw" : "Open OpenClaw"}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <ClawIcon size={22} />
        )}
        {hasUnread && !isOpen && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0e0a1a]" />
        )}
      </button>
    </>
  );
}

function ClawIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C10.5 3 9 4 9 6c0 2 1 3.5 2 5L9 17c-.5 1.5.5 3 2 3s2.5-1.5 2-3l-2-6c1-1.5 2-3 2-5 0-2-1.5-3-3-3z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M7 5C5.5 5 4.5 6 4.5 7.5c0 1.5.8 2.8 1.8 4L4.5 17c-.4 1.3.4 2.5 1.5 2.5s2-.8 1.8-2L9 12"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M17 5C18.5 5 19.5 6 19.5 7.5c0 1.5-.8 2.8-1.8 4L19.5 17c.4 1.3-.4 2.5-1.5 2.5s-2-.8-1.8-2L15 12"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}
