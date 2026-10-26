import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  // Load saved session
  useEffect(() => {
    (async () => {
      try {
        const [tok, jid] = await Promise.all([
          AsyncStorage.getItem("customer_token"),
          AsyncStorage.getItem("jeweller_id"),
        ]);
        if (jid) setJewellerId(jid);
        const activeJid = jid || DEFAULT_JEWELLER_ID;
        if (tok) {
          setToken("customer", tok);
          try {
            const u = await api<User>("/me");
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
          const p = await api<PriceData>("/price", { auth: "none" });
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
        const p = await api<PriceData>("/price", { auth: "none" });
        setPrice(p);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, []);

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
      const p = await api<PriceData>("/price", { auth: "none" });
      setPrice(p);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      user, jewellerId, jewellerConfig, price, isLoading,
      isLoggedIn: !!user, login, requestOtp, logout, refreshUser, refreshPrice,
    }),
    [user, jewellerId, jewellerConfig, price, isLoading, login, requestOtp, logout, refreshUser, refreshPrice]
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useApp() {
  return useContext(Ctx);
}
