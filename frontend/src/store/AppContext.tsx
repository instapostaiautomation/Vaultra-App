import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setToken } from "@/src/api";

// Default jeweller for demo
const DEFAULT_JEWELLER_ID = "demo-jeweller-001";

export interface User {
  id: string;
  phone: string;
  wallet_id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  dob: string;
  gender: string;
  jeweller_id: string;
  gold_grams: number;
  silver_grams: number;
  invested: number;
  avg_buy_price: number;
  kyc_status: string;
  kyc: Record<string, any>;
  referral_code: string;
  referral_balance: number;
  wallet_balance: number;
  referred_by: string | null;
  created_at: string;
}

export interface JewellerConfig {
  id: string;
  business_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  min_redemption_grams: number;
}

export interface PriceData {
  buy: number;
  sell: number;
  change: number;
  change_pct: number;
  direction: string;
  purity: string;
  gst_rate: number;
  updated_at: string;
  source: "mt5" | "simulated";
  live: boolean;
  silver: {
    buy: number;
    sell: number;
    change: number;
    change_pct: number;
    direction: string;
  };
}

interface AppState {
  user: User | null;
  jewellerId: string;
  jewellerConfig: JewellerConfig | null;
  price: PriceData | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  /** true when opened on a jeweller's own custom domain (tenant is fixed) */
  tenantLocked: boolean;
  login: (challengeId: string, otp: string, extra?: Record<string, string>) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ challenge_id: string; demo_otp: string; is_new_user: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshPrice: () => Promise<void>;
}

const Ctx = createContext<AppState>({} as AppState);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [jewellerId, setJewellerId] = useState(DEFAULT_JEWELLER_ID);
  const [jewellerConfig, setJewellerConfig] = useState<JewellerConfig | null>(null);
  const [price, setPrice] = useState<PriceData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [tenantLocked, setTenantLocked] = useState(false);

  // Load saved session
  useEffect(() => {
    (async () => {
      try {
        const [tok, jid] = await Promise.all([
          AsyncStorage.getItem("customer_token"),
          AsyncStorage.getItem("jeweller_id"),
        ]);
        let activeJid = jid || DEFAULT_JEWELLER_ID;
        let locked = false;
        // Custom domain → fixed tenant (web only)
        if (Platform.OS === "web" && typeof window !== "undefined") {
          try {
            const t = await api<{ kind: "app" | "admin"; jeweller: JewellerConfig }>(
              `/tenant/resolve?host=${encodeURIComponent(window.location.hostname)}`, { auth: "none" }
            );
            if (t.kind === "admin") {
              window.location.replace("/api/admin/jeweller");
              return;
            }
            activeJid = t.jeweller.id;
            locked = true;
            setTenantLocked(true);
          } catch {}
        }
        setJewellerId(activeJid);
        if (tok) {
          setToken("customer", tok);
          try {
            const u = await api<User>("/me");
            if (locked && u.jeweller_id !== activeJid) throw new Error("Different jeweller");
            setUser(u);
          } catch {
            await AsyncStorage.removeItem("customer_token");
            setToken("customer", null);
          }
        }
        // Load jeweller config
        try {
          const cfg = await api<JewellerConfig>(`/jeweller/${activeJid}/config`, { auth: "none" });
          setJewellerConfig(cfg);
        } catch {}
        // Load price
        try {
          const p = await api<PriceData>(`/price?jeweller_id=${activeJid}`, { auth: "none" });
          setPrice(p);
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-refresh price
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const p = await api<PriceData>(`/price?jeweller_id=${jewellerId}`, { auth: "none" });
        setPrice(p);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [jewellerId]);

  const requestOtp = useCallback(async (phone: string) => {
    const resp = await api<{ challenge_id: string; demo_otp: string; is_new_user: boolean }>(
      "/auth/otp/request",
      { method: "POST", body: { phone, jeweller_id: jewellerId }, auth: "none" }
    );
    return resp;
  }, [jewellerId]);

  const login = useCallback(async (challengeId: string, otp: string, extra?: Record<string, string>) => {
    const resp = await api<{ access_token: string; user: User }>(
      "/auth/otp/verify",
      {
        method: "POST",
        body: { challenge_id: challengeId, otp, jeweller_id: jewellerId, ...extra },
        auth: "none",
      }
    );
    setToken("customer", resp.access_token);
    await AsyncStorage.setItem("customer_token", resp.access_token);
    await AsyncStorage.setItem("jeweller_id", jewellerId);
    setUser(resp.user);
  }, [jewellerId]);

  const logout = useCallback(async () => {
    setToken("customer", null);
    setUser(null);
    await AsyncStorage.removeItem("customer_token");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const u = await api<User>("/me");
      setUser(u);
    } catch {}
  }, []);

  const refreshPrice = useCallback(async () => {
    try {
      const p = await api<PriceData>(`/price?jeweller_id=${jewellerId}`, { auth: "none" });
      setPrice(p);
    } catch {}
  }, [jewellerId]);

  const value = useMemo(
    () => ({
      user, jewellerId, jewellerConfig, price, isLoading,
      isLoggedIn: !!user, tenantLocked, login, requestOtp, logout, refreshUser, refreshPrice,
    }),
    [user, jewellerId, jewellerConfig, price, isLoading, tenantLocked, login, requestOtp, logout, refreshUser, refreshPrice]
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useApp() {
  return useContext(Ctx);
}
