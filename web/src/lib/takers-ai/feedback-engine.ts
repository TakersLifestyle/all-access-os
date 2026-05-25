// Takers AI — Feedback Learning Engine
//
// Captures structured learning signals from admin interactions and uses them
// to improve routing accuracy and output quality over time.
//
// Signal types:
//   routing_correction  — admin re-routed a request to a different agent
//   output_edit         — admin edited an AI-generated output before using it
//   output_rejection    — admin rejected an output (approval queue: rejected)
//   format_preference   — admin always reformats to a specific style
//   routing_acceptance  — routing was accepted without correction (positive)
//   workflow_success    — a pipeline run completed and output was used
//
// Learning loop:
//   1. Signals are recorded to `feedbackSignals` Firestore collection
//   2. getRoutingHints() aggregates recent signals into routing hints
//   3. Hints are injected into the routing classifier as few-shot examples
//   4. Over time, classifier sees "last 5 times this pattern appeared → X agent"
//   5. getFormatPreferences() returns preferred output formats per agent role
//   6. buildFeedbackSystemPromptSuffix() injects these as system prompt context

import type { AgentRole } from "./types";

// ── Signal model ──────────────────────────────────────────────────────────────
export type FeedbackSignalType =
  | "routing_correction"   // admin manually changed agent after routing
  | "routing_acceptance"   // routing kept as-is (positive signal)
  | "output_edit"          // admin edited the output content before use
  | "output_rejection"     // output was rejected in approval queue
  | "output_acceptance"    // output approved without edits
  | "format_preference"    // admin consistently applies same formatting
  | "workflow_success"     // pipeline run completed + output was used/saved
  | "workflow_failure";    // pipeline run failed or was abandoned

export interface FeedbackSignal {
  id: string;
  type: FeedbackSignalType;
  agentRole: AgentRole;
  agentId: string;
  // For routing signals
  originalRole?: AgentRole;        // what the classifier chose
  correctedRole?: AgentRole;       // what admin changed it to
  userMessagePreview?: string;     // first 200 chars of original message
  routingConfidence?: number;      // confidence at time of routing
  // For output signals
  originalOutput?: string;         // first 500 chars of AI output
  editedOutput?: string;           // first 500 chars of edited version
  editDistance?: number;           // % of content changed (0-100)
  rejectionReason?: string;        // admin's note on rejection
  // For format signals
  formatPattern?: string;          // e.g. "bullet_list", "paragraph", "numbered"
  // For workflow signals
  workflowDefinitionId?: string;
  pipelineRunId?: string;
  stepsCompleted?: number;
  totalSteps?: number;
  // Metadata
  conversationId?: string;
  workflowRunId?: string;
  adminUid: string;
  weight: number;                  // 1.0 = normal, 2.0 = high value signal
  createdAt: string;
}

// Factory
export function createSignal(
  type: FeedbackSignalType,
  agentRole: AgentRole,
  agentId: string,
  adminUid: string,
  data: Partial<FeedbackSignal> = {}
): Omit<FeedbackSignal, "id"> {
  return {
    type,
    agentRole,
    agentId,
    adminUid,
    weight: getSignalWeight(type),
    createdAt: new Date().toISOString(),
    ...data,
  };
}

function getSignalWeight(type: FeedbackSignalType): number {
  const weights: Record<FeedbackSignalType, number> = {
    routing_correction:  2.0,   // strong negative signal
    routing_acceptance:  0.5,   // weak positive (absence of correction)
    output_edit:         1.5,   // moderate negative (needed edits)
    output_rejection:    2.0,   // strong negative
    output_acceptance:   1.0,   // positive
    format_preference:   1.0,   // informational
    workflow_success:    1.5,   // positive reinforcement
    workflow_failure:    2.0,   // strong negative
  };
  return weights[type] ?? 1.0;
}

// ── Routing hint aggregator ───────────────────────────────────────────────────
// Analyzes recent routing_correction signals to build few-shot examples
// for the routing classifier. Returns up to maxExamples recent corrections.

export interface RoutingHint {
  userMessagePreview: string;
  originalRole: AgentRole;
  correctedRole: AgentRole;
  frequency: number;     // how many times this pattern appeared
  confidence: number;    // classifier confidence at time of correction
}

