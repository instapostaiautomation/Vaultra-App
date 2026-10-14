import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Bell, BellRing, Trash2, TrendingDown, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button, Sheet } from "@/src/components/ui";
import { dateTime, inr, TENANT_NAME } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

/** Banner shown on Home when 24K has dropped below one of the user's targets. */
export function PriceAlertBanner() {
  const { alerts, price, reloadAlerts } = useApp();
  const router = useRouter();
  const hit = alerts.find((a) => a.status === "triggered");

  useEffect(() => {
    if (hit && Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [hit?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hit) return null;
  const dismiss = async () => {
    await api(`/alerts/${hit.id}`, { method: "DELETE" }).catch(() => {});
    reloadAlerts();
  };
  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} exiting={FadeOutUp} style={styles.banner} testID="price-alert-banner">
      <View style={styles.bIcon}>
        <TrendingDown size={20} color={colors.onSuccess} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bTitle} testID="price-alert-banner-title">
          24K dropped below {inr(hit.target)}
        </Text>
        <Text style={styles.bSub}>
          Now {inr(price?.buy ?? hit.triggered_price ?? 0)}/g · {TENANT_NAME[hit.tenant]}
        </Text>
        <Pressable onPress={() => router.push("/")} style={styles.bCta} testID="price-alert-banner-buy">
          <Text style={styles.bCtaText}>Buy the dip ↓</Text>
        </Pressable>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} style={styles.bClose} testID="price-alert-banner-dismiss">
        <X size={18} color={colors.success} />
      </Pressable>
    </Animated.View>
  );
}

/** Home entry card that opens the alert sheet. */
export function PriceAlertCard() {
  const { alerts, token } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = alerts.filter((a) => a.status === "active");
  return (
    <>
      <Pressable onPress={() => (token ? setOpen(true) : router.push("/login"))} style={styles.card} testID="price-alert-card">
        <View style={styles.cIcon}>
          <BellRing size={20} color={colors.brandSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cTitle}>Price Alerts</Text>
          <Text style={styles.cSub} testID="price-alert-card-sub">
            {active.length ? `${active.length} active · lowest ${inr(Math.min(...active.map((a) => a.target)))}` : "Get notified when 24K drops below your target"}
          </Text>
        </View>
        <View style={styles.cBtn}>
          <Text style={styles.cBtnText}>{active.length ? "Manage" : "Set"}</Text>
        </View>
      </Pressable>
      <PriceAlertSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function PriceAlertSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { price, tenant, alerts, reloadAlerts } = useApp();
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const cur = price?.buy ?? 0;

  useEffect(() => {
    if (visible && cur) setTarget(String(Math.floor(cur - 10)));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = parseFloat(target) || 0;
  const diff = cur ? ((v - cur) / cur) * 100 : 0;

  const create = async () => {
    setBusy(true);
    try {
      await api("/alerts", { method: "POST", body: { target: v, tenant } });
      await reloadAlerts();
      toast("success", "Price alert set", `We'll alert you when 24K drops below ${inr(v)}`);
    } catch (e: any) {
      toast("error", "Could not set alert", e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api(`/alerts/${id}`, { method: "DELETE" }).catch(() => {});
    reloadAlerts();
    toast("info", "Alert removed");
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="24K Price Alert" testID="price-alert-sheet">
      <Text style={styles.sub}>
        Live {inr(cur)}/g · {TENANT_NAME[tenant]}
      </Text>
      <View style={styles.inputWrap}>
        <Text style={styles.prefix}>₹</Text>
        <TextInput
          testID="price-alert-target-input"
          value={target}
          onChangeText={(t) => setTarget(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholder="Target price"
          placeholderTextColor={colors.mutedLight}
        />
        <Text style={[styles.diff, { color: diff <= 0 ? colors.success : colors.error }]}>
          {diff > 0 ? "+" : ""}
          {diff.toFixed(2)}%
        </Text>
      </View>
      <View style={styles.chips}>
        {[10, 25, 50, 100].map((d) => (
          <Pressable key={d} onPress={() => setTarget(String(Math.floor(cur - d)))} style={styles.chip} testID={`price-alert-chip-${d}`}>
            <Text style={styles.chipText}>−₹{d}</Text>
          </Pressable>
        ))}
      </View>
      {v >= cur && cur ? <Text style={styles.warn}>Target is above the live rate, so it will trigger right away.</Text> : null}
      <Button title="Set Alert" loading={busy} disabled={v < 1000} onPress={create} icon={<Bell size={18} color={colors.onBrandPrimary} />} testID="price-alert-create-button" />

      {alerts.length ? <Text style={styles.listTitle}>Your alerts</Text> : null}
      {alerts.map((a) => (
        <View key={a.id} style={styles.row} testID={`price-alert-row-${a.id}`}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTarget}>Below {inr(a.target)}</Text>
            <Text style={styles.rowSub}>
              {a.status === "triggered" ? `Triggered at ${inr(a.triggered_price ?? 0)} · ${dateTime(a.triggered_at ?? "")}` : `Watching · ${TENANT_NAME[a.tenant]}`}
            </Text>
          </View>
          <View style={[styles.pill, a.status === "triggered" ? { backgroundColor: colors.successTint } : { backgroundColor: colors.brandTertiary }]}>
            <Text style={[styles.pillText, { color: a.status === "triggered" ? colors.success : colors.onBrandTertiary }]}>{a.status === "triggered" ? "Hit" : "Active"}</Text>
          </View>
          <Pressable onPress={() => remove(a.id)} style={styles.trash} testID={`price-alert-delete-${a.id}`}>
            <Trash2 size={16} color={colors.error} />
          </Pressable>
        </View>
      ))}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 12, marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.successTint, borderWidth: 1, borderColor: "#BBF7D0" },
  bIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  bTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface, letterSpacing: -0.3 },
  bSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.success, marginTop: 2 },
  bCta: { alignSelf: "flex-start", marginTop: 8, backgroundColor: colors.success, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  bCtaText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSuccess },
  bClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  card: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface },
  cSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  cBtn: { height: 32, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceInverse, justifyContent: "center" },
  cBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurfaceInverse },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: 16, height: 60, marginTop: 12 },
  prefix: { fontFamily: fonts.bold, fontSize: 22, color: colors.brandSecondary, marginRight: 6 },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface, height: 56 },
  diff: { fontFamily: fonts.bold, fontSize: 13 },
  chips: { flexDirection: "row", gap: 8, marginVertical: 12 },
  chip: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "#F0E2B0", alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onBrandTertiary },
  warn: { fontFamily: fonts.medium, fontSize: 12, color: "#B45309", marginBottom: 12 },
  listTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface, marginTop: 20, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowTarget: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, height: 24, justifyContent: "center" },
  pillText: { fontFamily: fonts.semibold, fontSize: 11 },
  trash: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.errorTint },
});
