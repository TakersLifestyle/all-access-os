"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type UserRole = "admin" | "member";
type UserStatus = "active" | "inactive" | "past_due" | "cancelled";

/** Community Member = attended an event. Supporting Member = $25/mo subscription. */
export type AccountType = "community" | "supporter";

interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  displayName: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isCreator?: boolean;
  creatorStatus?: string;
  hasCommunityAccess?: boolean;
  accountType?: AccountType;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  /** true when user has community access: active membership, event ticket, or manual grant. */
  hasCommunityAccess: boolean;
  /** Attended ≥1 event but not a $25/mo subscriber. */
  isCommunityMember: boolean;
  /** $25/mo subscriber (or admin). Full perks + badges + discounts. */
  isSupportingMember: boolean;
  /** Raw accountType from claim / Firestore ("community" | "supporter" | null). */
  accountType: AccountType | null;
  /** Force-refresh the Firebase ID token to pick up new custom claims immediately.
   *  Call this right after checkout success so the user gets access without sign-out/sign-in. */
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isActive: false,
  hasCommunityAccess: false,
  isCommunityMember: false,
  isSupportingMember: false,
  accountType: null,
  refreshToken: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const buildProfile = useCallback(async (firebaseUser: User) => {
    try {
      // Force-read the latest ID token claims
      const idTokenResult = await firebaseUser.getIdTokenResult(false);
      const claims = idTokenResult.claims as {
        role?: UserRole;
        status?: UserStatus;
        hasCommunityAccess?: boolean;
        accountType?: AccountType;
      };

      // Custom claims are the source of truth for role/status
      // Firestore doc is the fallback for first-time users before webhook fires
      let role: UserRole = (claims.role as UserRole) ?? "member";
      let status: UserStatus = (claims.status as UserStatus) ?? "inactive";
      let hasCommunityAccess = !!claims.hasCommunityAccess;
      let accountType: AccountType | undefined = claims.accountType;
      let stripeCustomerId: string | undefined;
      let stripeSubscriptionId: string | undefined;
      let isCreator: boolean | undefined;
      let creatorStatus: string | undefined;

      // Pull extra profile data from Firestore (name, stripe IDs, creator flags)
      // Also used as fallback for hasCommunityAccess / accountType when token not yet refreshed
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (!claims.role) role = data.role ?? "member";
          if (!claims.status) status = data.status ?? "inactive";
          // Firestore fallback when claim hasn't been picked up yet (token stale)
          if (!hasCommunityAccess) hasCommunityAccess = !!data.hasCommunityAccess;
          if (!accountType) accountType = data.accountType as AccountType | undefined;
          stripeCustomerId = data.stripeCustomerId;
          stripeSubscriptionId = data.stripeSubscriptionId;
          isCreator = data.isCreator;
          creatorStatus = data.creatorStatus;
        }
      } catch {
        // Firestore rules may block read until custom claims are set — use claim values
      }

      setProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role,
        status,
        stripeCustomerId,
        stripeSubscriptionId,
        isCreator,
        creatorStatus,
        hasCommunityAccess,
        accountType,
      });
    } catch {
      setProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        role: "member",
        status: "inactive",
        hasCommunityAccess: false,
      });
    }
  }, []);

  /** Force-refresh ID token — picks up new custom claims from webhook immediately */
  const refreshToken = useCallback(async () => {
    if (!user) return;
    try {
      // true = bypass cache, hit Firebase Auth server for fresh claims
      await user.getIdToken(true);
      await buildProfile(user);
    } catch {
      // Silently fail — user will get updated on next natural refresh
    }
  }, [user, buildProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await buildProfile(firebaseUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [buildProfile]);

  const isAdmin = profile?.role === "admin";
  const isActive = profile?.status === "active" || isAdmin;
  const isSupportingMember = isAdmin || isActive || profile?.accountType === "supporter";
  const hasCommunityAccess = isSupportingMember || !!profile?.hasCommunityAccess;
  const isCommunityMember = hasCommunityAccess && !isSupportingMember;
  const accountType: AccountType | null = profile?.accountType ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isActive,
        hasCommunityAccess,
        isCommunityMember,
        isSupportingMember,
        accountType,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
