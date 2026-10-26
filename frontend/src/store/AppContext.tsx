import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { api, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";
import { TENANT_NAME } from "@/src/format";

export const DEFAULT_TENANT = "demo-jeweller-001";

export type User = {
  id: string;
  phone: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  dob?: string;
  gender?: string;
  tenant: string;
  kyc_status: "not_submitted" | "pending" | "approved" | "rejected";
  gold_grams: number;
  silver_grams?: number;
  invested: number;
  avg_buy_price: number;
  wallet_balance?: number;
  created_at: string;
  kyc: any;
  referral_code?: string;
  referral_balance?: number;
  referred_by?: string | null;
};

export type SilverPrice = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down" };

export type Price = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down"; updated_at: string; live?: boolean; source?: string; silver?: SilverPrice };

export type Vault = {
  user: User;
  buy_rate: number;
  sell_rate: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  pending_pickups: any[];
};

export type PriceAlert = {
  id: string;
  target: number;
  tenant: string;
  status: "active" | "triggered";
  created_at: string;
  triggered_at: string | null;
  triggered_price: number | null;
};

type Ctx = {
  booting: boolean;
  token: string | null;
  user: User | null;
  tenant: string;
  tenantName: string;
  tenantLocked: boolean;
  price: Price | null;
  priceError: boolean;
  vault: Vault | null;
  alerts: PriceAlert[];
  unreadNotifs: number;
  reloadAlerts: () => Promise<void>;
  reloadNotifs: () => Promise<void>;
  setTenant: (t: string) => void;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AppCtx = createContext<Ctx>(null as any);
const TOKEN_KEY = "vdg_user_token";
const TENANT_KEY = "vdg_tenant";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [token, setTok] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenantState] = useState(DEFAULT_TENANT);
  const [tenantName, setTenantName] = useState("");
  const [tenantLocked, setTenantLocked] = useState(false);
  const [price, setPrice] = useState<Price | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [vault, setVault] = useState<Vault | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const inFlight = useRef<Set<string>>(new Set());
  const tenantRef = useRef(tenant);
  tenantRef.current = tenant;

  const reloadAlerts = useCallback(async () => {
    try {
      setAlerts(await api<PriceAlert[]>("/alerts"));
    } catch {}
  }, []);

  const reloadNotifs = useCallback(async () => {
    try {
      const r = await api<{ unread_count: number }>("/notifications");
      setUnreadNotifs(r.unread_count);
    } catch {}
  }, []);

  useEffect(() => {
    if (token) { reloadAlerts(); reloadNotifs(); }
    else { setAlerts([]); setUnreadNotifs(0); }
  }, [token, reloadAlerts, reloadNotifs]);

  // When the live price crosses below an active target, ask the server to verify & mark it triggered.
  useEffect(() => {
    if (!price || !token) return;
    const hits = alerts.filter((a) => a.status === "active" && a.tenant === tenant && ((a as any).metal === "silver" ? price.silver?.buy ?? Infinity : price.buy) <= a.target && !inFlight.current.has(a.id));
    if (!hits.length) return;
    hits.forEach((a) => inFlight.current.add(a.id));
    Promise.all(hits.map((a) => api(`/alerts/${a.id}/trigger`, { method: "POST" }).catch(() => null))).then(async () => {
      await reloadAlerts();
      hits.forEach((a) => inFlight.current.delete(a.id));
    });
  }, [price, alerts, token, tenant, reloadAlerts]);

  const refresh = useCallback(async () => {
    try {
      const v = await api<Vault>("/vault");
      setVault(v);
      setUser(v.user);
    } catch (e: any) {
      if (e.status === 401) {
        setToken("user", null);
        setTok(null);
        setUser(null);
        setVault(null);
        await storage.secureRemove(TOKEN_KEY);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const [t, tn] = await Promise.all([storage.secureGet(TOKEN_KEY, null), storage.getItem(TENANT_KEY, DEFAULT_TENANT)]);
      let active = String(tn || DEFAULT_TENANT);
      try {
        const list = await api<{ id: string; business_name: string }[]>("/jewellers/list", { auth: "none" });
        list.forEach((j) => { TENANT_NAME[j.id] = j.business_name; });
        if (!list.some((j) => j.id === active)) active = list.some((j) => j.id === DEFAULT_TENANT) ? DEFAULT_TENANT : list[0]?.id || DEFAULT_TENANT;
      } catch {}
      // Jeweller's own custom domain → fixed store (web)
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
          const r = await api<{ kind: "app" | "admin"; jeweller: { id: string; business_name: string } }>(
            `/tenant/resolve?host=${encodeURIComponent(window.location.hostname)}`, { auth: "none" });
          if (r.kind === "admin") { window.location.replace("/api/admin/jeweller"); return; }
          active = r.jeweller.id;
          TENANT_NAME[active] = r.jeweller.business_name;
          setTenantLocked(true);
        } catch {}
      }
      setTenantState(active);
      setTenantName(TENANT_NAME[active] || "");
      if (t) {
        setToken("user", String(t));
        setTok(String(t));
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (token) refresh();
  }, [token, tenant, refresh]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const p = await api<Price>(`/price?jeweller_id=${tenantRef.current}`, { auth: "none" });
        if (active) {
          setPrice(p);
          setPriceError(false);
        }
      } catch {
        if (active) setPriceError(true);
      }
    };
    load();
    let id: ReturnType<typeof setInterval> | null = setInterval(load, 3000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && !id) {
        load();
        id = setInterval(load, 3000);
      } else if (s !== "active" && id) {
        clearInterval(id);
        id = null;
      }
    });
    return () => {
      active = false;
      if (id) clearInterval(id);
      sub.remove();
    };
  }, [tenant]);

  const setTenant = (t: string) => {
    if (tenantLocked) return;
    setTenantState(t);
    setTenantName(TENANT_NAME[t] || "");
    storage.setItem(TENANT_KEY, t);
  };

  const signIn = async (t: string, u: User) => {
    setToken("user", t);
    await storage.secureSet(TOKEN_KEY, t);
    setUser(u);
    setTok(t);
  };

  const signOut = async () => {
    setToken("user", null);
    await storage.secureRemove(TOKEN_KEY);
    setTok(null);
    setUser(null);
    setVault(null);
  };

  return (
    <AppCtx.Provider value={{ booting, token, user, tenant, tenantName, tenantLocked, price, priceError, vault, alerts, unreadNotifs, reloadAlerts, reloadNotifs, setTenant, signIn, signOut, refresh }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
