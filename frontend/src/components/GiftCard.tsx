import { Cake, Coins, HandHeart, Heart, PartyPopper, Sparkles } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { grams } from "@/src/format";
import { colors, fonts, radius } from "@/src/theme";

export const GIFT_THEMES = [
  { id: "diwali", label: "Diwali", title: "Shubh Deepavali", bg: colors.giftDiwali, accent: colors.giftDiwaliAccent, Icon: Sparkles },
  { id: "birthday", label: "Birthday", title: "Happy Birthday", bg: colors.giftBirthday, accent: colors.giftBirthdayAccent, Icon: Cake },
  { id: "wedding", label: "Wedding", title: "Blessings for Two", bg: colors.giftWedding, accent: colors.giftWeddingAccent, Icon: Heart },
  { id: "thank_you", label: "Thank You", title: "With Gratitude", bg: colors.giftThanks, accent: colors.giftThanksAccent, Icon: HandHeart },
  { id: "congrats", label: "Congrats", title: "Congratulations", bg: colors.giftCongrats, accent: colors.giftCongratsAccent, Icon: PartyPopper },
] as const;

export const themeOf = (id: string) => GIFT_THEMES.find((t) => t.id === id) || GIFT_THEMES[0];

export function GiftCard({
  theme,
  g,
  to,
  from,
  message,
  compact,
  testID,
}: {
  theme: string;
  g: number;
  to?: string;
  from?: string;
  message?: string;
  compact?: boolean;
  testID?: string;
}) {
  const t = themeOf(theme);
  const Icon = t.Icon;
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: t.bg, borderColor: t.accent }, compact && { padding: 14, minHeight: 0 }]}>
      <View style={[styles.glow, { backgroundColor: t.accent }]} />
      <View style={styles.top}>
        <Icon size={compact ? 18 : 22} color={t.accent} />
        <Text style={[styles.brand, { color: t.accent }]}>VAULTRA DIGIGOLD</Text>
      </View>
      <Text style={[styles.title, compact && { fontSize: 18 }]}>{t.title}</Text>
      {to ? <Text style={[styles.to, { color: t.accent }]}>Dear {to},</Text> : null}
      {message ? (
        <Text style={styles.msg} numberOfLines={compact ? 2 : 4}>
          “{message}”
        </Text>
      ) : null}
      <View style={styles.bottom}>
        <View style={[styles.coin, { borderColor: t.accent }]}>
          <Coins size={16} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.grams}>{grams(g)}</Text>
        <Text style={[styles.k, { color: t.accent }]}>24K · 99.9%</Text>
        <View style={{ flex: 1 }} />
        {from ? <Text style={[styles.from, { color: t.accent }]}>— {from}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1.5, padding: 20, overflow: "hidden", minHeight: 200 },
  glow: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -60, top: -60, opacity: 0.18 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -0.8, color: colors.onSurfaceInverse, marginTop: 12 },
  to: { fontFamily: fonts.semibold, fontSize: 14, marginTop: 8 },
  msg: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.onSurfaceInverse, marginTop: 4, opacity: 0.92 },
  bottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  coin: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  grams: { fontFamily: fonts.black, fontSize: 20, color: colors.onSurfaceInverse, letterSpacing: -0.5 },
  k: { fontFamily: fonts.semibold, fontSize: 11 },
  from: { fontFamily: fonts.semibold, fontSize: 13, maxWidth: 120 },
});
