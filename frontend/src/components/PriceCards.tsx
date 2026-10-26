import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PulseDot } from "@/src/components/Header";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, cardShadow } from "@/src/theme";

export function PriceCards() {
  const { price } = useApp();
  const live = !!price?.live;
  const liveLabel = live ? "Live Rate" : "Indicative Rate";
  const goldUp = price?.direction !== "down";
  const silverUp = price?.silver?.direction !== "down";

  return (
    <View style={styles.row} testID="price-cards">
      {/* Gold Card */}
      <View style={[styles.card, styles.goldCard]}>
        <View style={styles.liveRow}>
          <PulseDot color={live ? "#EF4444" : colors.muted} size={7} />
          <Text style={styles.liveText} testID="gold-rate-source">{liveLabel}</Text>
        </View>
        <Text style={styles.metalName}>
          Gold <Text style={styles.metalPurity}>24K | 999</Text>
        </Text>
        <Text style={styles.price} testID="gold-price-card">
          {price ? `₹${price.buy.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}{" "}
          <Text style={styles.perGram}>/gm</Text>
        </Text>
        <Text style={[styles.change, { color: goldUp ? "#16A34A" : "#DC2626" }]}>
          {goldUp ? "▲" : "▼"} {Math.abs(price?.change_pct ?? 0).toFixed(2)}% Since yesterday
        </Text>
      </View>

      {/* Silver Card */}
      <View style={[styles.card, styles.silverCard]}>
        <View style={styles.liveRow}>
          <PulseDot color={live ? "#EF4444" : colors.muted} size={7} />
          <Text style={[styles.liveText, { color: "#6B7280" }]}>{liveLabel}</Text>
        </View>
        <Text style={[styles.metalName, { color: "#6B7280" }]}>
          Silver <Text style={[styles.metalPurity, { color: "#9CA3AF" }]}>24K | 999</Text>
        </Text>
        <Text style={[styles.price, { color: "#374151" }]} testID="silver-price-card">
          {price?.silver ? `₹${price.silver.buy.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}{" "}
          <Text style={[styles.perGram, { color: "#9CA3AF" }]}>/gm</Text>
        </Text>
        <Text style={[styles.change, { color: silverUp ? "#16A34A" : "#DC2626" }]}>
          {silverUp ? "▲" : "▼"} {Math.abs(price?.silver?.change_pct ?? 0).toFixed(2)}% Since yesterday
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },
  card: {
    flex: 1,
    borderRadius: radius.md,
    padding: 14,
    ...cardShadow,
  },
  goldCard: {
    backgroundColor: "#F5E6A3",
    borderWidth: 1,
    borderColor: "#E8D68A",
  },
  silverCard: {
    backgroundColor: "#E8E8E8",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end" },
  liveText: { fontFamily: fonts.medium, fontSize: 10, color: "#92400E" },
  metalName: { fontFamily: fonts.bold, fontSize: 18, color: "#92400E", marginTop: 4 },
  metalPurity: { fontFamily: fonts.regular, fontSize: 12, color: "#B8860B" },
  price: { fontFamily: fonts.black, fontSize: 20, color: "#111827", marginTop: 6, letterSpacing: -0.5 },
  perGram: { fontFamily: fonts.regular, fontSize: 13, color: "#6B7280" },
  change: { fontFamily: fonts.medium, fontSize: 11, marginTop: 8 },
});
