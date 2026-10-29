import { useRouter } from "expo-router";
import {
  BadgeCheck, Bell, ChevronRight, Gem, Gift, HelpCircle, LogIn, Phone, Power, RefreshCw, Users, Vault, X,
} from "lucide-react-native";
import React from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { maskPhone } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

type Item = { key: string; label: string; icon: any; to?: string; auth?: boolean; hint?: string };

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user, vault, tenantName, tenantPhone, signOut } = useApp();
  const kyc = vault?.user.kyc_status;
  const name = user?.name || [user?.first_name].filter(Boolean).join(" ") || "Customer";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const items: Item[] = [
    { key: "vault", label: "My Vault & Redeem", icon: Vault, to: "/vault" },
    { key: "jewellery", label: "Jewellery Catalogue", icon: Gem, to: "/jewellery" },
    { key: "sip", label: "Auto SIP", icon: RefreshCw, to: "/sip" },
    { key: "gift", label: "Gift Gold", icon: Gift, to: "/gift" },
    { key: "refer", label: "Refer & Earn", icon: Users, to: "/referral" },
    { key: "notifs", label: "Notifications", icon: Bell, to: "/notifications", auth: true },
    { key: "kyc", label: "KYC Status", icon: BadgeCheck, to: "/profile", auth: true, hint: kyc === "approved" ? "Verified" : kyc === "pending" ? "In review" : "Pending" },
    { key: "faq", label: "Help & FAQs", icon: HelpCircle, to: "/faq" },
  ];

  const go = (to: string) => {
    onClose();
    setTimeout(() => router.push(to as any), 10);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} testID="side-menu-backdrop" />
        </Animated.View>
        <Animated.View entering={SlideInLeft.duration(260)} style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} testID="side-menu">
          <Pressable onPress={onClose} style={styles.close} hitSlop={8} testID="side-menu-close">
            <X size={20} color={colors.mutedLight} />
          </Pressable>

          {/* Profile block */}
          <Pressable style={styles.profile} onPress={() => go(token ? "/profile" : "/login")} testID="side-menu-profile">
            <View style={styles.avatar}>
              {token ? <Text style={styles.avatarText}>{initials}</Text> : <LogIn size={22} color={colors.brandPrimary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{token ? name : "Welcome"}</Text>
              <Text style={styles.phone} numberOfLines={1}>{token ? maskPhone(user?.phone) : "Sign in to view your vault"}</Text>
            </View>
            <ChevronRight size={20} color={colors.brandPrimary} />
          </Pressable>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
            {items.filter((i) => !i.auth || token).map((it) => {
              const Icon = it.icon;
              return (
                <Pressable key={it.key} onPress={() => go(it.to!)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.brandTertiary }]} testID={`side-menu-${it.key}`}>
                  <View style={styles.itemIcon}>
                    <Icon size={18} color={colors.brandDeep} strokeWidth={1.9} />
                  </View>
                  <Text style={styles.itemLabel}>{it.label}</Text>
                  {it.hint ? <Text style={[styles.hint, it.hint === "Verified" && { color: colors.success }]}>{it.hint}</Text> : null}
                </Pressable>
              );
            })}
            {token ? (
              <Pressable onPress={() => { onClose(); signOut(); }} style={styles.item} testID="side-menu-logout">
                <View style={[styles.itemIcon, { backgroundColor: colors.errorTint }]}>
                  <Power size={18} color={colors.error} strokeWidth={1.9} />
                </View>
                <Text style={[styles.itemLabel, { color: colors.error }]}>Logout</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {tenantPhone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${tenantPhone}`)} style={{ alignItems: "center" }} testID="side-menu-contact">
                <Text style={styles.footMuted}>For any query contact on</Text>
                <View style={styles.phoneRow}>
                  <Phone size={14} color={colors.brandDeep} />
                  <Text style={styles.footPhone}>{maskPhone(tenantPhone)}</Text>
                </View>
              </Pressable>
            ) : null}
            <Text style={styles.powered}>
              Powered by <Text style={styles.poweredBrand}>{tenantName || "Digital Gold"}</Text>
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  panel: { width: "82%", maxWidth: 340, backgroundColor: colors.surface, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, overflow: "hidden" },
  close: { position: "absolute", right: 12, top: 12, zIndex: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  profile: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 40, padding: 16, borderRadius: radius.md, backgroundColor: colors.surfaceInverse, borderWidth: 1, borderColor: colors.goldHairline },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.inkSoft, borderWidth: 1.5, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 18, color: colors.brandPrimary, letterSpacing: 0.5 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurfaceInverse, letterSpacing: -0.2 },
  phone: { fontFamily: fonts.regular, fontSize: 12, color: colors.goldSheen, marginTop: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingHorizontal: 20 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface },
  hint: { fontFamily: fonts.semibold, fontSize: 11, color: colors.warning },
  footer: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 14, alignItems: "center", gap: 10 },
  footMuted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  footPhone: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface, letterSpacing: 0.3 },
  powered: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  poweredBrand: { fontFamily: fonts.bold, color: colors.brandDeep },
});
