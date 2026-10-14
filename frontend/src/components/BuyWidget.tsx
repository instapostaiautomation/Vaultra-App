import { useRouter } from "expo-router";
import { ArrowRight, Clock, IndianRupee, Scale } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { Order, PaymentSheet } from "@/src/components/PaymentSheet";
import { useToast } from "@/src/components/Toast";
import { Button, Card } from "@/src/components/ui";
import { floor4, grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

type Quote = { id: string; buy: number; expires_at: string };

const RUPEE_CHIPS = [500, 1000, 2000, 5000, 10000];
const GRAM_CHIPS = [0.1, 0.5, 1, 2, 5];

export function BuyWidget() {
  const { tenant, token, refresh } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"rupees" | "grams">("rupees");
  const [value, setValue] = useState("2000");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [left, setLeft] = useState(300);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  const loadQuote = useCallback(async () => {
    try {
      const q = await api<Quote>(`/quote?tenant=${tenant}`, { method: "POST", auth: "none" });
      setQuote(q);
    } catch {
      setQuote(null);
    }
  }, [tenant]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(quote.expires_at).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) loadQuote();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quote, loadQuote]);

  const rate = quote?.buy ?? 0;
  const v = parseFloat(value) || 0;
  const base = mode === "rupees" ? v : Math.round(v * rate * 100) / 100;
  const g = mode === "rupees" ? (rate ? floor4(v / rate) : 0) : floor4(v);
  const gst = Math.round(base * 0.03 * 100) / 100;
  const total = Math.round((base + gst) * 100) / 100;

  const addChip = (n: number) => {
    const next = (parseFloat(value) || 0) + n;
    setValue(mode === "rupees" ? String(Math.round(next)) : String(Math.round(next * 10000) / 10000));
  };

  const switchMode = (m: "rupees" | "grams") => {
    if (m === mode) return;
    setMode(m);
    setValue(m === "rupees" ? "2000" : "1");
  };

  const proceed = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (base < 10) {
      toast("error", "Minimum purchase is ₹10");
      return;
    }
    setBusy(true);
    try {
      const o = await api<any>("/orders/buy", { method: "POST", body: { quote_id: quote?.id, mode, value: v } });
      if (o.provider === "razorpay" && o.checkout_url) {
        router.push({ pathname: "/checkout", params: { url: o.checkout_url, id: o.id } });
      } else {
        setOrder(o);
      }
    } catch (e: any) {
      if (e.status === 409) loadQuote();
      toast("error", "Could not start purchase", e.message);
    } finally {
      setBusy(false);
    }
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Card style={styles.card} testID="instant-buy-widget">
      <View style={styles.head}>
        <View>
          <Text style={styles.label}>Live 24K Buy Rate</Text>
          <Text style={styles.rate} testID="buy-rate">
            {rate ? inr(rate) : "—"}
            <Text style={styles.perG}>/g</Text>
          </Text>
        </View>
        <View style={[styles.lock, left < 60 && { backgroundColor: colors.errorTint }]} testID="price-lock-timer">
          <Clock size={14} color={left < 60 ? colors.error : colors.onBrandTertiary} />
          <Text style={[styles.lockText, left < 60 && { color: colors.error }]}>
            {mm}:{ss}
          </Text>
        </View>
      </View>
      <Text style={styles.lockHint}>Price locked for 5 minutes · excl. 3% GST</Text>

      <View style={styles.toggle}>
        {(["rupees", "grams"] as const).map((m) => (
          <Pressable key={m} testID={`buy-mode-${m}`} onPress={() => switchMode(m)} style={[styles.toggleBtn, mode === m && styles.toggleOn]}>
            {m === "rupees" ? (
              <IndianRupee size={14} color={mode === m ? colors.onSurfaceInverse : colors.muted} />
            ) : (
              <Scale size={14} color={mode === m ? colors.onSurfaceInverse : colors.muted} />
            )}
            <Text style={[styles.toggleText, mode === m && { color: colors.onSurfaceInverse }]}>{m === "rupees" ? "Buy in Rupees (₹)" : "Buy in Grams (g)"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputWrap}>
        <Text style={styles.prefix}>{mode === "rupees" ? "₹" : "g"}</Text>
        <TextInput
          testID="buy-amount-input"
          value={value}
          onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.mutedLight}
        />
        <View style={styles.convert}>
          <Text style={styles.convertLabel}>{mode === "rupees" ? "You get" : "Value"}</Text>
          <Text style={styles.convertValue} testID="buy-converted-value">
            {mode === "rupees" ? grams(g) : inr(base)}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 12, flexGrow: 0 }}>
        {(mode === "rupees" ? RUPEE_CHIPS : GRAM_CHIPS).map((c) => (
          <Pressable key={c} testID={`quick-chip-${c}`} onPress={() => addChip(c)} style={styles.qchip}>
            <Text style={styles.qchipText}>{mode === "rupees" ? `+₹${c.toLocaleString("en-IN")}` : `+${c}g`}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.summary}>
        <View style={styles.sRow}>
          <Text style={styles.sLabel}>Base Price ({grams(g)})</Text>
          <Text style={styles.sValue} testID="buy-base-price">{inr(base)}</Text>
        </View>
        <View style={styles.sRow}>
          <Text style={styles.sLabel}>GST (3%)</Text>
          <Text style={styles.sValue} testID="buy-gst">{inr(gst)}</Text>
        </View>
        <View style={[styles.sRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Payable</Text>
          <Text style={styles.totalValue} testID="buy-total">{inr(total)}</Text>
        </View>
      </View>

      <Button
        testID="proceed-to-buy-button"
        title="Proceed to Buy 24K Gold"
        size="lg"
        loading={busy}
        disabled={!quote || base <= 0}
        icon={<ArrowRight size={18} color={colors.onBrandPrimary} />}
        onPress={proceed}
        style={{ flexDirection: "row-reverse" }}
      />
      <PaymentSheet
        order={order}
        onClose={() => setOrder(null)}
        onPaid={(t) => {
          refresh();
          loadQuote();
          toast("success", "Purchase successful", `${grams(t.grams)} 24K gold added to your vault`);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 20, borderColor: "#EFE3BC" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, letterSpacing: 0.2, textTransform: "uppercase" },
  rate: { fontFamily: fonts.black, fontSize: 28, letterSpacing: -1, color: colors.onSurface, marginTop: 2 },
  perG: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  lock: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  lockText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onBrandTertiary, fontVariant: ["tabular-nums"] },
  lockHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, marginTop: 16, gap: 4 },
  toggleBtn: { flex: 1, height: 40, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  toggleOn: { backgroundColor: colors.surfaceInverse },
  toggleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    height: 64,
    marginTop: 12,
    backgroundColor: colors.surface,
  },
  prefix: { fontFamily: fonts.bold, fontSize: 22, color: colors.brandSecondary, marginRight: 6 },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.onSurface, letterSpacing: -0.6, height: 60, minWidth: 60 },
  convert: { alignItems: "flex-end" },
  convertLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  convertValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.onBrandTertiary },
  qchip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "#F0E2B0", justifyContent: "center", flexShrink: 0 },
  qchipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onBrandTertiary },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 12, marginTop: 16, marginBottom: 16 },
  sRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  sValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 10 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface },
  totalValue: { fontFamily: fonts.black, fontSize: 18, color: colors.onSurface, letterSpacing: -0.4 },
});
