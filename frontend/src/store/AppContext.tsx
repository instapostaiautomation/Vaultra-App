import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  phone: string;
  name: string;
  tenant: string;
  kyc_status: "not_submitted" | "pending" | "approved" | "rejected";
  gold_grams: number;
  invested: number;
  avg_buy_price: number;
  created_at: string;
  kyc: any;
  referral_code?: string;
  referral_balance?: number;
  referred_by?: string | null;
};

export type SilverPrice = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down" };

export type Price = { buy: number; sell: number; change: number; change_pct: number; direction: "up" | "down"; updated_at: string; silver?: SilverPrice };

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
  const [tenant, setTenantState] = useState("vaultra");
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
    const hits = alerts.filter((a) => a.status === "active" && a.tenant === tenant && price.buy <= a.target && !inFlight.current.has(a.id));
    if (!hits.length) return;
    hits.forEach((a) => inFlight.current.add(a.id));
    Promise.all(hits.map((a) => api(`/alerts/${a.id}/trigger`, { method: "POST" }).catch(() => null))).then(async () => {
      await reloadAlerts();
      hits.forEach((a) => inFlight.current.delete(a.id));
    });
  }, [price, alerts, token, tenant, reloadAlerts]);

  const refresh = useCallback(async () => {
    try {
      const v = await api<Vault>(`/vault?tenant=${tenantRef.current}`);
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
      const [t, tn] = await Promise.all([storage.secureGet(TOKEN_KEY, null), storage.getItem(TENANT_KEY, "vaultra")]);
      if (tn) setTenantState(String(tn));
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
        const p = await api<Price>(`/price?tenant=${tenantRef.current}`, { auth: "none" });
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
    setTenantState(t);
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
    <AppCtx.Provider value={{ booting, token, user, tenant, price, priceError, vault, alerts, unreadNotifs, reloadAlerts, reloadNotifs, setTenant, signIn, signOut, refresh }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => useContext(AppCtx);
