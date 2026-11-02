import { useRouter } from "expo-router";
import { Coins, Scale, Check } from "lucide-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet } from "@/src/components/ui";
import { grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

const QUICK = [500, 1000, 2000, 5000];

export function BuyWidget() {
  const router = useRouter();
  const toast = useToast();
  const { price, token, tenant, refresh } = useApp();
  const [mode, setMode] = useState<"rupees" | "grams">("rupees");
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [val, setVal] = useState("2000");
  const [quote, setQuote] = useState<any>(null);
  const [showPay, setShowPay] = useState(false);
  const [payStage, setPayStage] = useState<"select" | "processing" | "success">("select");
  const [lastTxn, setLastTxn] = useState<any>(null);

  const liveRate = price?.has_live === false ? 0 : metal === "gold" ? price?.buy ?? 0 : price?.silver?.buy ?? 0;
  const paused = !!price?.offline || price?.booking_enabled === false || !!price?.rates_hidden;

  // Screen always shows the live rate; the price is locked on the server only when the customer taps Proceed
  const rate = showPay && quote ? quote.buy : liveRate;
  const n = parseFloat(val) || 0;
  // GST-inclusive: customer pays exactly the amount; 3% GST is taken out of the grams
  const total = mode === "rupees" ? n : n * rate;
  const amt = total * 0.97;
  const g = rate ? Math.floor((amt / rate) * 10000) / 10000 : 0;
  const minInv = price?.min_investment ?? 500;
  const metalLabel = metal === "gold" ? "24K Gold" : "Silver";

  const proceedToBuy = async () => {
    if (!token) { router.push("/login"); return; }
    if (n <= 0 || !liveRate) { toast("info", "Enter an amount first"); return; }
    if (total < minInv) { toast("info", `Minimum investment is ₹${minInv.toLocaleString("en-IN")}`); return; }
    // Freeze a fresh price at the moment the customer taps Proceed (2 minutes)
    try {
      const q = await api(metal === "gold" ? "/quote" : "/quote/silver", { method: "POST", body: { tenant }, auth: "none" });
      setQuote(q);
    } catch (e: any) {
      toast("error", e?.message || "Could not get the price. Please retry");
      return;
    }
    setShowPay(true);
    setPayStage("select");
  };

  const confirmPurchase = async () => {
    setPayStage("processing");
    try {
      const endpoint = metal === "gold" ? "/orders/buy" : "/orders/buy-silver";
      const order = await api(endpoint, {
        method: "POST",
        body: { quote_id: quote.id, mode, value: n, method: "upi" },
      });
      const r = await api(`/orders/${order.id}/mock-confirm`, { method: "POST", body: { method: "upi", success: true } });
      setLastTxn(r.transaction || order);
      setPayStage("success");
      await refresh();
    } catch (e: any) {
      toast("error", "Purchase failed", e.message);
      setShowPay(false);
      setPayStage("select");
    }
  };

  return (
    <View style={styles.root} testID="buy-widget">
      <View style={styles.head}>
        <View>
          <Text style={styles.headLabel}>{price?.offline ? (liveRate > 0 ? "LAST" : "") : paused ? "" : "LIVE"} {metal === "gold" ? "24K" : "SILVER"} BUY RATE</Text>
          <Text style={styles.headRate} testID="buy-rate">{rate > 0 ? inr(rate) : "—"}<Text style={styles.perG}>/g</Text></Text>
          <Text style={styles.gstNote}>{price?.offline ? (rate > 0 ? "Showing last live rate" : "Waiting for live rates") : paused ? "Booking is paused by the store" : "GST included"}</Text>
        </View>
      </View>

      {/* Metal Toggle */}
      <View style={styles.toggleRow} testID="metal-toggle">
        <Pressable style={[styles.toggleBtn, metal === "gold" && styles.toggleActive]} onPress={() => setMetal("gold")} testID="toggle-gold">
          <Coins size={14} color={metal === "gold" ? colors.brandSecondary : colors.muted} />
          <Text style={[styles.toggleText, metal === "gold" && styles.toggleActiveText]}>Gold (24K)</Text>
        </Pressable>
        <Pressable style={[styles.toggleBtn, metal === "silver" && styles.toggleSilverActive]} onPress={() => setMetal("silver")} testID="toggle-silver">
          <Coins size={14} color={metal === "silver" ? "#374151" : colors.muted} />
          <Text style={[styles.toggleText, metal === "silver" && { color: "#374151", fontFamily: fonts.bold }]}>Silver</Text>
        </Pressable>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        <Pressable style={[styles.modeBtn, mode === "rupees" && styles.modeActive]} onPress={() => setMode("rupees")} testID="buy-mode-rupees">
          <Text style={styles.modeLabel}>₹</Text>
          <Text style={[styles.modeText, mode === "rupees" && styles.modeActiveText]}>Buy in Rupees (₹)</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === "grams" && styles.modeActive]} onPress={() => setMode("grams")} testID="buy-mode-grams">
          <Scale size={14} color={colors.onSurface} />
          <Text style={[styles.modeText, mode === "grams" && styles.modeActiveText]}>Buy in Grams (g)</Text>
        </Pressable>
      </View>

      {/* Input */}
      <View style={styles.inputRow}>
        <Text style={styles.rupeeSign}>{mode === "rupees" ? "₹" : "g"}</Text>
        <TextInput testID="buy-input" value={val} onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" style={styles.input} />
        <View style={styles.equiv}>
          <Text style={styles.eqLabel}>{mode === "rupees" ? "You get" : "You pay"}</Text>
          <Text style={styles.eqVal} testID="buy-equivalent">{mode === "rupees" ? grams(g) : inr(total)}</Text>
        </View>
      </View>

      {/* Quick amounts */}
      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q} onPress={() => { setMode("rupees"); setVal(String(q)); }} style={styles.chip} testID={`quick-${q}`}>
            <Text style={styles.chipText}>+₹{q.toLocaleString("en-IN")}</Text>
          </Pressable>
        ))}
      </View>

      {/* Breakdown */}
      {liveRate > 0 ? (
      <View style={styles.breakdown}>
        <View style={styles.row}><Text style={styles.bk}>You pay</Text><Text style={styles.bkr}>{inr(total)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.total}>You get</Text><Text style={styles.totalR} testID="buy-net-grams">{grams(g)}</Text></View>
      </View>
      ) : null}

      {/* CTA */}
      {paused ? (
        <View style={styles.pausedBox} testID="rates-paused-notice">
          <Text style={styles.pausedTitle}>{price?.rates_hidden ? "Rates not available" : price?.booking_enabled === false ? "Booking turned off" : "Live rates paused"}</Text>
          <Text style={styles.pausedSub}>{price?.booking_enabled === false || price?.rates_hidden ? "The store has paused new bookings for now. Please check back later." : "Buying will resume automatically as soon as live rates are back."}</Text>
        </View>
      ) : null}
      <Pressable testID="buy-proceed-button" disabled={paused} onPress={proceedToBuy} style={({ pressed }) => [styles.cta, paused && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
        <Text style={styles.ctaText} testID="buy-proceed-text">{price?.offline ? "Rates paused" : paused ? "Booking paused" : `Proceed to Buy ${metalLabel}  →`}</Text>
      </Pressable>

      {/* Payment Sheet - Inline */}
      <Sheet visible={showPay} onClose={payStage === "processing" ? () => {} : () => { setShowPay(false); setPayStage("select"); }} title={payStage === "success" ? undefined : "Confirm Purchase"} testID="buy-payment-sheet">
        {payStage === "select" ? (
          <View>
            <View style={styles.payBox}>
              <Text style={styles.payLabel}>You are buying</Text>
              <Text style={styles.payGrams}>{grams(g)} of {metalLabel}</Text>
              <Text style={styles.payRate}>@ {inr(rate)}/g</Text>
            </View>
            <Row label="You pay" value={inr(total)} />
            <Row label={`${metalLabel} credited`} value={grams(g)} bold />
            <Text style={styles.payNote}>Price includes GST · Paid via UPI · {metalLabel} is credited to your vault instantly</Text>
            <Button testID="confirm-buy-button" title={`Pay ${inr(total)} & Buy ${metalLabel}`} size="lg" onPress={confirmPurchase} style={{ marginTop: 16 }} />
          </View>
        ) : payStage === "processing" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.procTitle}>Processing purchase…</Text>
            <Text style={styles.procSub}>Please don&apos;t close this screen</Text>
          </View>
        ) : lastTxn ? (
          <View style={styles.center}>
            <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
              <Check size={34} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
            <Text style={styles.procTitle}>{metalLabel} added to your vault!</Text>
            <Text style={styles.successGrams}>+{grams(lastTxn.grams)}</Text>
            <View style={{ alignSelf: "stretch", marginTop: 16 }}>
              <Row label="Rate" value={`${inr(lastTxn.rate ?? rate)}/g`} />
              <Row label="Total paid" value={inr(lastTxn.total)} bold />
            </View>
            <Button testID="buy-done-button" title="Done" variant="dark" onPress={() => { setShowPay(false); setPayStage("select"); }} style={{ alignSelf: "stretch", marginTop: 16 }} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pausedBox: { backgroundColor: colors.errorTint, borderRadius: 12, padding: 12, marginTop: 12 },
  pausedTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  pausedSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurface, marginTop: 2 },

  root: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brandPrimary, backgroundColor: colors.surface, overflow: "hidden" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, gap: 8 },
  headLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  headRate: { fontFamily: fonts.black, fontSize: 28, color: colors.onSurface, letterSpacing: -1, marginTop: 4 },
  perG: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  gstNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggleActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  toggleSilverActive: { borderColor: "#9CA3AF", backgroundColor: "#E8E8E8" },
  toggleText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  toggleActiveText: { color: colors.brandSecondary, fontFamily: fonts.bold },
  modeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modeActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  modeLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.onSurface },
  modeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  modeActiveText: { color: colors.brandSecondary, fontFamily: fonts.bold },
  inputRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary, height: 60, paddingHorizontal: 14 },
  rupeeSign: { fontFamily: fonts.bold, fontSize: 22, color: colors.brandSecondary, marginRight: 6 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.black, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
  equiv: { alignItems: "flex-end" },
  eqLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  eqVal: { fontFamily: fonts.bold, fontSize: 16, color: colors.brandSecondary, letterSpacing: -0.3 },
  quickRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  chip: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandSecondary },
  breakdown: { marginHorizontal: 16, marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bk: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  bkr: { fontFamily: fonts.medium, fontSize: 13, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  total: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface },
  totalR: { fontFamily: fonts.black, fontSize: 18, color: colors.onSurface, letterSpacing: -0.4 },
  cta: { marginHorizontal: 16, marginVertical: 16, height: 56, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.black, fontSize: 17, color: colors.onBrandPrimary, letterSpacing: -0.2 },
  payBox: { backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: 16, marginBottom: 16, alignItems: "center" },
  payLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  payGrams: { fontFamily: fonts.black, fontSize: 26, color: colors.onBrandTertiary, letterSpacing: -0.5, marginTop: 4 },
  payRate: { fontFamily: fonts.medium, fontSize: 13, color: colors.onBrandTertiary },
  payNote: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 12 },
  center: { alignItems: "center", paddingVertical: 24 },
  procTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginTop: 16 },
  procSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  successGrams: { fontFamily: fonts.black, fontSize: 34, color: colors.brandSecondary, letterSpacing: -1, marginTop: 4 },
});
