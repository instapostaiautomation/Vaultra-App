import { CheckCircle2, CreditCard, Landmark, ShieldCheck, Smartphone } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { api } from "@/src/api";
import { Button, Row, Sheet } from "@/src/components/ui";
import { grams, inr } from "@/src/format";
import { colors, fonts, radius } from "@/src/theme";

export type Order = { id: string; grams: number; rate: number; amount: number; gst: number; total: number; tenant: string };

const METHODS = [
  { id: "upi", label: "UPI", sub: "GPay · PhonePe · Paytm", Icon: Smartphone },
  { id: "card", label: "Card", sub: "Visa · Mastercard · RuPay", Icon: CreditCard },
  { id: "netbanking", label: "Netbanking", sub: "All major Indian banks", Icon: Landmark },
];

export function PaymentSheet({ order, onClose, onPaid }: { order: Order | null; onClose: () => void; onPaid: (txn: any) => void }) {
  const [method, setMethod] = useState("upi");
  const [stage, setStage] = useState<"select" | "processing" | "success" | "failed">("select");
  const [txn, setTxn] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (order) {
      setStage("select");
      setTxn(null);
      setErr("");
    }
  }, [order]);

  const pay = async () => {
    if (!order) return;
    setStage("processing");
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const r = await api(`/orders/${order.id}/mock-confirm`, { method: "POST", body: { method, success: true } });
      setTxn(r.transaction);
      setStage("success");
      onPaid(r.transaction);
    } catch (e: any) {
      setErr(e.message);
      setStage("failed");
    }
  };

  return (
    <Sheet visible={!!order} onClose={stage === "processing" ? () => {} : onClose} title={stage === "success" ? undefined : "Secure Checkout"} testID="payment-sheet">
      {order && stage === "select" ? (
        <View>
          <View style={styles.gateway}>
            <ShieldCheck size={18} color={colors.success} />
            <Text style={styles.gatewayText}>Razorpay Secure · Test Mode</Text>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount payable</Text>
            <Text style={styles.amount} testID="payment-total">{inr(order.total)}</Text>
            <Text style={styles.amountSub}>{grams(order.grams)} of 24K gold @ {inr(order.rate)}/g</Text>
          </View>
          {METHODS.map(({ id, label, sub, Icon }) => (
            <Pressable
              key={id}
              testID={`payment-method-${id}`}
              onPress={() => setMethod(id)}
              style={[styles.method, method === id && styles.methodOn]}
            >
              <View style={styles.methodIcon}>
                <Icon size={18} color={colors.onSurface} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.methodLabel}>{label}</Text>
                <Text style={styles.methodSub}>{sub}</Text>
              </View>
              <View style={[styles.radio, method === id && styles.radioOn]}>{method === id ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          ))}
          <Button testID="payment-pay-button" title={`Pay ${inr(order.total)}`} size="lg" onPress={pay} style={{ marginTop: 8 }} />
          <Text style={styles.foot}>Live gateway activates once Razorpay keys are added. This test payment completes instantly.</Text>
        </View>
      ) : null}
      {stage === "processing" ? (
        <View style={styles.center} testID="payment-processing">
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.procTitle}>Processing payment…</Text>
          <Text style={styles.procSub}>Please don&apos;t close this screen</Text>
        </View>
      ) : null}
      {stage === "success" && txn ? (
        <View style={styles.center} testID="payment-success">
          <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
            <CheckCircle2 size={44} color={colors.onSuccess} />
          </Animated.View>
          <Text style={styles.procTitle}>Gold added to your vault</Text>
          <Text style={styles.successGrams} testID="payment-success-grams">+{grams(txn.grams)}</Text>
          <View style={{ alignSelf: "stretch", marginTop: 16 }}>
            <Row label="Invoice" value={txn.invoice_no} />
            <Row label="Gold value" value={inr(txn.amount)} />
            <Row label="GST (3%)" value={inr(txn.gst)} />
            <Row label="Total paid" value={inr(txn.total)} bold />
          </View>
          <Button testID="payment-done-button" title="Done" variant="dark" onPress={onClose} style={{ alignSelf: "stretch", marginTop: 16 }} />
        </View>
      ) : null}
      {stage === "failed" ? (
        <View style={styles.center} testID="payment-failed">
          <Text style={[styles.procTitle, { color: colors.error }]}>Payment failed</Text>
          <Text style={styles.procSub}>{err}</Text>
          <Button title="Close" variant="outline" onPress={onClose} style={{ alignSelf: "stretch", marginTop: 16 }} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  gateway: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  gatewayText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
  amountBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  amountLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  amount: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -1, color: colors.onSurface, marginTop: 4 },
  amountSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  method: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  methodOn: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  methodIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  methodLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  methodSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.brandSecondary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandSecondary },
  foot: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 12, marginBottom: 8 },
  center: { alignItems: "center", paddingVertical: 24 },
  procTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginTop: 16, letterSpacing: -0.4 },
  procSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  successGrams: { fontFamily: fonts.black, fontSize: 34, color: colors.brandSecondary, letterSpacing: -1, marginTop: 4 },
});
