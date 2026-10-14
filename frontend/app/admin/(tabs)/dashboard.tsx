import { useFocusEffect, useRouter } from "expo-router";
import { ArrowRight, BookOpen, Clock, Coins, PackageCheck, Radio, ShieldCheck, TrendingUp, Users } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ACard, AdminHeader, adminText, TenantFilter } from "@/src/components/AdminUI";
import { PulseDot } from "@/src/components/Header";
import { inr, TENANT_NAME, timeAgo } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { tenantQS, useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

const CHANNEL_COLOR: Record<string, string> = {
  price: colors.adminMuted,
  vault: colors.brandPrimary,
  kyc: "#60A5FA",
  pickup: colors.success,
  pos: colors.warning,
  ledger: colors.error,
  sip: "#2DD4BF",
  customer: "#F472B6",
  system: colors.adminMuted,
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { staff, tenantFilter } = useStaff();
  const [stats, setStats] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const qs = tenantQS(tenantFilter);

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([api(`/admin/stats?${qs}`, { auth: "staff" }), api(`/admin/events?${qs}`, { auth: "staff" })]);
      setStats(s);
      setEvents(e);
    } catch {}
  }, [qs]);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 4000);
      return () => clearInterval(id);
    }, [load]),
  );

  const cards = [
    { id: "custody", label: "Vault Gold Under Custody", value: stats ? `${stats.vault_custody_grams.toFixed(4)}g` : "—", sub: stats ? `${stats.customers} customers` : "", Icon: Coins },
    { id: "sales", label: "Today's Counter Sales", value: stats ? inr(stats.counter_sales_today, 0) : "—", sub: stats ? `${stats.counter_sales_count} bills` : "", Icon: TrendingUp },
    { id: "pickups", label: "Pending Store Pickups", value: stats ? String(stats.pending_pickups) : "—", sub: "Awaiting OTP", Icon: PackageCheck, to: "/admin/pickups" },
    { id: "kyc", label: "Pending KYC Verifications", value: stats ? String(stats.pending_kyc) : "—", sub: "Oldest first", Icon: ShieldCheck, to: "/admin/kyc-review" },
  ];

  return (
    <View style={styles.root} testID="admin-dashboard-screen">
      <AdminHeader title="Overview" subtitle={`${staff?.name} · ${TENANT_NAME[staff?.tenant === "all" ? tenantFilter : staff?.tenant || "all"]}`} showLogout />
      <TenantFilter />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomChrome + 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brandPrimary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.grid}>
          {cards.map(({ id, label, value, sub, Icon, to }, i) => (
            <Animated.View key={id} entering={FadeInDown.delay(i * 60)} style={styles.statWrap}>
              <Pressable disabled={!to} onPress={() => to && router.push(to as any)} style={styles.stat} testID={`admin-stat-${id}`}>
                <View style={styles.statIcon}>
                  <Icon size={18} color={colors.brandPrimary} />
                </View>
                <Text style={styles.statValue} testID={`admin-stat-${id}-value`} numberOfLines={1} adjustsFontSizeToFit>
                  {value}
                </Text>
                <Text style={styles.statLabel} numberOfLines={2}>
                  {label}
                </Text>
                <Text style={adminText.m}>{sub}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {stats ? (
          <ACard style={styles.priceRow} testID="admin-live-price">
            <PulseDot />
            <Text style={adminText.b}>24K spot</Text>
            <Text style={styles.price}>{inr(stats.price.buy)}/g</Text>
            <Text style={[styles.chg, { color: stats.price.change >= 0 ? "#4ADE80" : "#F87171" }]}>
              {stats.price.change >= 0 ? "▲" : "▼"} {Math.abs(stats.price.change_pct)}%
            </Text>
          </ACard>
        ) : null}

        <ACard testID="admin-event-stream">
          <View style={styles.streamHead}>
            <Radio size={16} color={colors.brandPrimary} />
            <Text style={[adminText.h, { flex: 1 }]}>Live Event Stream</Text>
            <View style={styles.connected}>
              <PulseDot size={6} />
              <Text style={styles.connectedText}>redis pub/sub</Text>
            </View>
          </View>
          <Text style={[adminText.m, { marginBottom: 8 }]}>SUBSCRIBE vaultra-events:{tenantFilter}</Text>
          {events.slice(0, 12).map((e) => {
            const ch = e.channel.split(":")[0];
            return (
              <Animated.View key={e.id} layout={LinearTransition} entering={FadeInDown} style={styles.event}>
                <View style={[styles.evDot, { backgroundColor: CHANNEL_COLOR[ch] || colors.adminMuted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.evMsg} numberOfLines={2}>
                    {e.message}
                  </Text>
                  <Text style={adminText.m}>
                    {e.channel} · {timeAgo(e.created_at)}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
          {events.length === 0 ? <Text style={adminText.m}>Waiting for events…</Text> : null}
        </ACard>

        <View style={{ gap: 8 }}>
          {[
            { label: "Customers Directory", sub: "Phone, balance, KYC state", Icon: Users, to: "/admin/customers", id: "customers" },
            { label: "Store Ledger & Reversals", sub: "Double-entry journal", Icon: BookOpen, to: "/admin/ledger", id: "ledger" },
            { label: "KYC Review Queue", sub: `${stats?.pending_kyc ?? 0} waiting`, Icon: Clock, to: "/admin/kyc-review", id: "kyc" },
          ].map(({ label, sub, Icon, to, id }) => (
            <Pressable key={id} onPress={() => router.push(to as any)} style={styles.link} testID={`admin-link-${id}`}>
              <View style={styles.statIcon}>
                <Icon size={18} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={adminText.h}>{label}</Text>
                <Text style={adminText.m}>{sub}</Text>
              </View>
              <ArrowRight size={18} color={colors.adminMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  statWrap: { width: "50%", padding: 4 },
  stat: { backgroundColor: colors.adminSurfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, padding: 14, minHeight: 148, gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.adminGoldTint, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontFamily: fonts.black, fontSize: 22, letterSpacing: -0.8, color: colors.adminOnSurface },
  statLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.adminOnSurfaceTertiary },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  price: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.adminOnSurface },
  chg: { fontFamily: fonts.bold, fontSize: 13 },
  streamHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  connected: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.adminSuccessTint, borderRadius: radius.pill, paddingHorizontal: 8, height: 24 },
  connectedText: { fontFamily: fonts.semibold, fontSize: 10, color: "#4ADE80" },
  event: { flexDirection: "row", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.adminBorder },
  evDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  evMsg: { fontFamily: fonts.medium, fontSize: 13, color: colors.adminOnSurface },
  link: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.adminSurfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, padding: 14 },
});
