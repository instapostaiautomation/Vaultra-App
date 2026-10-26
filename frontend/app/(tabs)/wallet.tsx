import { useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, IndianRupee, Plus, Wallet } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Sheet } from "@/src/components/ui";
import { inr, shortDate } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius } from "@/src/theme";

type WalletTxn = {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
};

type WalletData = {
  balance: number;
  referral_balance: number;
  transactions: WalletTxn[];
};

export default function WalletTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, refresh } = useApp();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const w = await api<WalletData>("/wallet");
      setData(w);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) loadWallet();
    else setLoading(false);
  }, [token, loadWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    if (token) await refresh();
    setRefreshing(false);
  };

  const deposit = async () => {
    const v = parseFloat(amt);
    if (!v || v <= 0) return;
    setBusy(true);
    try {
      await api("/wallet/deposit", { method: "POST", body: { amount: v } });
      toast("success", "Deposit Successful", `₹${v.toFixed(2)} added to wallet`);
      await loadWallet();
      await refresh();
      setShowDeposit(false);
      setAmt("");
    } catch (e: any) {
      toast("error", "Deposit Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    const v = parseFloat(amt);
    if (!v || v <= 0) return;
    setBusy(true);
    try {
      await api("/wallet/withdraw", { method: "POST", body: { amount: v } });
      toast("success", "Withdrawal Initiated", `₹${v.toFixed(2)} will be sent to your bank`);
      await loadWallet();
      await refresh();
      setShowWithdraw(false);
      setAmt("");
    } catch (e: any) {
      toast("error", "Withdrawal Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.root} testID="wallet-screen">
        <ScreenHeader title="Wallet" showBack />
        <View style={styles.center}>
          <Wallet size={48} color={colors.mutedLight} />
          <Text style={styles.emptyTitle}>Sign in to use your wallet</Text>
          <Text style={styles.emptySub}>Deposit, withdraw, and track all your transactions</Text>
          <Button title="Sign In" onPress={() => router.push("/login")} style={{ marginTop: 16, minWidth: 200 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="wallet-screen">
      <ScreenHeader title="Wallet" showBack />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : data ? (
          <>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balLabel}>Wallet Balance</Text>
              <Text style={styles.balAmount} testID="wallet-balance">{inr(data.balance)}</Text>
              <View style={styles.balRow}>
                <View style={styles.balMini}>
                  <Text style={styles.balMiniLabel}>Referral Earnings</Text>
                  <Text style={styles.balMiniVal}>{inr(data.referral_balance)}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => { setAmt(""); setShowDeposit(true); }} testID="wallet-deposit-btn">
                  <View style={styles.actionIcon}>
                    <Plus size={18} color={colors.onBrandPrimary} />
                  </View>
                  <Text style={styles.actionText}>Deposit</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => { setAmt(""); setShowWithdraw(true); }} testID="wallet-withdraw-btn">
                  <View style={[styles.actionIcon, { backgroundColor: colors.surfaceInverse }]}>
                    <ArrowUpRight size={18} color={colors.onSurfaceInverse} />
                  </View>
                  <Text style={styles.actionText}>Withdraw</Text>
                </Pressable>
              </View>
            </View>

            {/* Transaction History */}
            <Text style={styles.txnTitle}>Transaction History</Text>
            {data.transactions.length === 0 ? (
              <Card>
                <Text style={styles.emptySub}>No transactions yet. Deposit money to get started.</Text>
              </Card>
            ) : (
              data.transactions.map((txn) => (
                <View key={txn.id} style={styles.txnRow} testID={`txn-${txn.id}`}>
                  <View style={[styles.txnIcon, txn.type === "deposit" || txn.type === "referral" || txn.type === "gift_received" ? styles.txnIconIn : styles.txnIconOut]}>
                    {txn.type === "deposit" || txn.type === "referral" || txn.type === "gift_received" ? (
                      <ArrowDownLeft size={16} color={colors.success} />
                    ) : (
                      <ArrowUpRight size={16} color={colors.error} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnDesc}>{txn.description}</Text>
                    <Text style={styles.txnDate}>{shortDate(txn.created_at)}</Text>
                  </View>
                  <Text style={[styles.txnAmt, txn.type === "deposit" || txn.type === "referral" || txn.type === "gift_received" ? { color: colors.success } : { color: colors.error }]}>
                    {txn.type === "deposit" || txn.type === "referral" || txn.type === "gift_received" ? "+" : "-"}{inr(txn.amount)}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Deposit Sheet */}
      <Sheet visible={showDeposit} onClose={() => setShowDeposit(false)} title="Deposit to Wallet" testID="deposit-sheet">
        <Text style={styles.sheetSub}>Add funds via UPI (Mock)</Text>
        <View style={styles.amtField}>
          <IndianRupee size={20} color={colors.brandSecondary} />
          <TextInput
            testID="deposit-amount-input"
            value={amt}
            onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            placeholderTextColor={colors.mutedLight}
            style={styles.amtInput}
            autoFocus
          />
        </View>
        <View style={styles.quickAmts}>
          {[500, 1000, 2000, 5000].map((v) => (
            <Pressable key={v} onPress={() => setAmt(String(v))} style={styles.quickBtn}>
              <Text style={styles.quickText}>+₹{v.toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Deposit" size="lg" loading={busy} disabled={!parseFloat(amt)} onPress={deposit} testID="confirm-deposit-button" />
      </Sheet>

      {/* Withdraw Sheet */}
      <Sheet visible={showWithdraw} onClose={() => setShowWithdraw(false)} title="Withdraw from Wallet" testID="withdraw-sheet">
        <Text style={styles.sheetSub}>Withdraw to bank account (Mock)</Text>
        <Text style={styles.sheetBal}>Available: {inr(data?.balance ?? 0)}</Text>
        <View style={styles.amtField}>
          <IndianRupee size={20} color={colors.brandSecondary} />
          <TextInput
            testID="withdraw-amount-input"
            value={amt}
            onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            placeholderTextColor={colors.mutedLight}
            style={styles.amtInput}
          />
        </View>
        <Button title="Withdraw" size="lg" loading={busy} disabled={!parseFloat(amt)} onPress={withdraw} testID="confirm-withdraw-button" />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.onSurface },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  balanceCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: 16,
    padding: 24,
    ...cardShadow,
  },
  balLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.mutedLight },
  balAmount: { fontFamily: fonts.black, fontSize: 36, color: colors.onSurfaceInverse, letterSpacing: -1, marginTop: 4 },
  balRow: { marginTop: 16, flexDirection: "row", gap: 12 },
  balMini: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 },
  balMiniLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.mutedLight },
  balMiniVal: { fontFamily: fonts.bold, fontSize: 16, color: colors.brandPrimary, marginTop: 2 },
  actions: { flexDirection: "row", gap: 16, marginTop: 20 },
  actionBtn: { flex: 1, alignItems: "center", gap: 6 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceInverse },
  txnTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginTop: 8 },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txnIconIn: { backgroundColor: colors.successTint },
  txnIconOut: { backgroundColor: colors.errorTint },
  txnDesc: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  txnDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  txnAmt: { fontFamily: fonts.bold, fontSize: 15 },
  sheetSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginBottom: 16 },
  sheetBal: { fontFamily: fonts.semibold, fontSize: 14, color: colors.success, marginBottom: 12 },
  amtField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  amtInput: { flex: 1, fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface },
  quickAmts: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  quickBtn: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    justifyContent: "center",
  },
  quickText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandSecondary },
});
