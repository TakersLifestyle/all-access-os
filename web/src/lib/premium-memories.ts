/**
 * premium-memories.ts
 * Canonical entitlement for Premium Memories features:
 *   — High-resolution image access
 *   — Photo downloads
 *   — Reactions (likedBy)
 *   — Saves / favourites
 *
 * AUTHORIZED GROUPS (exhaustive — any unlisted group is denied):
 *   1. Admin (role === "admin")
 *   2. Active ALL ACCESS $10/mo subscriber:
 *        status === "active"  AND  accountType === "supporter"
 *        Both conditions required. status alone is insufficient because
 *        event-ticket purchasers also receive status="active" with
 *        accountType="community", and must NOT gain premium Memories access.
 *   3. Historical Founding Member:
 *        isFoundingMember === true  (custom claim set by admin)
 *
 * EXPLICITLY EXCLUDED:
 *   — Event-ticket purchasers  (status=active, accountType=community)
 *   — Free accounts            (hasCommunityAccess=true, not subscribed)
 *   — Manual community grants  (hasCommunityAccess=true, no subscription)
 *   — Cancelled subscribers    (status≠active, accountType=supporter)
 *
 * The server endpoint is the AUTHORITY. The client-side helper only drives UI.
 * Never pass a user-supplied boolean to grant access — always derive from
 * verified Firebase ID token claims.
 */

// ── Claim shapes ───────────────────────────────────────────────────────────

/** Minimal subset of custom claims needed for this check. */
export interface PremiumMemoriesClaims {
  role?: string;
  status?: string;
  accountType?: string;
  isFoundingMember?: boolean;
}

/** Minimal subset of the UserProfile used client-side. */
export interface PremiumMemoriesProfile {
  role?: string;
  status?: string;
  accountType?: string;
  isFoundingMember?: boolean;
}

// ── Server-side gate ───────────────────────────────────────────────────────

/**
 * Authoritative entitlement check — use inside API routes.
 * Accepts the decoded Firebase ID token from adminAuth().verifyIdToken(),
 * or any Record<string, unknown> (e.g. DecodedIdToken has an index signature).
 * Custom claims are accessed via string index so no type narrowing is needed.
 * Never call this from client code; it is exported for server routes only.
 */
export function canAccessPremiumMemoriesFromClaims(
  // DecodedIdToken uses [key: string]: unknown for custom claims, so we accept
  // the broadest compatible type and extract values safely.
  claims: Record<string, unknown>,
): boolean {
  // 1. Admin — unconditional access
  if (claims["role"] === "admin") return true;

  // 2. Active ALL ACCESS subscriber
  //    status=active alone is insufficient — event-ticket holders also have it.
  //    accountType=supporter means a Stripe subscription is (or was recently) active.
  //    We require BOTH to confirm a current paying membership.
  const isActiveSubscriber =
    claims["status"] === "active" && claims["accountType"] === "supporter";
  if (isActiveSubscriber) return true;

  // 3. Historical Founding Member — permanent custom claim, set manually by admin
  if (claims["isFoundingMember"] === true) return true;

  return false;
}

// ── Client-side helper (UI only) ───────────────────────────────────────────

/**
 * Client-side entitlement check — drives show/hide UI only.
 * The server re-validates every privileged request independently.
 * isAdmin is passed separately because it's already computed in auth-context.
 */
export function canAccessPremiumMemoriesFromProfile(
  isAdmin: boolean,
  profile: PremiumMemoriesProfile | null,
): boolean {
  if (isAdmin) return true;
  if (!profile) return false;

  const isActiveSubscriber =
    profile.status === "active" && profile.accountType === "supporter";
  if (isActiveSubscriber) return true;

  if (profile.isFoundingMember === true) return true;

  return false;
}
