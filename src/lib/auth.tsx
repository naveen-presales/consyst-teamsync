import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSessionExpired, nextCutoffAt } from "@/lib/session-expiry";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "architect" | "vp";
export type UserStatus = "pending" | "approved" | "rejected";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  status: UserStatus;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: Role[];
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isVp: boolean;
  isArchitect: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, status").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles(((r ?? []) as { role: Role }[]).map((x) => x.role));
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) await loadProfile(s.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const hasSession = !!session;
  const signInAt = session?.user?.last_sign_in_at ?? null;

  // Daily 03:00 IST sign-out. Runs on load, on tab focus/visibility, and via a timer for tabs left open.
  useEffect(() => {
    if (!hasSession) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Returns true when the session was expired and a local sign-out was triggered.
    const expireIfNeeded = () => {
      if (!isSessionExpired(signInAt)) return false;
      void supabase.auth.signOut({ scope: "local" });
      return true;
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      const delay = Math.max(1000, nextCutoffAt() - Date.now() + 500);
      timer = setTimeout(() => {
        if (!expireIfNeeded()) schedule();
      }, delay);
    };

    if (expireIfNeeded()) return;
    schedule();

    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      if (!expireIfNeeded()) schedule(); // re-arm: timers drift while a device sleeps
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [hasSession, signInAt]);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isApproved: profile?.status === "approved",
    isAdmin: roles.includes("admin"),
    isVp: roles.includes("vp"),
    isArchitect: roles.includes("architect"),
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