export async function getRoutingHints(
  db: FirebaseFirestore.Firestore,
  maxHints = 5
): Promise<RoutingHint[]> {
  const snap = await db
    .collection("feedbackSignals")
    .where("type", "==", "routing_correction")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  if (snap.empty) return [];

  // Group by (originalRole → correctedRole) pair
  const patternMap: Map<string, RoutingHint> = new Map();

  for (const doc of snap.docs) {
    const d = doc.data() as FeedbackSignal;
    if (!d.originalRole || !d.correctedRole || !d.userMessagePreview) continue;

    const key = `${d.originalRole}→${d.correctedRole}`;
    const existing = patternMap.get(key);
    if (existing) {
      existing.frequency++;
    } else {
      patternMap.set(key, {
        userMessagePreview: d.userMessagePreview,
        originalRole: d.originalRole,
        correctedRole: d.correctedRole,
        frequency: 1,
        confidence: d.routingConfidence ?? 50,
      });
    }
  }

  // Return most frequent corrections first
  return Array.from(patternMap.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, maxHints);
}

// ── Format preference analyzer ────────────────────────────────────────────────
// Looks at output_edit signals for a role to infer preferred output format.

export interface FormatPreference {
  agentRole: AgentRole;
  preferredFormat: string;    // e.g. "bullet_list", "paragraph", "structured_json"
  avgEditDistance: number;    // how much outputs get edited (0=perfect, 100=total rewrite)
  sampleCount: number;
  lastUpdated: string;
}

