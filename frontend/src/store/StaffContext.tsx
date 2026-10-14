import React, { createContext, useContext, useEffect, useState } from "react";

import { api, setToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type Staff = { staff_id: string; name: string; tenant: string; role: string };

type Ctx = {
  booting: boolean;
  staff: Staff | null;
  tenantFilter: string;
  setTenantFilter: (t: string) => void;
  signIn: (token: string, s: Staff) => Promise<void>;
  signOut: () => Promise<void>;
};

const StaffCtx = createContext<Ctx>(null as any);
const KEY = "vdg_staff_token";

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [tenantFilter, setTenantFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const t = await storage.secureGet(KEY, null);
      if (t) {
        setToken("staff", String(t));
        try {
          setStaff(await api<Staff>("/admin/me", { auth: "staff" }));
        } catch {
          setToken("staff", null);
          await storage.secureRemove(KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  const signIn = async (t: string, s: Staff) => {
    setToken("staff", t);
    await storage.secureSet(KEY, t);
    setTenantFilter(s.tenant === "all" ? "all" : s.tenant);
    setStaff(s);
  };

  const signOut = async () => {
    setToken("staff", null);
    await storage.secureRemove(KEY);
    setStaff(null);
  };

  return (
    <StaffCtx.Provider value={{ booting, staff, tenantFilter, setTenantFilter, signIn, signOut }}>{children}</StaffCtx.Provider>
  );
}

export const useStaff = () => useContext(StaffCtx);

/** Query param for tenant-scoped admin endpoints */
export function tenantQS(t: string) {
  return t && t !== "all" ? `tenant=${t}` : "";
}
