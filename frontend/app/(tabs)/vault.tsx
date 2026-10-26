import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft } from "lucide-react-native";

function inr(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function VaultScreen() {
  const { colors } = useTheme();
  const { user, isLoggedIn, refreshUser } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [vault, setVault] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoggedIn) { setLoading(false); return; }
    try {
      const [v, t] = await Promise.all([
        api("/vault"),
        api("/transactions?type=all"),
      ]);
      setVault(v);
      setTxns(t.slice(0, 20));
    } catch {} finally { setLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshUser()]);
    setRefreshing(false);
  };

  if (!isLoggedIn) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <Wallet size={48} color={colors.brand} />
        <Text style={[ss.emptyTitle, { color: colors.onSurface }]}>Your Gold Vault</Text>
        <Text style={[ss.emptyText, { color: colors.muted }]}>Login to view your gold holdings</Text>
        <TouchableOpacity style={[ss.loginBtn, { backgroundColor: colors.brand }]} onPress={() => router.push("/login")}>
          <Text style={ss.loginBtnText}>Login / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <View style={[ss.center, { backgroundColor: colors.surface }]}><ActivityIndicator size="large" color={colors.brand} /></View>;

  const pnlPositive = (vault?.unrealized_pnl || 0) >= 0;

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <Text style={[ss.screenTitle, { color: colors.onSurface }]}>My Vault</Text>
        </View>

        {/* Balance Card */}
        <View style={[ss.balanceCard, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}>
          <Text style={[ss.balLabel, { color: colors.muted }]}>Total Gold Holdings</Text>
          <Text style={[ss.balGrams, { color: colors.onSurface }]}>{(vault?.user?.gold_grams || 0).toFixed(4)}g</Text>
          <Text style={[ss.balValue, { color: colors.brand }]}>≈ {inr(vault?.current_value || 0)}</Text>
          <View style={ss.pnlRow}>
            {pnlPositive ? <TrendingUp size={16} color={colors.success} /> : <TrendingDown size={16} color={colors.error} />}
            <Text style={{ color: pnlPositive ? colors.success : colors.error, fontWeight: "600", marginLeft: 4 }}>
              {pnlPositive ? "+" : ""}{inr(vault?.unrealized_pnl || 0)} ({vault?.unrealized_pct || 0}%)
            </Text>
          </View>
          <View style={ss.rateRow}>
            <Text style={[ss.rateText, { color: colors.muted }]}>Buy: {inr(vault?.buy_rate || 0)}/g</Text>
            <Text style={[ss.rateText, { color: colors.muted }]}>Sell: {inr(vault?.sell_rate || 0)}/g</Text>
          </View>
        </View>

        {/* Silver */}
        <View style={[ss.silverCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>Silver Holdings</Text>
          <Text style={[ss.silverGrams, { color: colors.onSurface }]}>{(user?.silver_grams || 0).toFixed(4)}g</Text>
        </View>

        {/* Wallet ID */}
        <View style={[ss.walletIdCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[ss.walletIdLabel, { color: colors.muted }]}>Wallet ID (for in-store redemption)</Text>
          <Text style={[ss.walletIdValue, { color: colors.brand }]}>{user?.wallet_id}</Text>
        </View>

        {/* Transactions */}
        <Text style={[ss.sectionTitle, { color: colors.onSurface }]}>Recent Transactions</Text>
        {txns.length === 0 ? (
          <Text style={[ss.noData, { color: colors.muted }]}>No transactions yet. Start buying gold!</Text>
        ) : (
          txns.map((t) => (
            <View key={t.id} style={[ss.txnRow, { borderColor: colors.divider }]}>
              <View style={[ss.txnIcon, { backgroundColor: t.type.includes("buy") || t.type === "sip" ? "#DCFCE7" : "#FEE2E2" }]}>
                {t.type.includes("buy") || t.type === "sip" || t.type === "gift_received"
                  ? <ArrowDownLeft size={16} color="#16A34A" />
                  : <ArrowUpRight size={16} color="#DC2626" />}
              </View>
              <View style={ss.txnInfo}>
                <Text style={[ss.txnType, { color: colors.onSurface }]}>{t.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</Text>
                <Text style={[ss.txnDate, { color: colors.muted }]}>{new Date(t.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={ss.txnRight}>
                <Text style={[ss.txnGrams, { color: colors.onSurface }]}>{t.grams.toFixed(4)}g</Text>
                <Text style={[ss.txnAmt, { color: colors.muted }]}>{inr(t.total)}</Text>
              </View>
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
  screenTitle: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  balanceCard: { margin: 16, borderRadius: 16, padding: 20, borderWidth: 1 },
  balLabel: { fontSize: 13, fontWeight: "500" },
  balGrams: { fontSize: 32, fontWeight: "800", marginTop: 4 },
  balValue: { fontSize: 18, fontWeight: "600", marginTop: 2 },
  pnlRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  rateRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  rateText: { fontSize: 12 },
  silverCard: { marginHorizontal: 16, borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  silverGrams: { fontSize: 18, fontWeight: "700" },
  walletIdCard: { margin: 16, borderRadius: 12, padding: 14, borderWidth: 1 },
  walletIdLabel: { fontSize: 12 },
  walletIdValue: { fontSize: 20, fontWeight: "800", letterSpacing: 1.5, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "700", paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  noData: { paddingHorizontal: 16, fontSize: 13 },
  txnRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  txnIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  txnInfo: { flex: 1, marginLeft: 12 },
  txnType: { fontSize: 14, fontWeight: "600" },
  txnDate: { fontSize: 12, marginTop: 2 },
  txnRight: { alignItems: "flex-end" },
  txnGrams: { fontSize: 14, fontWeight: "600" },
  txnAmt: { fontSize: 12, marginTop: 2 },
});