export async function getFormatPreferences(
  db: FirebaseFirestore.Firestore,
  agentRole: AgentRole
): Promise<FormatPreference | null> {
  const snap = await db
    .collection("feedbackSignals")
    .where("type", "==", "output_edit")
    .where("agentRole", "==", agentRole)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (snap.empty) return null;

  const signals = snap.docs.map((d) => d.data() as FeedbackSignal);
  const avgEditDist = signals
    .filter((s) => s.editDistance !== undefined)
    .reduce((sum, s) => sum + (s.editDistance ?? 0), 0) / (signals.length || 1);

  // Detect format pattern from formatPreference signals
  const formatSnap = await db
    .collection("feedbackSignals")
    .where("type", "==", "format_preference")
    .where("agentRole", "==", agentRole)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  const formatCounts: Record<string, number> = {};
  for (const doc of formatSnap.docs) {
    const fp = (doc.data() as FeedbackSignal).formatPattern ?? "paragraph";
    formatCounts[fp] = (formatCounts[fp] ?? 0) + 1;
  }

  const preferredFormat = Object.entries(formatCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? "paragraph";

  return {
    agentRole,
    preferredFormat,
    avgEditDistance: Math.round(avgEditDist),
    sampleCount: signals.length,
    lastUpdated: signals[0]?.createdAt ?? new Date().toISOString(),
  };
}

// ── Role quality score ────────────────────────────────────────────────────────
// Returns a 0-100 quality score for an agent role based on feedback signals.

export interface RoleQualityScore {
  agentRole: AgentRole;
  score: number;               // 0-100
  approvalRate: number;        // % outputs approved without rejection
  routingAccuracy: number;     // % routings kept without correction
  avgEditDistance: number;     // avg % content edited post-generation
  sampleCount: number;
  trend: "improving" | "stable" | "declining" | "insufficient_data";
}

export async function getRoleQualityScore(
  db: FirebaseFirestore.Firestore,
  agentRole: AgentRole
): Promise<RoleQualityScore> {
  const snap = await db
    .collection("feedbackSignals")
    .where("agentRole", "==", agentRole)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const signals = snap.docs.map((d) => d.data() as FeedbackSignal);

  if (signals.length === 0) {
    return {
      agentRole,
      score: 70,     // neutral default
      approvalRate: 100,
      routingAccuracy: 100,
      avgEditDistance: 0,
      sampleCount: 0,
      trend: "insufficient_data",
    };
  }

  const routingSignals = signals.filter(
    (s) => s.type === "routing_correction" || s.type === "routing_acceptance"
  );
  const outputSignals = signals.filter(
    (s) =>
      s.type === "output_acceptance" ||
      s.type === "output_rejection" ||
      s.type === "output_edit"
  );

  const routingCorrections = routingSignals.filter((s) => s.type === "routing_correction").length;
  const routingTotal = routingSignals.length;
  const routingAccuracy = routingTotal > 0
    ? Math.round(((routingTotal - routingCorrections) / routingTotal) * 100)
    : 100;

  const outputRejections = outputSignals.filter((s) => s.type === "output_rejection").length;
  const outputTotal = outputSignals.length;
  const approvalRate = outputTotal > 0
    ? Math.round(((outputTotal - outputRejections) / outputTotal) * 100)
    : 100;

  const editSignals = signals.filter(
    (s) => s.type === "output_edit" && s.editDistance !== undefined
  );
  const avgEditDist = editSignals.length > 0
    ? Math.round(editSignals.reduce((sum, s) => sum + (s.editDistance ?? 0), 0) / editSignals.length)
    : 0;

  // Composite score: weighted average
  const score = Math.round(
    routingAccuracy * 0.3 +
    approvalRate * 0.4 +
    (100 - avgEditDist) * 0.3
  );

  // Trend: compare last 20 vs previous 20
  const recent = signals.slice(0, 20);
  const older = signals.slice(20, 40);
  let trend: RoleQualityScore["trend"] = "insufficient_data";

  if (recent.length >= 10 && older.length >= 10) {
    const recentPositive = recent.filter(
      (s) => s.type === "routing_acceptance" || s.type === "output_acceptance" || s.type === "workflow_success"
    ).length;
    const olderPositive = older.filter(
      (s) => s.type === "routing_acceptance" || s.type === "output_acceptance" || s.type === "workflow_success"
    ).length;
    const recentRate = recentPositive / recent.length;
    const olderRate = olderPositive / older.length;
    if (recentRate > olderRate + 0.1) trend = "improving";
    else if (recentRate < olderRate - 0.1) trend = "declining";
    else trend = "stable";
  }

  return {
    agentRole,
    score: Math.min(100, Math.max(0, score)),
    approvalRate,
    routingAccuracy,
    avgEditDistance: avgEditDist,
    sampleCount: signals.length,
    trend,
  };
}

// ── Edit distance calculator ──────────────────────────────────────────────────
// Returns % of content changed between original and edited text (0-100).
export function computeEditDistance(original: string, edited: string): number {
  if (!original) return 100;
  if (!edited) return 100;
  if (original === edited) return 0;

  // Levenshtein at word level for large texts (faster than char-level)
  const origWords = original.toLowerCase().split(/\s+/);
  const editWords = edited.toLowerCase().split(/\s+/);
  const maxLen = Math.max(origWords.length, editWords.length);
  if (maxLen === 0) return 0;

  // Count word-level differences using simple set intersection
  const origSet = new Set(origWords);
  const editSet = new Set(editWords);
  let common = 0;
  for (const w of origSet) { if (editSet.has(w)) common++; }

  const jaccardSim = common / (origSet.size + editSet.size - common);
  return Math.round((1 - jaccardSim) * 100);
}

// ── System prompt suffix builder ──────────────────────────────────────────────
// Builds a suffix to append to the routing classifier system prompt.
// Contains few-shot correction examples to improve future routing.

export function buildRoutingFeedbackSuffix(hints: RoutingHint[]): string {
  if (hints.length === 0) return "";

  const examples = hints
    .map((h) => `• "${h.userMessagePreview.slice(0, 100)}…" → was routed to "${h.originalRole}" but should go to "${h.correctedRole}" (corrected ${h.frequency}x)`)
    .join("\n");

  return `\n\nROUTING CORRECTIONS (learn from these):\nThe following patterns have been manually corrected by admins. Apply these learnings:\n${examples}`;
}

// ── Format preference suffix ──────────────────────────────────────────────────
// Injects preferred output format into agent system prompt.
export function buildFormatPreferenceSuffix(pref: FormatPreference | null): string {
  if (!pref || pref.sampleCount < 3) return "";

  const formatDescriptions: Record<string, string> = {
    bullet_list:      "Use bullet points for all lists and recommendations.",
    numbered:         "Use numbered lists for sequential steps and priorities.",
    paragraph:        "Write in flowing paragraphs, not bullet points.",
    structured_json:  "Respond in structured JSON format as specified.",
    concise:          "Keep responses concise. Admin prefers shorter outputs.",
    detailed:         "Provide detailed, comprehensive responses.",
  };

  const desc = formatDescriptions[pref.preferredFormat];
  if (!desc) return "";

  return `\n\nFORMAT PREFERENCE: Based on ${pref.sampleCount} historical interactions, this admin prefers: ${desc}`;
}

// ── Aggregated learning insights ──────────────────────────────────────────────
// Returns a full picture of feedback learning state across all roles.
export interface LearningInsights {
  totalSignals: number;
  roleScores: RoleQualityScore[];
  topCorrectedRoutes: Array<{
    from: AgentRole;
    to: AgentRole;
    count: number;
  }>;
  mostEditedRoles: Array<{ role: AgentRole; avgEditDistance: number; count: number }>;
  highPerformingWorkflows: Array<{ definitionId: string; successRate: number; count: number }>;
  computedAt: string;
}

export async function computeLearningInsights(
  db: FirebaseFirestore.Firestore
): Promise<LearningInsights> {
  const [allSignals, allRoles] = await Promise.all([
    db.collection("feedbackSignals").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("agents").get(),
  ]);

  const roles = [...new Set(allRoles.docs.map((d) => d.data().role as AgentRole))];

  // Per-role quality scores (parallel)
  const roleScores = await Promise.all(
    roles.map((role) => getRoleQualityScore(db, role))
  );

  const signals = allSignals.docs.map((d) => d.data() as FeedbackSignal);

  // Top corrected routes
  const correctionCounts: Record<string, number> = {};
  for (const s of signals.filter((s) => s.type === "routing_correction")) {
    if (s.originalRole && s.correctedRole) {
      const key = `${s.originalRole}→${s.correctedRole}`;
      correctionCounts[key] = (correctionCounts[key] ?? 0) + 1;
    }
  }
  const topCorrectedRoutes = Object.entries(correctionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => {
      const [from, to] = key.split("→");
      return { from: from as AgentRole, to: to as AgentRole, count };
    });

  // Most edited roles
  const editByRole: Record<string, { total: number; count: number }> = {};
  for (const s of signals.filter((s) => s.type === "output_edit")) {
    if (!editByRole[s.agentRole]) editByRole[s.agentRole] = { total: 0, count: 0 };
    editByRole[s.agentRole].total += s.editDistance ?? 0;
    editByRole[s.agentRole].count++;
  }
  const mostEditedRoles = Object.entries(editByRole)
    .map(([role, { total, count }]) => ({
      role: role as AgentRole,
      avgEditDistance: Math.round(total / count),
      count,
    }))
    .sort((a, b) => b.avgEditDistance - a.avgEditDistance)
    .slice(0, 5);

  // High-performing workflows
  const workflowCounts: Record<string, { success: number; total: number }> = {};
  for (const s of signals.filter(
    (s) => s.type === "workflow_success" || s.type === "workflow_failure"
  )) {
    if (!s.workflowDefinitionId) continue;
    if (!workflowCounts[s.workflowDefinitionId]) {
      workflowCounts[s.workflowDefinitionId] = { success: 0, total: 0 };
    }
    workflowCounts[s.workflowDefinitionId].total++;
    if (s.type === "workflow_success") workflowCounts[s.workflowDefinitionId].success++;
  }
  const highPerformingWorkflows = Object.entries(workflowCounts)
    .map(([definitionId, { success, total }]) => ({
      definitionId,
      successRate: Math.round((success / total) * 100),
      count: total,
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);

  return {
    totalSignals: allSignals.size,
    roleScores: roleScores.sort((a, b) => b.score - a.score),
    topCorrectedRoutes,
    mostEditedRoles,
    highPerformingWorkflows,
    computedAt: new Date().toISOString(),
  };
}
