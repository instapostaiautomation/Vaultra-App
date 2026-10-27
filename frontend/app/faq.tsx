import { useRouter } from "expo-router";
import { ArrowLeft, ChevronDown } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius } from "@/src/theme";

const FAQS = [
  ["What is Vaultra DigiGold?", "A digital way to buy 24K 99.9% pure LBMA-certified gold starting at ₹10. Every gram you buy is backed by physical gold stored in insured, audited vaults."],
  ["Where is my gold stored?", "Your gold is held in BRINK'S-secured vaults under an independent trustee. It is fully insured and audited periodically."],
  ["How is the price calculated?", "We stream a live 24K rate. When you buy, the rate is locked for 5 minutes. 3% GST is added on top of the gold value as per Indian tax law."],
  ["Can I take my gold as jewellery or coins?", "Yes. Once your KYC is approved you can redeem your balance for coins or jewellery at your store. Making charges, if any, are shown before you confirm."],
  ["How do I redeem physical gold?", "Choose coins or jewellery, confirm redemption and collect at your selected partner store using the 6-digit OTP shown in your vault."],
  ["What is Auto SIP?", "A daily, weekly or monthly UPI AutoPay mandate that automatically buys gold for you. Pause, resume or cancel anytime."],
  ["Why is KYC required?", "Regulations require Aadhaar & PAN verification before redeeming gold. Store officers review submissions, usually within a few hours."],
];

export default function Faq() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <View style={styles.root} testID="faq-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} testID="faq-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>FAQ</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 8 }}>
        <Text style={styles.h1}>Questions, answered</Text>
        {FAQS.map(([q, a], i) => (
          <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} style={styles.item} testID={`faq-item-${i}`}>
            <View style={styles.qRow}>
              <Text style={styles.q}>{q}</Text>
              <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: open === i ? "180deg" : "0deg" }] }} />
            </View>
            {open === i ? (
              <Animated.Text entering={FadeIn} style={styles.a}>
                {a}
              </Animated.Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 44, height: 44, justifyContent: "center" },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  h1: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -0.8, color: colors.onSurface, marginBottom: 8 },
  item: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16 },
  qRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  q: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  a: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.onSurfaceTertiary, marginTop: 10 },
});
