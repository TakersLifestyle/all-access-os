// Takers AI — Role-Based Access Control
//
// Five roles, layered on top of Firebase Auth claims.
// Firebase claims gate the outer door (must be signed in).
// AI roles control what each user can do inside Takers AI.
//
// Role hierarchy (high → low):
//   admin > operator > reviewer > tool_executor > read_only
//
// Storage:
//   `aiRoles/{uid}` Firestore collection — written by admin, read at request time.
//   Firebase admins (token.role === "admin") implicitly have AI admin role.
//   All other Firebase users need an explicit aiRoles document to get access.
//
// Usage in API routes:
//   const perm = await resolvePermissions(decoded, db);
//   if (!perm.can("workflow_execute")) return 403;

import type { DecodedIdToken } from "firebase-admin/auth";

// ── Role definitions ──────────────────────────────────────────────────────────
export type AIRole =
  | "admin"          // full access — everything
  | "operator"       // run workflows, manage jobs, use tools, view costs
  | "reviewer"       // approve/reject items, view analytics + logs
  | "tool_executor"  // execute approved tool calls only
  | "read_only";     // view analytics, logs, outputs — no writes

// ── Permission set ────────────────────────────────────────────────────────────
export type AIPermission =
  | "workflow_execute"      // start pipeline runs / post to chat
  | "workflow_view"         // list/read pipeline runs, workflow definitions
  | "workflow_cancel"       // cancel or archive runs
  | "approval_create"       // create approval queue items
  | "approval_review"       // approve or reject items in approval queue
  | "tool_request"          // request a tool invocation (creates pending call)
  | "tool_execute"          // execute an approved tool call
  | "memory_view"           // read brand memory + knowledge base
  | "memory_edit"           // create/update/delete brand memory
  | "knowledge_ingest"      // trigger knowledge base re-indexing
  | "agent_view"            // view agent configurations
  | "agent_edit"            // modify agents + instructions
  | "analytics_view"        // view analytics dashboard
  | "cost_view"             // view cost analytics
  | "audit_view"            // view audit trail
  | "orchestration_control" // create/run/cancel/reset jobs
  | "orchestration_view"    // view job queue + stats
  | "settings_edit"         // modify system settings
  | "rbac_manage";          // grant/revoke AI roles

// ── Permission matrix ─────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<AIRole, AIPermission[]> = {
  admin: [
    "workflow_execute", "workflow_view", "workflow_cancel",
    "approval_create", "approval_review",
    "tool_request", "tool_execute",
    "memory_view", "memory_edit", "knowledge_ingest",
    "agent_view", "agent_edit",
    "analytics_view", "cost_view", "audit_view",
    "orchestration_control", "orchestration_view",
    "settings_edit", "rbac_manage",
  ],
  operator: [
    "workflow_execute", "workflow_view", "workflow_cancel",
    "approval_create",
    "tool_request",
    "memory_view",
    "agent_view",
    "analytics_view", "cost_view", "audit_view",
    "orchestration_control", "orchestration_view",
  ],
  reviewer: [
    "workflow_view",
    "approval_review",
    "memory_view",
    "agent_view",
    "analytics_view", "audit_view",
    "orchestration_view",
  ],
  tool_executor: [
    "tool_execute",
    "orchestration_view",
  ],
  read_only: [
    "workflow_view",
    "memory_view",
    "agent_view",
    "analytics_view",
    "orchestration_view",
  ],
};

// ── AIRoleRecord — stored in `aiRoles/{uid}` ──────────────────────────────────
export interface AIRoleRecord {
  uid: string;
  email: string;
  displayName: string;
  role: AIRole;
  grantedBy: string;    // admin uid who granted this role
  grantedAt: string;
  revokedAt: string | null;
  isActive: boolean;
  notes: string | null;
}

// ── Resolved permission set ───────────────────────────────────────────────────
// Returned by resolvePermissions() — call once per request, cache in memory.
export interface ResolvedPermissions {
  uid: string;
  aiRole: AIRole;
  firebaseRole: string;
  can: (permission: AIPermission) => boolean;
  requirePermission: (permission: AIPermission) => void; // throws if denied
  allPermissions: AIPermission[];
}

