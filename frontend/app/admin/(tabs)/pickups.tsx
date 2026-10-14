import { useFocusEffect } from "expo-router";
import { Lock, PackageCheck, PackageOpen } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ACard, AdminHeader, adminText, TenantFilter } from "@/src/components/AdminUI";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet, StatusBadge } from "@/src/components/ui";
import { dateTime, grams, maskPhone, TENANT_NAME, timeAgo } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { tenantQS, useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

export default function Pickups() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { tenantFilter } = useStaff();
  const [tab, setTab] = useState<"pending" | "collected">("pending");
  const [rows, setRows] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const qs = tenantQS(tenantFilter);

  const load = useCallback(async () => {
    try {
      setRows(await api(`/admin/pickups?status=${tab}&${qs}`, { auth: "staff" }));
    } catch {
      setRows([]);
    }
  }, [tab, qs]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (p: any) => {
    setSel(p);
    setOtp("");
    setErr(p.locked ? "Pickup locked after 5 failed OTP attempts. Escalate to store manager" : "");
  };

  const collect = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`/admin/pickups/${sel.id}/collect`, { method: "POST", auth: "staff", body: { otp } });
      toast("success", "Pickup complete", `${sel.item} handed to ${sel.name}`);
      setSel(null);
      load();
    } catch (e: any) {
      setErr(e.message);
      setOtp("");
      if (e.status === 423) {
        setSel((s: any) => ({ ...s, locked: true }));
        toast("error", "Pickup locked", "Too many incorrect OTPs");
        load();
      } else {
        setSel((s: any) => ({ ...s, attempts: (s.attempts || 0) + 1 }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="admin-pickups-screen">
      <AdminHeader title="In-Store Pickups" subtitle="Verify customer OTP before handover" />
      <TenantFilter />
      <View style={styles.seg}>
        {(["pending", "collected"] as const).map((t) => (
          <Pressable key={t} onPress={() => { setRows(null); setTab(t); }} style={[styles.segBtn, tab === t && styles.segOn]} testID={`pickups-tab-${t}`}>
            <Text style={[styles.segText, tab === t && { color: colors.brandPrimary }]}>{t === "pending" ? "Pending" : "Collected Today"}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: bottomChrome + 24, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brandPrimary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {rows === null ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 32 }} />
        ) : rows.length === 0 ? (
          <ACard style={{ alignItems: "center", gap: 8, paddingVertical: 32 }} testID="pickups-empty">
            <PackageOpen size={32} color={colors.adminMuted} />
            <Text style={adminText.h}>{tab === "pending" ? "No pending pickups" : "Nothing handed over today"}</Text>
          </ACard>
        ) : (
          rows.map((p) => (
            <ACard key={p.id} testID={`pickup-item-${p.id}`}>
              <View style={styles.head}>
                <View style={styles.icon}>
                  {p.locked ? <Lock size={18} color={colors.error} /> : <PackageCheck size={18} color={colors.brandPrimary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={adminText.h}>{p.item}</Text>
                  <Text style={adminText.m}>
                    {p.name} · {maskPhone(p.phone)}
                  </Text>
                  <Text style={adminText.m}>
                    {grams(p.grams)} · {TENANT_NAME[p.tenant]}
                  </Text>
                </View>
                {tab === "pending" ? (
                  p.locked ? <StatusBadge status="failed" dark label="Locked" /> : <Text style={adminText.m}>{timeAgo(p.created_at)}</Text>
                ) : (
                  <StatusBadge status="collected" dark />
                )}
              </View>
              {tab === "pending" ? (
                <Button
                  title={p.locked ? "Locked · Escalate" : "Collect Gold"}
                  size="sm"
                  disabled={p.locked}
                  onPress={() => open(p)}
                  style={{ marginTop: 12 }}
                  testID={`pickup-collect-${p.id}`}
                />
              ) : (
                <Text style={[adminText.m, { marginTop: 8 }]}>
                  Handed over by {p.collected_by} ({p.collected_by_name}) · {dateTime(p.collected_at)}
                </Text>
              )}
            </ACard>
          ))
        )}
      </ScrollView>

      <Sheet visible={!!sel} onClose={() => setSel(null)} title="Collect Gold" dark testID="collect-sheet">
        {sel ? (
          <View style={{ paddingBottom: 8 }}>
            <Row dark label="Item" value={sel.item} />
            <Row dark label="Customer" value={sel.name} />
            <Row dark label="Weight" value={grams(sel.grams)} />
            <Text style={[adminText.label, { marginTop: 16, marginBottom: 8 }]}>Customer&apos;s 6-digit OTP</Text>
            <TextInput
              testID="collect-otp-input"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!sel.locked}
              placeholder="••••••"
              placeholderTextColor={colors.adminMuted}
              style={[adminText.input, styles.otp]}
            />
            <Text style={[adminText.m, { marginTop: 8 }]} testID="collect-attempts">
              {sel.locked ? "Locked" : `${5 - (sel.attempts || 0)} of 5 attempts remaining`}
            </Text>
            {err ? <Text style={styles.err} testID="collect-error">{err}</Text> : null}
            <Button title="Verify & Hand Over" loading={busy} disabled={otp.length !== 6 || sel.locked} onPress={collect} style={{ marginTop: 16 }} testID="collect-verify-button" />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  seg: { flexDirection: "row", margin: 16, marginBottom: 8, padding: 4, borderRadius: radius.md, backgroundColor: colors.adminSurfaceSecondary, borderWidth: 1, borderColor: colors.adminBorder },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.adminSurfaceTertiary },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.adminMuted },
  head: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.adminGoldTint, alignItems: "center", justifyContent: "center" },
  otp: { height: 60, fontFamily: fonts.black, fontSize: 26, letterSpacing: 10, textAlign: "center" },
  err: { fontFamily: fonts.medium, fontSize: 13, color: "#F87171", marginTop: 8 },
});
