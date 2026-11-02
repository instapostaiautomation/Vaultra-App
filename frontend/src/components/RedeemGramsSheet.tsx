import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { Button, Sheet } from "@/src/components/ui";
import { useToast } from "@/src/components/Toast";
import { grams as fmtGrams } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts } from "@/src/theme";

/** Customer asks the store to redeem vault grams (min 1g); the shop accepts or declines in the Shop Panel. */
export function RedeemGramsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { vault, refresh } = useApp();
  const toast = useToast();
  const [val, setVal] = useState("1");
  const [form, setForm] = useState<"coin" | "bar">("coin");
  const [busy, setBusy] = useState(false);
  const bal = vault?.user.gold_grams ?? 0;
  const g = parseFloat(val) || 0;
  const err = g < 1 ? "Minimum 1 gram" : g > bal ? `You have only ${fmtGrams(bal)}` : "";

  const submit = async () => {
    if (err) return;
    setBusy(true);
    try {
      await api("/redeem-requests", { method: "POST", body: { grams: g, form } });
      toast("success", "Request sent to the store. You'll be notified once they accept.");
      refresh();
      onClose();
    } catch (e: any) {
      toast("error", e?.message || "Could not send request");
    }
    setBusy(false);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Redeem gold from vault" testID="redeem-grams-sheet">
      <Text style={styles.sub}>Available: {fmtGrams(bal)} · Minimum 1 gram</Text>
      <View style={styles.forms}>
        {(["coin", "bar"] as const).map((f) => (
          <Pressable key={f} onPress={() => setForm(f)} style={[styles.form, form === f && styles.formOn]} testID={`redeem-form-${f}`}>
            <Text style={[styles.formText, form === f && styles.formTextOn]}>{f === "coin" ? "Gold Coin" : "Gold Bar"}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput value={val} onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" style={styles.input} testID="redeem-grams-input" />
        <Text style={styles.unit}>grams</Text>
      </View>
      {err ? <Text style={styles.err} testID="redeem-grams-error">{err}</Text> : null}
      <Button title="Send redeem request" onPress={submit} loading={busy} disabled={!!err} size="lg" style={{ marginTop: 16 }} testID="redeem-grams-submit" />
      <Text style={styles.note}>The store will confirm your request. Collect your gold at the store with your Wallet ID.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  forms: { flexDirection: "row", gap: 8, marginTop: 14 },
  form: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.goldHairline, alignItems: "center", justifyContent: "center" },
  formOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  formText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  formTextOn: { color: colors.onBrandPrimary },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, borderWidth: 1, borderColor: colors.goldHairline, borderRadius: 14, paddingHorizontal: 16, minHeight: 56 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 24, color: colors.onSurface },
  unit: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  err: { fontFamily: fonts.medium, fontSize: 12, color: colors.error, marginTop: 6 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 12, textAlign: "center" },
});
