import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus, Minus } from "lucide-react-native";

function inr(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function WalletScreen() {
  const { colors } = useTheme();
  const { isLoggedIn, refreshUser } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<"none" | "deposit" | "withdraw">("none");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoggedIn) { setWalletLoading(false); return; }
    try { const w = await api("/wallet"); setWallet(w); } catch {} finally { setWalletLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await Promise.all([load(), refreshUser()]); setRefreshing(false); };

  const submit = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return;
    setProcessing(true);
    try {
      await api(`/wallet/${action}`, { method: "POST", body: { amount: a } });
      setAction("none"); setAmount("");
      await Promise.all([load(), refreshUser()]);
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setProcessing(false); }
  };

  if (!isLoggedIn) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <Wallet size={48} color={colors.brand} />
        <Text style={[ss.emptyTitle, { color: colors.onSurface }]}>Wallet</Text>
        <Text style={[ss.emptyText, { color: colors.muted }]}>Login to access your wallet</Text>
        <TouchableOpacity style={[ss.loginBtn, { backgroundColor: colors.brand }]} onPress={() => router.push("/login")}>
          <Text style={ss.loginBtnText}>Login / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (walletLoading) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <Text style={[ss.title, { color: colors.onSurface }]}>Wallet</Text>
        </View>
        <View style={[ss.balCard, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}>
          <Text style={[ss.balLabel, { color: colors.muted }]}>Wallet Balance</Text>
          <Text style={[ss.balAmount, { color: colors.onSurface }]}>{inr(wallet?.balance || 0)}</Text>
          <Text style={[ss.refLabel, { color: colors.muted }]}>Referral Rewards: {inr(wallet?.referral_balance || 0)}</Text>
          <View style={ss.actionRow}>
            <TouchableOpacity style={[ss.actionBtn, { backgroundColor: colors.brand }]} onPress={() => setAction("deposit")}>
              <Plus size={16} color="#FFF" /><Text style={ss.actionBtnText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ss.actionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]} onPress={() => setAction("withdraw")}>
              <Minus size={16} color={colors.onSurface} /><Text style={[ss.actionBtnText, { color: colors.onSurface }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {action !== "none" && (
          <View style={[ss.inputCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[ss.inputLabel, { color: colors.onSurface }]}>{action === "deposit" ? "Add Money" : "Withdraw"}</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Enter amount" style={[ss.inputField, { color: colors.onSurface, borderColor: colors.border }]} placeholderTextColor={colors.mutedLight} />
            <View style={ss.inputActions}>
              <TouchableOpacity style={[ss.cancelBtn, { borderColor: colors.border }]} onPress={() => { setAction("none"); setAmount(""); }}>
                <Text style={{ color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ss.submitBtn, { backgroundColor: colors.brand }]} onPress={submit} disabled={processing}>
                {processing ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: "#FFF", fontWeight: "700" }}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[ss.sectionTitle, { color: colors.onSurface }]}>Transaction History</Text>
        {!wallet?.transactions?.length ? (
          <Text style={[ss.noData, { color: colors.muted }]}>No wallet transactions yet</Text>
        ) : (
          wallet.transactions.map((t: any) => (
            <View key={t.id} style={[ss.txnRow, { borderColor: colors.divider }]}>
              <View style={[ss.txnIcon, { backgroundColor: t.type === "deposit" || t.type === "referral" ? "#DCFCE7" : "#FEE2E2" }]}>
                {t.type === "deposit" || t.type === "referral" ? <ArrowDownLeft size={16} color="#16A34A" /> : <ArrowUpRight size={16} color="#DC2626" />}
              </View>
              <View style={ss.txnInfo}>
                <Text style={[ss.txnType, { color: colors.onSurface }]}>{t.type.charAt(0).toUpperCase() + t.type.slice(1)}</Text>
                <Text style={[ss.txnDesc, { color: colors.muted }]}>{t.description}</Text>
              </View>
              <Text style={[ss.txnAmt, { color: t.type === "deposit" || t.type === "referral" ? "#16A34A" : "#DC2626" }]}>
                {t.type === "withdraw" ? "-" : "+"}{inr(t.amount)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 6, textAlign: "center" },
  loginBtn: { marginTop: 20, height: 48, paddingHorizontal: 32, borderRadius: 14, justifyContent: "center" },
  loginBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  balCard: { margin: 16, borderRadius: 16, padding: 20, borderWidth: 1 },
  balLabel: { fontSize: 13 },
  balAmount: { fontSize: 32, fontWeight: "800", marginTop: 4 },
  refLabel: { fontSize: 13, marginTop: 8 },
  actionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 44, borderRadius: 12, gap: 6 },
  actionBtnText: { color: "#FFF", fontWeight: "600" },
  inputCard: { marginHorizontal: 16, borderRadius: 14, padding: 16, borderWidth: 1 },
  inputLabel: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  inputField: { borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 14, fontSize: 18, fontWeight: "600" },
  inputActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  submitBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  noData: { paddingHorizontal: 16, fontSize: 13 },
  txnRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  txnIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  txnInfo: { flex: 1, marginLeft: 12 },
  txnType: { fontSize: 14, fontWeight: "600" },
  txnDesc: { fontSize: 12, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: "700" },
});
