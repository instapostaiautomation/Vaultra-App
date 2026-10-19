import { useRouter } from "expo-router";
import { Coins, Timer } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { PaymentSheet } from "@/src/components/PaymentSheet";
import { useToast } from "@/src/components/Toast";
import { grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

const QUICK = [500, 1000, 2000, 5000];
const LOCK_SECONDS = 5 * 60;

export function BuyWidget() {
  const router = useRouter();
  const toast = useToast();
  const { price, token, tenant } = useApp();
  const [mode, setMode] = useState<"rupees" | "grams">("rupees");
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [val, setVal] = useState("2000");
  const [quote, setQuote] = useState<any>(null);
  const [secs, setSecs] = useState(0);
  const iv = useRef<ReturnType<typeof setInterval>>();
  const [payTarget, setPayTarget] = useState<any>(null);

  const liveRate = metal === "gold" ? price?.buy ?? 0 : price?.silver?.buy ?? 0;

  const lock = useCallback(async () => {
    try {
      const q = await api(metal === "gold" ? "/quote" : "/quote/silver", { method: "POST", body: { tenant }, auth: "none" });
      setQuote(q);
      setSecs(q.lock_seconds || LOCK_SECONDS);
    } catch {
      toast("error", "Quote failed");
    }
  }, [metal, tenant, toast]);

  useEffect(() => {
    lock();
  }, [lock]);

  useEffect(() => {
    clearInterval(iv.current);
    if (secs <= 0) return;
    iv.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(iv.current);
          lock();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv.current);
  }, [secs, lock]);

  const rate = quote?.buy ?? liveRate;
  const n = parseFloat(val) || 0;
  const g = mode === "rupees" ? (rate ? n / rate : 0) : n;
  const amt = mode === "rupees" ? n : n * rate;
  const gst = amt * 0.03;
  const total = amt + gst;
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const metalLabel = metal === "gold" ? "24K Gold" : "Silver";

  return (
    <View style={styles.root} testID="buy-widget">
      <View style={styles.head}>
        <View>
          <Text style={styles.headLabel}>LIVE {metal === "gold" ? "24K" : "SILVER"} BUY RATE</Text>
          <Text style={styles.headRate} testID="buy-rate">{inr(rate)}<Text style={styles.perG}>/g</Text></Text>
          <Text style={styles.gstNote}>Price locked for 5 minutes · excl. 3% GST</Text>
        </View>
        <View style={styles.timerBox}>
          <Timer size={14} color={colors.onBrandTertiary} />
          <Text style={styles.timerText}>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</Text>
        </View>
      </View>

      {/* Metal Toggle */}
      <View style={styles.toggleRow} testID="metal-toggle">
        <Pressable style={[styles.toggleBtn, metal === "gold" && styles.toggleActive]} onPress={() => setMetal("gold")} testID="toggle-gold">
          <Coins size={14} color={metal === "gold" ? colors.onBrandPrimary : colors.muted} />
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
          <Text style={styles.modeLabel}>⚖</Text>
          <Text style={[styles.modeText, mode === "grams" && styles.modeActiveText]}>Buy in Grams (g)</Text>
        </Pressable>
      </View>

      {/* Input */}
      <View style={styles.inputRow}>
        <Text style={styles.rupeeSign}>{mode === "rupees" ? "₹" : "g"}</Text>
        <TextInput testID="buy-input" value={val} onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" style={styles.input} />
        <View style={styles.equiv}>
          <Text style={styles.eqLabel}>{mode === "rupees" ? "You get" : "You pay"}</Text>
          <Text style={styles.eqVal} testID="buy-equivalent">{mode === "rupees" ? grams(g) : inr(amt)}</Text>
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
      <View style={styles.breakdown}>
        <View style={styles.row}><Text style={styles.bk}>Base Price ({grams(g)})</Text><Text style={styles.bkr}>{inr(amt)}</Text></View>
        <View style={styles.row}><Text style={styles.bk}>GST (3%)</Text><Text style={styles.bkr}>{inr(gst)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.total}>Total Payable</Text><Text style={styles.totalR}>{inr(total)}</Text></View>
      </View>

      {/* CTA */}
      <Pressable
        testID="buy-proceed-button"
        onPress={() => {
          if (!token) { router.push("/login"); return; }
          if (n <= 0 || !quote) { toast("info", "Enter an amount first"); return; }
          setPayTarget({ quote, mode, value: n, grams: g, amount: amt, gst, total, metal });
        }}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.ctaText} testID="buy-proceed-text">Proceed to Buy {metalLabel}  →</Text>
      </Pressable>

      <PaymentSheet target={payTarget} onClose={() => setPayTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brandPrimary, backgroundColor: colors.surface, overflow: "hidden" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, gap: 8 },
  headLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 0.5 },
  headRate: { fontFamily: fonts.black, fontSize: 28, color: colors.onSurface, letterSpacing: -1, marginTop: 4 },
  perG: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  gstNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  timerBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  timerText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onBrandTertiary },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  input: { flex: 1, fontFamily: fonts.black, fontSize: 28, color: colors.onSurface, letterSpacing: -0.4 },
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
});
