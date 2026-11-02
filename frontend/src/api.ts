const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const tokens: { user: string | null; staff: string | null } = { user: null, staff: null };
let tenantHeader = "";

export function setToken(kind: "user" | "staff", token: string | null) {
  tokens[kind] = token;
}

/** Jeweller this app is serving; sent as X-Tenant-ID on every request. */
export function setApiTenant(tenantId: string) {
  tenantHeader = tenantId;
}

type Opts = { method?: string; body?: unknown; auth?: "user" | "staff" | "none" };

export async function api<T = any>(path: string, { method = "GET", body, auth = "user" }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tenantHeader) headers["X-Tenant-ID"] = tenantHeader;
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

/** POST a multipart form (file upload). Content-Type is left to the runtime so the boundary is set. */
export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  if (tenantHeader) headers["X-Tenant-ID"] = tenantHeader;
  if (tokens.user) headers.Authorization = `Bearer ${tokens.user}`;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: form as any });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof (data as any)?.detail === "string" ? (data as any).detail : "Upload failed");
  return data as T;
}
