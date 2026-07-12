"use client";

import { useEffect, useState } from "react";
import DaymarkClient from "./daymark-client";
import {
  clearSession,
  getSupabaseUser,
  readSession,
  refreshSession,
  saveSession,
  sessionFromHash,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  type SupabaseSession,
} from "./supabase-auth";

type SignedInUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

export default function GoogleAuthGate() {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function restore() {
      const returned = sessionFromHash();
      if (returned) {
        saveSession(returned);
        window.history.replaceState({}, "", window.location.pathname);
      }

      let current = returned ?? readSession();
      if (current && current.expiresAt < Date.now() + 60_000) {
        current = await refreshSession(current);
        if (current) saveSession(current);
      }

      const profile = current
        ? await getSupabaseUser(current.accessToken)
        : null;
      if (!active) return;

      if (!current || !profile?.email) {
        clearSession();
        setLoading(false);
        return;
      }

      const fullName =
        profile.user_metadata?.full_name ?? profile.user_metadata?.name ?? null;
      setSession(current);
      setUser({
        displayName: fullName ?? profile.email,
        email: profile.email,
        fullName,
      });
      setLoading(false);
    }

    restore().catch(() => {
      if (active) {
        clearSession();
        setError("We couldn’t restore your session. Please sign in again.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function signIn() {
    const redirectTo = window.location.origin;
    window.location.assign(
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
    );
  }

  async function signOut() {
    if (session) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${session.accessToken}`,
        },
      }).catch(() => undefined);
    }
    clearSession();
    setSession(null);
    setUser(null);
  }

  if (loading) {
    return (
      <main className="auth-page auth-loading" aria-live="polite">
        <span className="auth-mark">D</span>
        <p>Opening your Daymark…</p>
      </main>
    );
  }

  if (session && user) {
    return (
      <DaymarkClient
        accessToken={session.accessToken}
        onSignOut={signOut}
        user={user}
      />
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="auth-mark">D</span>
        <span className="kicker">YOUR DAYS, HELD GENTLY</span>
        <h1>Plan the day.<br />Remember the life.</h1>
        <p>
          A private home for your intentions, timelines, reflections, mood,
          and the small moments worth keeping.
        </p>
        <button className="google-button" onClick={signIn}>
          <span aria-hidden="true">G</span>
          Continue with Google
        </button>
        {error && <small className="auth-error">{error}</small>}
        <small>Your entries are private and only visible after you sign in.</small>
      </section>
      <aside className="auth-preview" aria-label="A preview of Daymark">
        <span className="kicker">TODAY’S INTENTIONS</span>
        <h2>Make room for what matters.</h2>
        <div><i>✓</i><span><strong>Shape the week ahead</strong><small>09:30 · high</small></span></div>
        <div><i></i><span><strong>Take a quiet lunch break</strong><small>12:30 · medium</small></span></div>
        <div><i></i><span><strong>Write three lines about today</strong><small>20:00 · low</small></span></div>
        <blockquote>“Small steps, honestly remembered, become a life.”</blockquote>
      </aside>
    </main>
  );
}
