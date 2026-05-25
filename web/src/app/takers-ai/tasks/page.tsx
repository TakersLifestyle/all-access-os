"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AITask, TaskStatus, TaskPriority } from "@/lib/takers-ai/types";

// Note: Tasks use client SDK directly (admin-only by Firestore rules)
// The client has isAdmin=true via custom claims

const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "todo", label: "To Do", color: "border-white/10" },
  { status: "in_progress", label: "In Progress", color: "border-amber-500/30" },
  { status: "done", label: "Done", color: "border-emerald-500/30" },
];

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "text-white/30 bg-white/5 border-white/10",
  medium: "text-amber-400 bg-amber-600/10 border-amber-600/20",
  high: "text-red-400 bg-red-600/10 border-red-600/20",
};

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: AITask;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5 space-y-2.5 group hover:border-white/15 transition">
      <div className="flex items-start justify-between gap-2">
        <p className="text-white/80 text-sm font-medium leading-snug">{task.title}</p>
        <button
          onClick={() => onDelete(task.id)}
          className="text-white/15 hover:text-red-400 transition opacity-0 group-hover:opacity-100 shrink-0 text-base leading-none"
        >
          ✕
        </button>
      </div>
      {task.description && (
        <p className="text-white/30 text-xs leading-relaxed">{task.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[task.priority]} capitalize`}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-white/20">{task.dueDate}</span>
        )}
        {/* Status change */}
        <div className="ml-auto flex gap-1">
          {STATUS_COLUMNS.filter((s) => s.status !== task.status).map((s) => (
            <button
              key={s.status}
              onClick={() => onStatusChange(task.id, s.status)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/25 hover:text-white/60 hover:border-white/25 transition"
            >
              → {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewTaskModal({
  onSave,
  onClose,
}: {
  onSave: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, "aiTasks"), {
        title,
        description,
        agentId: "operator",
        status: "todo",
        priority,
        dueDate: dueDate || null,
        createdAt: now,
        updatedAt: now,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-white">New Task</h3>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)…"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-white/30 text-xs mb-1.5 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none"
            >
              <option value="low" className="bg-[#13131f]">Low</option>
              <option value="medium" className="bg-[#13131f]">Medium</option>
              <option value="high" className="bg-[#13131f]">High</option>
            </select>
          </div>
          <div>
            <label className="text-white/30 text-xs mb-1.5 block">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Adding…" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "aiTasks"), orderBy("createdAt", "desc")));
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AITask)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function handleStatusChange(id: string, status: TaskStatus) {
    await updateDoc(doc(db, "aiTasks", id), { status, updatedAt: new Date().toISOString() });
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this task?")) return;
    await deleteDoc(doc(db, "aiTasks", id));
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const archivedCount = tasks.filter((t) => t.status === "archived").length;
  const activeColumns = STATUS_COLUMNS;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-white/[0.07] flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Task Board</h1>
          <p className="text-white/30 text-sm mt-0.5">
            {tasks.filter((t) => t.status !== "archived").length} active tasks
            {archivedCount > 0 && ` · ${archivedCount} archived`}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition"
        >
          + Add task
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 min-w-[600px] h-full">
          {activeColumns.map(({ status, label, color }) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            return (
              <div key={status} className={`flex-1 flex flex-col min-w-52 max-w-xs border-t-2 ${color} pt-4`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</h2>
                  <span className="text-xs text-white/20 bg-white/5 rounded-full px-1.5 py-0.5">
                    {columnTasks.length}
                  </span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                    <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
                  </div>
                ) : (
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8 text-white/15 text-xs">
                        No tasks
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          onSave={() => { setShowNew(false); loadTasks(); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
