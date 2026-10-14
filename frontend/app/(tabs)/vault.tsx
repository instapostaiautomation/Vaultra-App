import { useRouter } from "expo-router";
import { Coins, Download, Gift, Lock, Store, TrendingUp, Vault as VaultIcon, Wallet } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/Header";
import { GoalsSection } from "@/src/components/Goals";
import { RedeemSheet } from "@/src/components/Product";
import { useToast } from "@/src/components/Toast";
import { TxnRow } from "@/src/components/TxnRow";
import { Button, Chip, ChipRow, Row, Sheet, StatusBadge } from "@/src/components/ui";
import { dateTime, grams, inr, TENANT_NAME, TXN_LABEL } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius } from "@/src/theme";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buy" },
  { id: "sell", label: "Sell" },
  { id: "sip", label: "SIP" },
  { id: "redemption", label: "Redemption" },
  { id: "gift", label: "Gifts" },
];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, vault, refresh, tenant } = useApp();
  const [filter, setFilter] = useState("all");
  const [txns, setTxns] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [coinOpen, setCoinOpen] = useState(false);
  const [redeem, setRedeem] = useState<any>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const loadTxns = useCallback(async () => {
    if (!token) return;
    try {
      setTxns(await api(`/transactions?type=${filter}`));
    } catch {
      setTxns([]);
    }
  }, [token, filter]);

  useEffect(() => {
    loadTxns();
  }, [loadTxns, vault]);

  if (!token) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Vault & Ledger" />
        <View style={styles.center} testID="vault-signed-out">
          <View style={styles.emptyIcon}>
            <Lock size={32} color={colors.brandSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Your secure gold vault</Text>
          <Text style={styles.emptySub}>Sign in to view holdings, passbook and redeem physical gold.</Text>
          <Button title="Sign In with Phone" onPress={() => router.push("/login")} testID="vault-signin-button" style={{ alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  const u = vault?.user;
  const up = (vault?.unrealized_pnl ?? 0) >= 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await loadTxns();
    setRefreshing(false);
  };

  const openInvoice = () => {
    const t = (txns || []).find((x) => x.type !== "reversal");
    if (!t) {
      toast("info", "No invoices yet", "Buy gold to generate your first invoice");
      return;
    }
    setInvoice(t);
  };

  return (
    <View style={styles.root} testID="vault-screen">
      <ScreenHeader title="Vault & Ledger" subtitle={TENANT_NAME[tenant]} />
      <ScrollView
        stickyHeaderIndices={[3]}
        contentContainerStyle={{ paddingBottom: bottomChrome + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.portfolio} testID="portfolio-card">
          <View style={styles.pHead}>
            <VaultIcon size={16} color={colors.brandPrimary} />
            <Text style={styles.pLabel}>24K GOLD IN VAULT</Text>
          </View>
          <Text style={styles.pGrams} testID="portfolio-grams">
            {grams(u?.gold_grams)}
          </Text>
          <Text style={styles.pValue} testID="portfolio-value">
            {inr(vault?.current_value)} <Text style={styles.pValueSub}>current value</Text>
          </Text>
          <View style={styles.pStats}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pStatLabel}>Avg. buy price</Text>
              <Text style={styles.pStatValue} testID="portfolio-avg-price">{inr(u?.avg_buy_price)}/g</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pStatLabel}>Invested</Text>
              <Text style={styles.pStatValue}>{inr(u?.invested)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.pStatLabel}>Unrealized P&L</Text>
              <Text style={[styles.pStatValue, { color: up ? "#4ADE80" : "#F87171" }]} testID="portfolio-pnl">
                {up ? "+" : ""}
                {vault?.unrealized_pct ?? 0}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {[
            { id: "redeem", label: "Redeem Physical Coins", Icon: Coins, onPress: () => setCoinOpen(true) },
            { id: "sell", label: "Sell Gold to Bank", Icon: TrendingUp, onPress: () => setSellOpen(true) },
            { id: "invoice", label: "Download Invoice", Icon: Download, onPress: openInvoice },
            { id: "gift", label: "Gift Gold", Icon: Gift, onPress: () => router.push("/gift") },
          ].map(({ id, label, Icon, onPress }) => (
            <Pressable key={id} testID={`vault-action-${id}`} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={styles.actionIcon}>
                <Icon size={20} color={colors.brandSecondary} />
              </View>
              <Text style={styles.actionText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <GoalsSection />
          {(vault?.pending_pickups || []).map((p) => (
            <View key={p.id} style={styles.pickup} testID={`pending-pickup-${p.id}`}>
              <Store size={20} color={colors.brandSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupTitle}>{p.item} ready for pickup</Text>
                <Text style={styles.pickupSub}>{TENANT_NAME[p.tenant]} · show OTP at counter</Text>
              </View>
              <Text style={styles.pickupOtp} testID={`pickup-otp-${p.id}`}>{p.otp}</Text>
            </View>
          ))}
          <Text style={styles.passTitle}>Transaction Passbook</Text>
        </View>

        <ChipRow style={{ backgroundColor: colors.surfaceSecondary }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} testID={`passbook-filter-${f.id}`} />
          ))}
        </ChipRow>

        <View style={styles.passbook} testID="passbook-list">
          {txns === null ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: 24 }} />
          ) : txns.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }} testID="passbook-empty">
              <Wallet size={28} color={colors.mutedLight} />
              <Text style={styles.emptySub}>No {filter === "all" ? "" : FILTERS.find((f) => f.id === filter)?.label + " "}transactions yet</Text>
            </View>
          ) : (
            txns.map((t) => <TxnRow key={t.id} t={t} onPress={() => setInvoice(t)} />)
          )}
        </View>
      </ScrollView>

      <Sheet visible={coinOpen} onClose={() => setCoinOpen(false)} title="Redeem physical coins" testID="coin-sheet">
        <Text style={styles.emptySub}>Choose a 24K 999.9 minted coin. Collect in store or get BRINK&apos;S insured delivery.</Text>
        <View style={styles.coinGrid}>
          {[1, 2, 5, 10].map((c) => (
            <Pressable
              key={c}
              testID={`coin-option-${c}`}
              style={styles.coin}
              onPress={() => {
                setCoinOpen(false);
                setRedeem({ kind: "coin", coin: c });
              }}
            >
              <View style={styles.coinCircle}>
                <Text style={styles.coinG}>{c}g</Text>
              </View>
              <Text style={styles.coinLabel}>{inr(c * (vault?.buy_rate ?? 0), 0)}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <RedeemSheet target={redeem} onClose={() => setRedeem(null)} />
      <SellSheet visible={sellOpen} onClose={() => setSellOpen(false)} />
      <InvoiceSheet t={invoice} onClose={() => setInvoice(null)} />
    </View>
  );
}

function SellSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { vault, tenant, refresh } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [g, setG] = useState("");
  const [busy, setBusy] = useState(false);
  const bal = vault?.user.gold_grams ?? 0;
  const rate = vault?.sell_rate ?? 0;
  const v = parseFloat(g) || 0;

  const sell = async () => {
    setBusy(true);
    try {
      const t = await api("/sell", { method: "POST", body: { grams: v, tenant } });
      await refresh();
      toast("success", "Gold sold", `${inr(t.amount)} will be credited to your bank`);
      setG("");
      onClose();
    } catch (e: any) {
      toast("error", "Sell failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Sell gold to bank" testID="sell-sheet">
      <Row label="Live sell rate" value={`${inr(rate)}/g`} />
      <Row label="Available" value={grams(bal)} />
      <View style={styles.sellInput}>
        <TextInput
          testID="sell-grams-input"
          value={g}
          onChangeText={(t) => setG(t.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          placeholder="0.0000"
          placeholderTextColor={colors.mutedLight}
          style={styles.sellField}
        />
        <Text style={styles.sellUnit}>g</Text>
        <Pressable onPress={() => setG(String(bal))} style={styles.maxBtn} testID="sell-max-button">
          <Text style={styles.maxText}>MAX</Text>
        </Pressable>
      </View>
      <Row label="You receive" value={inr(v * rate)} bold testID="sell-receive-amount" />
      <View style={{ height: 12 }} />
      {vault?.user.kyc_status !== "approved" ? (
        <Button title="Complete KYC to sell" variant="dark" onPress={() => { onClose(); router.push("/profile"); }} testID="sell-kyc-button" />
      ) : (
        <Button title="Sell Gold" loading={busy} disabled={v <= 0 || v > bal + 1e-9} onPress={sell} testID="sell-confirm-button" />
      )}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

function InvoiceSheet({ t, onClose }: { t: any; onClose: () => void }) {
  const share = async () => {
    if (!t) return;
    const text = `Vaultra DigiGold — Tax Invoice\nInvoice: ${t.invoice_no}\nDate: ${dateTime(t.created_at)}\nStore: ${TENANT_NAME[t.tenant]}\nType: ${TXN_LABEL[t.type]}\nGold: ${grams(t.grams)} 24K @ ${inr(t.rate)}/g\nValue: ${inr(t.amount)}\nGST (3%): ${inr(t.gst)}\nTotal: ${inr(t.total)}\nStatus: ${t.status}`;
    try {
      await Share.share({ message: text, title: t.invoice_no });
    } catch {}
  };
  return (
    <Sheet visible={!!t} onClose={onClose} title="Tax Invoice" testID="invoice-sheet">
      {t ? (
        <View style={{ paddingBottom: 8 }}>
          <View style={styles.invHead}>
            <View>
              <Text style={styles.invNo} testID="invoice-number">{t.invoice_no}</Text>
              <Text style={styles.emptySub}>{dateTime(t.created_at)}</Text>
            </View>
            <StatusBadge status={t.status} />
          </View>
          <Row label="Store" value={TENANT_NAME[t.tenant]} />
          <Row label="Type" value={TXN_LABEL[t.type]} />
          <Row label="Gold (24K 99.9%)" value={grams(t.grams)} />
          <Row label="Rate" value={`${inr(t.rate)}/g`} />
          <Row label="Gold value" value={inr(t.amount)} />
          <Row label="GST (3%)" value={inr(t.gst)} />
          <Row label={t.type === "redemption" ? "Making charges" : "Total"} value={inr(t.total)} bold />
          {t.note ? <Text style={[styles.emptySub, { marginTop: 8 }]}>{t.note}</Text> : null}
          <Button title="Download / Share Invoice" icon={<Download size={18} color={colors.onBrandPrimary} />} onPress={share} style={{ marginTop: 16 }} testID="invoice-share-button" />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.black, fontSize: 22, letterSpacing: -0.6, color: colors.onSurface },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
  portfolio: { margin: 16, backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: 20, borderWidth: 1, borderColor: colors.brandDeep, ...cardShadow },
  pHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  pLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.brandPrimary, letterSpacing: 1 },
  pGrams: { fontFamily: fonts.black, fontSize: 38, color: colors.onSurfaceInverse, letterSpacing: -1.4, marginTop: 8 },
  pValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.brandPrimary, marginTop: 2 },
  pValueSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedLight },
  pStats: { flexDirection: "row", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  pStatLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.mutedLight },
  pStatValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.onSurfaceInverse, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 },
  action: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: "center", gap: 10, minHeight: 64, ...cardShadow },
  actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  pickup: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: radius.md, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "#F0E2B0" },
  pickupTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  pickupSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pickupOtp: { fontFamily: fonts.black, fontSize: 18, letterSpacing: 2, color: colors.onBrandTertiary },
  passTitle: { fontFamily: fonts.black, fontSize: 20, letterSpacing: -0.6, color: colors.onSurface, marginHorizontal: 16, marginTop: 24, marginBottom: 4 },
  passbook: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  coinGrid: { flexDirection: "row", gap: 8, marginVertical: 16 },
  coin: { flex: 1, alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  coinCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#F0E2B0" },
  coinG: { fontFamily: fonts.black, fontSize: 16, color: colors.onBrandPrimary },
  coinLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  sellInput: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: 16, height: 60, marginVertical: 12 },
  sellField: { flex: 1, fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface, height: 56 },
  sellUnit: { fontFamily: fonts.bold, fontSize: 18, color: colors.muted, marginRight: 12 },
  maxBtn: { backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  maxText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onBrandTertiary },
  invHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  invNo: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
});
