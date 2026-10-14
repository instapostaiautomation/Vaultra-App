const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const tokens: { user: string | null; staff: string | null } = { user: null, staff: null };

export function setToken(kind: "user" | "staff", token: string | null) {
  tokens[kind] = token;
}

type Opts = { method?: string; body?: unknown; auth?: "user" | "staff" | "none" };

export async function api<T = any>(path: string, { method = "GET", body, auth = "user" }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = auth === "none" ? null : tokens[auth];
  if (tok) headers.Authorization = `Bearer ${tok}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
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
