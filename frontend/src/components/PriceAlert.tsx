import { Bell, BookOpen, Coins, Target, TrendingDown } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button, Sheet } from "@/src/components/ui";
import { inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

// ----- Banner on home when price drops -----
export function PriceAlertBanner() {
  const { price, tenantName } = useApp();
  const [hidden, setHidden] = useState(false);
  if (!price || (price.change_pct ?? 0) >= 0 || hidden) return null;
  return (
    <View style={styles.banner} testID="price-alert-banner">
      <View style={styles.bannerIcon}>
        <TrendingDown size={22} color={colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>24K dropped below ₹{(Math.ceil(price.buy / 5) * 5).toLocaleString()}</Text>
        <Text style={styles.bannerSub}>Now {inr(price.buy)}/g · {tenantName}</Text>
      </View>
      <Pressable onPress={() => setHidden(true)} hitSlop={12}>
        <Text style={{ fontSize: 18, color: colors.muted }}>×</Text>
      </Pressable>
    </View>
  );
}

// ----- Card for managing alerts -----
export function PriceAlertCard() {
  const { alerts, reloadAlerts, token, price, tenant } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [alertTab, setAlertTab] = useState<"only" | "book">("only");
  const [target, setTarget] = useState("");
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [buyAmt, setBuyAmt] = useState("1000");
  const [busy, setBusy] = useState(false);

  if (!token) return null;

  const activeAlerts = alerts.filter((a) => a.status === "active");

  const createAlert = async () => {
    const t = parseFloat(target);
    if (!t) return;
    setBusy(true);
    try {
      if (alertTab === "book") {
        const b = parseFloat(buyAmt);
        if (!b || b <= 0) { toast("error", "Enter buy amount"); setBusy(false); return; }
        await api("/alerts/book", { method: "POST", body: { target: t, metal, buy_amount: b, tenant } });
        toast("success", "Book Alert created!", `Will auto-buy ₹${b} of ${metal} when rate ≤ ₹${t}/g`);
      } else {
        await api("/alerts", { method: "POST", body: { target: t } });
        toast("success", "Alert created!", `We'll notify you when 24K ≤ ₹${t}/g`);
      }
      await reloadAlerts();
      setOpen(false);
      setTarget("");
      setBuyAmt("1000");
    } catch (e: any) {
      toast("error", "Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/alerts/${id}`, { method: "DELETE" });
      await reloadAlerts();
    } catch {}
  };

  return (
    <>
      <View style={styles.card} testID="price-alerts-card">
        <View style={styles.cardRow}>
          <View style={styles.alertIcon}>
            <Bell size={18} color={colors.brandSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Price Alerts</Text>
            <Text style={styles.cardSub}>
              {activeAlerts.length > 0
                ? `${activeAlerts.length} active · lowest ${inr(Math.min(...activeAlerts.map((a) => a.target)))}`
                : "Get notified at your target price"}
            </Text>
          </View>
          <Pressable onPress={() => setOpen(true)} style={styles.manageBtn} testID="manage-alerts-button">
            <Text style={styles.manageBtnText}>Manage</Text>
          </Pressable>
        </View>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Price Alerts" testID="alert-sheet">
        {/* Alert Type Tabs */}
        <View style={styles.tabRow}>
          <Pressable style={[styles.tab, alertTab === "only" && styles.tabActive]} onPress={() => setAlertTab("only")} testID="alert-tab-only">
            <Bell size={14} color={alertTab === "only" ? colors.onBrandPrimary : colors.muted} />
            <Text style={[styles.tabText, alertTab === "only" && styles.tabActiveText]}>Only Alert</Text>
          </Pressable>
          <Pressable style={[styles.tab, alertTab === "book" && styles.tabActive]} onPress={() => setAlertTab("book")} testID="alert-tab-book">
            <BookOpen size={14} color={alertTab === "book" ? colors.onBrandPrimary : colors.muted} />
            <Text style={[styles.tabText, alertTab === "book" && styles.tabActiveText]}>Book Alert</Text>
          </Pressable>
        </View>

        {alertTab === "only" ? (
          <Text style={styles.tabDesc}>Get notified when gold price reaches your target. No auto-purchase.</Text>
        ) : (
          <Text style={styles.tabDesc}>Automatically buy when price reaches your target. Uses wallet balance.</Text>
        )}

        {/* Metal selection for book alert */}
        {alertTab === "book" ? (
          <View style={styles.metalRow}>
            <Pressable style={[styles.metalBtn, metal === "gold" && styles.metalActive]} onPress={() => setMetal("gold")} testID="alert-metal-gold">
              <Coins size={14} color={metal === "gold" ? colors.onBrandPrimary : colors.muted} />
              <Text style={[styles.metalText, metal === "gold" && styles.metalActiveText]}>Gold</Text>
            </Pressable>
            <Pressable style={[styles.metalBtn, metal === "silver" && styles.metalSilverActive]} onPress={() => setMetal("silver")} testID="alert-metal-silver">
              <Coins size={14} color={metal === "silver" ? "#374151" : colors.muted} />
              <Text style={[styles.metalText, metal === "silver" && { color: "#374151", fontFamily: fonts.bold }]}>Silver</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.fieldLabel}>Target price (₹/g)</Text>
        <View style={styles.inpRow}>
          <Target size={16} color={colors.brandSecondary} />
          <TextInput testID="alert-target-input" value={target} onChangeText={(t) => setTarget(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder={price ? `e.g. ${Math.round(price.buy - 50)}` : "7200"} placeholderTextColor={colors.mutedLight} style={styles.inp} />
        </View>

        {/* Buy amount for book alert */}
        {alertTab === "book" ? (
          <>
            <Text style={styles.fieldLabel}>Auto-buy amount (₹)</Text>
            <View style={styles.inpRow}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.brandSecondary }}>₹</Text>
              <TextInput testID="alert-buy-amount-input" value={buyAmt} onChangeText={(t) => setBuyAmt(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="1000" placeholderTextColor={colors.mutedLight} style={styles.inp} />
            </View>
          </>
        ) : null}

        <Button title={alertTab === "book" ? "Create Book Alert" : "Create Alert"} size="lg" loading={busy} disabled={!target} onPress={createAlert} style={{ marginTop: 16 }} testID="create-alert-button" />

        {activeAlerts.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.activeTitle}>Active Alerts</Text>
            {activeAlerts.map((a) => (
              <View key={a.id} style={styles.alertRow} testID={`alert-row-${a.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTarget}>{inr(a.target)}/g</Text>
                  <Text style={styles.alertMeta}>{(a as any).alert_type === "book" ? "Book Alert · Auto-buy" : "Only Alert · Notify"}</Text>
                </View>
                <Pressable onPress={() => remove(a.id)} hitSlop={12} testID={`remove-alert-${a.id}`}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.successTint,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  bannerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.onSurface },
  bannerSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  alertIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  cardSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  manageBtn: { backgroundColor: colors.surfaceInverse, borderRadius: radius.pill, paddingHorizontal: 16, height: 36, justifyContent: "center" },
  manageBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceInverse },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  tabActiveText: { color: colors.onBrandPrimary, fontFamily: fonts.bold },
  tabDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginBottom: 16 },
  metalRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  metalActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  metalSilverActive: { borderColor: "#9CA3AF", backgroundColor: "#E8E8E8" },
  metalText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  metalActiveText: { color: colors.brandSecondary, fontFamily: fonts.bold },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary, marginBottom: 8, marginTop: 4 },
  inpRow: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, backgroundColor: colors.surface },
  inp: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface },
  activeTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface, marginBottom: 8 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  alertTarget: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface },
  alertMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  removeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
});