// ── Core resolver ─────────────────────────────────────────────────────────────
// Determines the effective AI role for a decoded Firebase token.
// Firebase admins always get AI admin role.
// Others need an `aiRoles/{uid}` document.
export async function resolvePermissions(
  decoded: DecodedIdToken,
  db: FirebaseFirestore.Firestore
): Promise<ResolvedPermissions> {
  // Firebase admins → AI admin unconditionally
  const isFirebaseAdmin = decoded.role === "admin";

  let aiRole: AIRole = "read_only"; // safe default

  if (isFirebaseAdmin) {
    aiRole = "admin";
  } else {
    const roleDoc = await db.collection("aiRoles").doc(decoded.uid).get();
    if (roleDoc.exists) {
      const record = roleDoc.data() as AIRoleRecord;
      if (record.isActive && record.role) {
        aiRole = record.role;
      }
      // Inactive record → read_only (cannot access unless admin re-activates)
    }
    // No record → read_only (minimal access for Firebase members who need dashboards)
  }

  const permSet = new Set<AIPermission>(ROLE_PERMISSIONS[aiRole] ?? []);

  return {
    uid: decoded.uid,
    aiRole,
    firebaseRole: decoded.role as string,
    can: (p: AIPermission) => permSet.has(p),
    requirePermission: (p: AIPermission) => {
      if (!permSet.has(p)) {
        throw new PermissionDeniedError(p, aiRole);
      }
    },
    allPermissions: Array.from(permSet),
  };
}

// ── Permission denied error ───────────────────────────────────────────────────
export class PermissionDeniedError extends Error {
  permission: AIPermission;
  role: AIRole;

  constructor(permission: AIPermission, role: AIRole) {
    super(`Permission denied: "${permission}" requires a higher role than "${role}"`);
    this.permission = permission;
    this.role = role;
    this.name = "PermissionDeniedError";
  }
}

// ── Role factory ──────────────────────────────────────────────────────────────
export function createRoleRecord(
  uid: string,
  email: string,
  displayName: string,
  role: AIRole,
  grantedBy: string,
  notes: string | null = null
): Omit<AIRoleRecord, "uid"> & { uid: string } {
  return {
    uid,
    email,
    displayName,
    role,
    grantedBy,
    grantedAt: new Date().toISOString(),
    revokedAt: null,
    isActive: true,
    notes,
  };
}

// ── Role display helpers ──────────────────────────────────────────────────────
export const AI_ROLE_LABELS: Record<AIRole, string> = {
  admin:         "Admin",
  operator:      "Operator",
  reviewer:      "Reviewer",
  tool_executor: "Tool Executor",
  read_only:     "Read Only",
};

export const AI_ROLE_DESCRIPTIONS: Record<AIRole, string> = {
  admin:         "Full access to all Takers AI features, settings, and user management.",
  operator:      "Run workflows, manage jobs, use tools, view analytics and costs.",
  reviewer:      "Review and approve/reject items in the approval queue. View-only for everything else.",
  tool_executor: "Execute approved tool calls only. No workflow or analytics access.",
  read_only:     "View analytics, logs, and outputs. No write access.",
};

export const AI_ROLE_COLORS: Record<AIRole, string> = {
  admin:         "bg-red-600/15 border-red-600/25 text-red-300",
  operator:      "bg-blue-600/15 border-blue-600/25 text-blue-300",
  reviewer:      "bg-amber-600/15 border-amber-600/25 text-amber-300",
  tool_executor: "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  read_only:     "bg-white/5 border-white/10 text-white/40",
};

export const PERMISSION_LABELS: Record<AIPermission, string> = {
  workflow_execute:      "Execute Workflows",
  workflow_view:         "View Workflows",
  workflow_cancel:       "Cancel Workflows",
  approval_create:       "Create Approvals",
  approval_review:       "Review Approvals",
  tool_request:          "Request Tools",
  tool_execute:          "Execute Tools",
  memory_view:           "View Memory",
  memory_edit:           "Edit Memory",
  knowledge_ingest:      "Ingest Knowledge",
  agent_view:            "View Agents",
  agent_edit:            "Edit Agents",
  analytics_view:        "View Analytics",
  cost_view:             "View Costs",
  audit_view:            "View Audit Trail",
  orchestration_control: "Control Orchestration",
  orchestration_view:    "View Orchestration",
  settings_edit:         "Edit Settings",
  rbac_manage:           "Manage Roles",
};

// ── Admin-only gate (backwards-compatible shortcut) ───────────────────────────
// Used in existing routes that just need admin. Wraps the old pattern cleanly.
export function isFirebaseAdmin(decoded: DecodedIdToken): boolean {
  return decoded.role === "admin";
}

// ── Minimum role check ────────────────────────────────────────────────────────
// Returns true if `role` has at least as many permissions as `minimumRole`.
// Useful for UI gating without needing a db call.
const ROLE_RANK: Record<AIRole, number> = {
  admin: 100,
  operator: 70,
  reviewer: 40,
  tool_executor: 20,
  read_only: 10,
};

export function hasMinimumRole(role: AIRole, minimumRole: AIRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}
