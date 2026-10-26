import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Coins, User } from "lucide-react-native";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { grams, inr } from "@/src/format";
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
  const up = (price?.change_pct ?? 0) >= 0;
  return (
    <View style={styles.ticker} testID={testID}>
      <PulseDot color={priceError ? colors.error : colors.success} />
      <Text style={styles.tickerLabel} numberOfLines={1}>24K (99.9%)</Text>
      <Text style={styles.tickerPrice} numberOfLines={1} testID="live-gold-price">
        {price ? `${inr(price.buy)}/g` : "—"}
      </Text>
      <Text numberOfLines={1} style={[styles.tickerLive, { color: up ? colors.success : colors.error }]}>{priceError ? "OFFLINE" : `${up ? "▲" : "▼"} ${price?.live ? "LIVE" : "INDICATIVE"}`}</Text>
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

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, vault, user, unreadNotifs, tenantName } = useApp();
  const g = vault?.user.gold_grams ?? 0;
  const displayName = user?.first_name || user?.name?.split(" ")[0] || "Profile";

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headRow}>
        <LogoMark />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>
            {token && user ? (
              <>Hi, <Text style={{ color: colors.brandSecondary }}>{displayName}</Text></>
            ) : (
              <>{tenantName || "Digital Gold"}</>
            )}
          </Text>
        </View>
        {/* Notification Bell */}
        {token ? (
          <Pressable
            testID="header-notification-bell"
            onPress={() => router.push("/notifications")}
            style={styles.bellBtn}
            hitSlop={8}
          >
            <Bell size={20} color={colors.onSurface} />
            {unreadNotifs > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
        <Pressable
          testID="header-profile-button"
          onPress={() => router.push(token ? "/profile" : "/login")}
          style={[styles.profileBtn, token ? styles.profileOn : null]}
        >
          <User size={16} color={token ? colors.onSurfaceInverse : colors.onSurface} />
          <Text style={[styles.profileText, token ? { color: colors.onSurfaceInverse } : null]} numberOfLines={1}>
            {token ? displayName : "Sign In"}
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
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right, showBack = false }: { title: string; subtitle?: string; right?: React.ReactNode; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
      <View style={styles.headRow}>
        {showBack ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.backBtn} testID="screen-back-button">
            <ArrowLeft size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
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
  bellBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: "#FFFFFF" },
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
  screenTitle: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -0.8, color: colors.onSurface },
  screenSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
});
