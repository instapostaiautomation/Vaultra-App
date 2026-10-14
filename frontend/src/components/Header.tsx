import { useRouter } from "expo-router";
import { Check, ChevronDown, Coins, Store, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sheet } from "@/src/components/ui";
import { grams, inr, TENANT_NAME } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

export function PulseDot({ color = colors.success, size = 8 }: { color?: string; size?: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(2.4, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false);
  }, [s]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2.4 - s.value > 0 ? (2.4 - s.value) / 1.4 : 0 }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export function LiveTicker({ testID = "live-gold-ticker" }: { testID?: string }) {
  const { price, priceError } = useApp();
  const up = price?.direction !== "down";
  return (
    <View style={styles.ticker} testID={testID}>
      <PulseDot color={priceError ? colors.error : colors.success} />
      <Text style={styles.tickerLabel}>24K (99.9%)</Text>
      <Text style={styles.tickerPrice} testID="live-gold-price">
        {price ? `${inr(price.buy)}/g` : "—"}
      </Text>
      <Text style={[styles.tickerLive, { color: up ? colors.success : colors.error }]}>{priceError ? "OFFLINE" : `${up ? "▲" : "▼"} LIVE`}</Text>
    </View>
  );
}

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Coins size={size * 0.55} color={colors.onBrandPrimary} strokeWidth={2.2} />
    </View>
  );
}

export function TenantSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tenant, setTenant } = useApp();
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose your store" testID="tenant-sheet">
      <Text style={styles.sheetHint}>Rates, invoices and pickups follow the partner store you pick.</Text>
      {["vaultra", "tanishq", "malabar"].map((t) => (
        <Pressable
          key={t}
          testID={`tenant-option-${t}`}
          onPress={() => {
            setTenant(t);
            onClose();
          }}
          style={[styles.tenantRow, t === tenant && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
        >
          <View style={styles.tenantIcon}>
            <Store size={18} color={colors.brandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tenantName}>{TENANT_NAME[t]}</Text>
            <Text style={styles.tenantSub}>{t === "vaultra" ? "Flagship bullion vault" : "Partner store · in-store pickup"}</Text>
          </View>
          {t === tenant ? <Check size={20} color={colors.brandSecondary} /> : null}
        </Pressable>
      ))}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tenant, token, vault, user } = useApp();
  const [open, setOpen] = useState(false);
  const g = vault?.user.gold_grams ?? 0;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headRow}>
        <LogoMark />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>
            Vaultra <Text style={{ color: colors.brandSecondary }}>DigiGold</Text>
          </Text>
          <Pressable testID="tenant-switch" onPress={() => setOpen(true)} style={styles.tenantBtn} hitSlop={8}>
            <Text style={styles.tenantText} numberOfLines={1}>
              {TENANT_NAME[tenant]}
            </Text>
            <ChevronDown size={14} color={colors.muted} />
          </Pressable>
        </View>
        <Pressable
          testID="header-profile-button"
          onPress={() => router.push(token ? "/profile" : "/login")}
          style={[styles.profileBtn, token ? styles.profileOn : null]}
        >
          <User size={16} color={token ? colors.onSurfaceInverse : colors.onSurface} />
          <Text style={[styles.profileText, token ? { color: colors.onSurfaceInverse } : null]} numberOfLines={1}>
            {token ? (user?.name?.split(" ")[0] ?? "Profile") : "Sign In"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.pillsRow}>
        <LiveTicker />
        <Pressable testID="vault-balance-pill" onPress={() => router.push("/vault")} style={styles.balancePill}>
          <Text style={styles.balanceGrams}>{grams(g)}</Text>
          <Text style={styles.balanceInr}>≈ {inr(vault?.current_value ?? 0)}</Text>
        </Pressable>
      </View>
      <TenantSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>{title}</Text>
          {subtitle ? <Text style={styles.screenSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: { backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: fonts.black, fontSize: 18, letterSpacing: -0.6, color: colors.onSurface },
  tenantBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 20 },
  tenantText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, maxWidth: 170 },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 120,
  },
  profileOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  profileText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  pillsRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  ticker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  tickerLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  tickerPrice: { fontFamily: fonts.bold, fontSize: 13, color: colors.onSurface, letterSpacing: -0.3 },
  tickerLive: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  balancePill: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: "#F0E2B0",
    justifyContent: "center",
  },
  balanceGrams: { fontFamily: fonts.bold, fontSize: 12, color: colors.onBrandTertiary, letterSpacing: -0.2 },
  balanceInr: { fontFamily: fonts.medium, fontSize: 10, color: colors.onBrandTertiary },
  sheetHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 12 },
  tenantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  tenantIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  tenantName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  tenantSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  screenTitle: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -0.8, color: colors.onSurface },
  screenSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
});
