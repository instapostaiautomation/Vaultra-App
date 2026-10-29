import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PulseDot } from "@/src/components/Header";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, cardShadow } from "@/src/theme";

export function PriceCards() {
  const { price } = useApp();
  const live = !!price?.live;
  const paused = !!price?.offline;
  const liveLabel = live ? "Live Rate" : paused ? "Rates Paused" : "Indicative Rate";
  const goldUp = (price?.change_pct ?? 0) >= 0;
  const silverUp = (price?.silver?.change_pct ?? 0) >= 0;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.row} testID="price-cards">
      {/* Gold Card */}
      <LinearGradient colors={[colors.surfaceInverse, colors.inkSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderColor: colors.goldHairline }]}>
        <View style={[styles.sheen, { backgroundColor: colors.brandPrimary }]} />
        <View style={styles.liveRow}>
          <PulseDot color={live ? colors.success : colors.mutedLight} size={7} />
          <Text style={[styles.liveText, { color: colors.goldSheen }]} testID="gold-rate-source">{liveLabel}</Text>
        </View>
        <Text style={[styles.metalName, { color: colors.brandPrimary }]}>
          Gold <Text style={[styles.metalPurity, { color: colors.goldSheen }]}>24K · 999</Text>
        </Text>
        <Text style={styles.price} testID="gold-price-card" numberOfLines={1} adjustsFontSizeToFit>
          {price && price.has_live !== false ? fmt(price.buy) : "—"}
          <Text style={styles.perGram}> /gm</Text>
        </Text>
        <Text style={[styles.change, { color: goldUp ? colors.success : colors.error }]}>
          {paused ? <Text style={styles.since}>Resumes when feed is back</Text> : <>{goldUp ? "▲" : "▼"} {Math.abs(price?.change_pct ?? 0).toFixed(2)}% <Text style={styles.since}>since yesterday</Text></>}
        </Text>
      </LinearGradient>

      {/* Silver Card */}
      <LinearGradient colors={[colors.surfaceInverse, colors.inkSoft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { borderColor: "rgba(229,231,235,0.25)" }]}>
        <View style={[styles.sheen, { backgroundColor: colors.silverTone }]} />
        <View style={styles.liveRow}>
          <PulseDot color={live ? colors.success : colors.mutedLight} size={7} />
          <Text style={[styles.liveText, { color: colors.mutedLight }]}>{liveLabel}</Text>
        </View>
        <Text style={[styles.metalName, { color: colors.silverTone }]}>
          Silver <Text style={[styles.metalPurity, { color: colors.mutedLight }]}>999 Fine</Text>
        </Text>
        <Text style={styles.price} testID="silver-price-card" numberOfLines={1} adjustsFontSizeToFit>
          {price?.silver && price.has_live !== false ? fmt(price.silver.buy) : "—"}
          <Text style={styles.perGram}> /gm</Text>
        </Text>
        <Text style={[styles.change, { color: silverUp ? colors.success : colors.error }]}>
          {paused ? <Text style={styles.since}>Resumes when feed is back</Text> : <>{silverUp ? "▲" : "▼"} {Math.abs(price?.silver?.change_pct ?? 0).toFixed(2)}% <Text style={styles.since}>since yesterday</Text></>}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    ...cardShadow,
  },
  sheen: { position: "absolute", right: -40, top: -40, width: 110, height: 110, borderRadius: 55, opacity: 0.12 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
  metalName: { fontFamily: fonts.bold, fontSize: 17, marginTop: 10, letterSpacing: -0.2 },
  metalPurity: { fontFamily: fonts.regular, fontSize: 11 },
  price: { fontFamily: fonts.bold, fontSize: 20, color: colors.onSurfaceInverse, marginTop: 6, letterSpacing: -0.5 },
  perGram: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedLight },
  change: { fontFamily: fonts.semibold, fontSize: 11, marginTop: 8 },
  since: { fontFamily: fonts.regular, color: colors.mutedLight },
});
