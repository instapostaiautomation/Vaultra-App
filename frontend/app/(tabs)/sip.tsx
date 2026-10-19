import { useRouter } from "expo-router";
import { CalendarClock, Pause, Play, Repeat, Trash2, Zap } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Sheet, StatusBadge } from "@/src/components/ui";
import { grams, inr, shortDate } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

const AMOUNTS = [100, 500, 1000, 2500, 5000];
const FREQS = ["daily", "weekly", "monthly"] as const;
const PER_YEAR = { daily: 365, weekly: 52, monthly: 12 };

export default function SipScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, tenant, price, refresh } = useApp();
  const [amount, setAmount] = useState(1000);
  const [freq, setFreq] = useState<(typeof FREQS)[number]>("monthly");
  const [sips, setSips] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const load = useCallback(async () => {
    if (!token) return setSips([]);
    try {
      setSips(await api("/sips"));
    } catch {}
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const yearly = amount * PER_YEAR[freq];
  const yearlyGrams = price ? yearly / price.buy : 0;

  const start = async () => {
    if (!token) return router.push("/login");
    setBusy(true);
    try {
      await api("/sips", { method: "POST", body: { amount, frequency: freq, tenant } });
      toast("success", "Auto SIP activated", `${inr(amount, 0)} ${freq} via UPI AutoPay`);
      load();
    } catch (e: any) {
      toast("error", "Could not start SIP", e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, method: string, msg: string) => {
    try {
      const r = await api(path, { method });
      toast("success", msg, r?.grams ? `+${grams(r.grams)} added to vault` : undefined);
      load();
      refresh();
    } catch (e: any) {
      toast("error", "Action failed", e.message);
    }
  };

  return (
    <View style={styles.root} testID="sip-screen">
      <ScreenHeader title="Auto SIP" subtitle="Build your gold savings on autopilot" showBack />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomChrome + 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Card testID="sip-create-card">
          <Text style={styles.label}>Installment amount</Text>
          <Text style={styles.big} testID="sip-amount">{inr(amount, 0)}</Text>
          <View style={styles.wrapRow}>
            {AMOUNTS.map((a) => (
              <Pressable key={a} onPress={() => setAmount(a)} style={[styles.amt, amount === a && styles.amtOn]} testID={`sip-amount-${a}`}>
                <Text style={[styles.amtText, amount === a && { color: colors.onSurfaceInverse }]}>₹{a.toLocaleString("en-IN")}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Frequency</Text>
          <View style={styles.seg}>
            {FREQS.map((f) => (
              <Pressable key={f} onPress={() => setFreq(f)} style={[styles.segBtn, freq === f && styles.segOn]} testID={`sip-freq-${f}`}>
                <Text style={[styles.segText, freq === f && { color: colors.onSurface }]}>{f[0].toUpperCase() + f.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.proj}>
            <CalendarClock size={18} color={colors.onBrandTertiary} />
            <Text style={styles.projText}>
              In 1 year you&apos;ll save {inr(yearly, 0)} ≈ <Text style={{ fontFamily: fonts.bold }}>{grams(yearlyGrams, 3)}</Text> of 24K gold
            </Text>
          </View>
          <Button title={token ? "Start Auto SIP" : "Sign in to start SIP"} loading={busy} onPress={start} icon={<Zap size={18} color={colors.onBrandPrimary} />} testID="sip-start-button" />
        </Card>

        <Text style={styles.section}>Your SIPs</Text>
        {sips.length === 0 ? (
          <View style={styles.empty} testID="sip-empty">
            <Repeat size={28} color={colors.mutedLight} />
            <Text style={styles.emptyText}>{token ? "No active SIPs yet. Start one above." : "Sign in to see your SIPs."}</Text>
          </View>
        ) : (
          sips.map((s) => (
            <Card key={s.id} testID={`sip-card-${s.id}`}>
              <View style={styles.sipHead}>
                <View>
                  <Text style={styles.sipAmt}>
                    {inr(s.amount, 0)} <Text style={styles.sipFreq}>/ {s.frequency}</Text>
                  </Text>
                  <Text style={styles.sipMeta}>
                    {s.installments} installments · {grams(s.grams_accumulated)} saved
                  </Text>
                </View>
                <StatusBadge status={s.status} testID={`sip-status-${s.id}`} />
              </View>
              <Text style={styles.sipMeta}>Next debit {shortDate(s.next_run)} · {s.mandate}</Text>
              <View style={styles.sipActions}>
                <Button
                  size="sm"
                  variant="gold"
                  title="Pay now"
                  disabled={s.status !== "active"}
                  onPress={() => act(`/sips/${s.id}/run`, "POST", "SIP installment paid")}
                  style={{ flex: 1 }}
                  testID={`sip-run-${s.id}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  title={s.status === "active" ? "Pause" : "Resume"}
                  icon={s.status === "active" ? <Pause size={14} color={colors.onSurface} /> : <Play size={14} color={colors.onSurface} />}
                  onPress={() => act(`/sips/${s.id}/toggle`, "POST", s.status === "active" ? "SIP paused" : "SIP resumed")}
                  style={{ flex: 1 }}
                  testID={`sip-toggle-${s.id}`}
                />
                <Pressable onPress={() => setCancelId(s.id)} style={styles.trash} testID={`sip-cancel-${s.id}`}>
                  <Trash2 size={18} color={colors.error} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </KeyboardAwareScrollView>
      <Sheet visible={!!cancelId} onClose={() => setCancelId(null)} title="Cancel this SIP?" testID="sip-cancel-sheet">
        <Text style={styles.emptyText}>Your accumulated gold stays safe in your vault. The UPI AutoPay mandate will be revoked.</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 8 }}>
          <Button title="Keep SIP" variant="outline" onPress={() => setCancelId(null)} style={{ flex: 1 }} testID="sip-cancel-keep" />
          <Button
            title="Cancel SIP"
            variant="danger"
            style={{ flex: 1 }}
            testID="sip-cancel-confirm"
            onPress={() => {
              const id = cancelId;
              setCancelId(null);
              act(`/sips/${id}`, "DELETE", "SIP cancelled");
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.3 },
  big: { fontFamily: fonts.black, fontSize: 34, letterSpacing: -1.2, color: colors.onSurface, marginTop: 4 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  amt: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  amtOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  amtText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary },
  seg: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, marginTop: 8 },
  segBtn: { flex: 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  proj: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: 12, marginVertical: 16 },
  projText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.onBrandTertiary },
  section: { fontFamily: fonts.black, fontSize: 20, letterSpacing: -0.6, color: colors.onSurface, marginTop: 8 },
  empty: { alignItems: "center", gap: 8, padding: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
  sipHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  sipAmt: { fontFamily: fonts.black, fontSize: 20, color: colors.onSurface, letterSpacing: -0.5 },
  sipFreq: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  sipMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  sipActions: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  trash: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.errorTint, alignItems: "center", justifyContent: "center" },
});
