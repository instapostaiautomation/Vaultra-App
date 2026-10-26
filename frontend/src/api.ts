const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const tokens: { customer: string | null; jeweller: string | null; master: string | null } = {
  customer: null, jeweller: null, master: null,
};

export type AuthRole = "customer" | "jeweller" | "master" | "none";

export function setToken(role: AuthRole, token: string | null) {
  if (role !== "none") tokens[role] = token;
}

export function getToken(role: AuthRole): string | null {
  if (role === "none") return null;
  return tokens[role];
}

type Opts = { method?: string; body?: unknown; auth?: AuthRole };

export async function api<T = any>(path: string, { method = "GET", body, auth = "customer" }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = auth === "none" ? null : tokens[auth];
  if (tok) headers.Authorization = `Bearer ${tok}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Network unavailable. Check your connection");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as any)?.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x: any) => x.msg).join(", ") : "Request failed";
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}
