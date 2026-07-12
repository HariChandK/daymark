export const SUPABASE_URL = "https://sudjndxwsfefenfytucf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_I_envv3Prcp0gd6fD0TUIw_p-SiutyF";

export type SupabaseSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const SESSION_KEY = "daymark.supabase.session";

export function readSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SupabaseSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function sessionFromHash(): SupabaseSession | null {
  const values = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = values.get("access_token");
  const refreshToken = values.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const expiresIn = Number(values.get("expires_in") ?? 3600);
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export async function refreshSession(
  session: SupabaseSession,
): Promise<SupabaseSession | null> {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function getSupabaseUser(accessToken: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as {
    email?: string;
    user_metadata?: { full_name?: string; name?: string };
  };
}
