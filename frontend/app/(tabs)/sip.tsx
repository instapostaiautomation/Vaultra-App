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
import { TrendingUp, Plus, Pause, Play, Trash2 } from "lucide-react-native";

function inr(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function SipScreen() {
  const { colors } = useTheme();
  const { isLoggedIn, price } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sips, setSips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [freq, setFreq] = useState("monthly");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!isLoggedIn) { setLoading(false); return; }
    try { const s = await api("/sips"); setSips(s); } catch {} finally { setLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const createSip = async () => {
    const a = parseFloat(amount);
    if (!a || a < 100) { Alert.alert("Error", "Minimum SIP amount is ₹100"); return; }
    setCreating(true);
    try {
      await api("/sips", { method: "POST", body: { amount: a, frequency: freq } });
      setShowCreate(false);
      load();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setCreating(false); }
  };

  const toggleSip = async (id: string) => {
    try { await api(`/sips/${id}/toggle`, { method: "POST" }); load(); } catch {}
  };

  const cancelSip = async (id: string) => {
    Alert.alert("Cancel SIP", "Are you sure?", [
      { text: "No" },
      { text: "Yes", style: "destructive", onPress: async () => { await api(`/sips/${id}`, { method: "DELETE" }); load(); } },
    ]);
  };

  const runSip = async (id: string) => {
    try { await api(`/sips/${id}/run`, { method: "POST" }); Alert.alert("Success", "SIP installment executed!"); load(); } catch (e: any) { Alert.alert("Error", e.message); }
  };

  if (!isLoggedIn) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <TrendingUp size={48} color={colors.brand} />
        <Text style={[ss.emptyTitle, { color: colors.onSurface }]}>Auto Gold SIP</Text>
        <Text style={[ss.emptyText, { color: colors.muted }]}>Invest in gold automatically every day, week, or month</Text>
        <TouchableOpacity style={[ss.loginBtn, { backgroundColor: colors.brand }]} onPress={() => router.push("/login")}>
          <Text style={ss.loginBtnText}>Login to Start SIP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[ss.title, { color: colors.onSurface }]}>Gold SIP</Text>
          <TouchableOpacity style={[ss.addBtn, { backgroundColor: colors.brand }]} onPress={() => setShowCreate(!showCreate)}>
            <Plus size={18} color="#FFF" />
            <Text style={{ color: "#FFF", fontWeight: "600", marginLeft: 4 }}>New SIP</Text>
          </TouchableOpacity>
        </View>

        {showCreate && (
          <View style={[ss.createCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[ss.createLabel, { color: colors.onSurface }]}>Monthly Amount (₹)</Text>
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={[ss.createInput, { color: colors.onSurface, borderColor: colors.border }]} />
            <Text style={[ss.createLabel, { color: colors.onSurface, marginTop: 12 }]}>Frequency</Text>
            <View style={ss.freqRow}>
              {["daily", "weekly", "monthly"].map(f => (
                <TouchableOpacity key={f} style={[ss.freqBtn, { backgroundColor: freq === f ? colors.brand : "transparent", borderColor: freq === f ? colors.brand : colors.border }]} onPress={() => setFreq(f)}>
                  <Text style={{ color: freq === f ? "#FFF" : colors.muted, fontWeight: "600" }}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {price && <Text style={[ss.estimate, { color: colors.muted }]}>≈ {(parseFloat(amount || "0") / price.buy).toFixed(4)}g per installment at current rate</Text>}
            <TouchableOpacity style={[ss.createBtn, { backgroundColor: colors.brand }]} onPress={createSip} disabled={creating}>
              {creating ? <ActivityIndicator color="#FFF" /> : <Text style={ss.createBtnText}>Start SIP</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
          sips.length === 0 ? (
            <View style={ss.emptyState}>
              <Text style={[ss.emptyText, { color: colors.muted }]}>{"No active SIPs. Tap 'New SIP' to start."}</Text>
            </View>
          ) : (
            sips.map(s => (
              <View key={s.id} style={[ss.sipCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={ss.sipHeader}>
                  <Text style={[ss.sipAmount, { color: colors.onSurface }]}>{inr(s.amount)} / {s.frequency}</Text>
                  <View style={[ss.statusBadge, { backgroundColor: s.status === "active" ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={{ color: s.status === "active" ? "#16A34A" : "#D97706", fontSize: 11, fontWeight: "600" }}>{s.status}</Text>
                  </View>
                </View>
                <Text style={[ss.sipMeta, { color: colors.muted }]}>{s.installments} installments · {s.grams_accumulated.toFixed(4)}g accumulated</Text>
                <View style={ss.sipActions}>
                  <TouchableOpacity style={[ss.sipActionBtn, { borderColor: colors.border }]} onPress={() => toggleSip(s.id)}>
                    {s.status === "active" ? <Pause size={16} color={colors.muted} /> : <Play size={16} color={colors.success} />}
                    <Text style={{ marginLeft: 4, color: colors.muted, fontSize: 12 }}>{s.status === "active" ? "Pause" : "Resume"}</Text>
                  </TouchableOpacity>
                  {s.status === "active" && (
                    <TouchableOpacity style={[ss.sipActionBtn, { borderColor: colors.brand, backgroundColor: colors.brandTertiary }]} onPress={() => runSip(s.id)}>
                      <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "600" }}>Run Now</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[ss.sipActionBtn, { borderColor: colors.error }]} onPress={() => cancelSip(s.id)}>
                    <Trash2 size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
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
  title: { fontSize: 22, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  createCard: { margin: 16, borderRadius: 14, padding: 16, borderWidth: 1 },
  createLabel: { fontSize: 13, fontWeight: "600" },
  createInput: { borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 14, fontSize: 18, fontWeight: "600", marginTop: 8 },
  freqRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  freqBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  estimate: { fontSize: 12, marginTop: 10 },
  createBtn: { height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 14 },
  createBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  emptyState: { padding: 40, alignItems: "center" },
  sipCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, borderWidth: 1 },
  sipHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sipAmount: { fontSize: 17, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  sipMeta: { fontSize: 12, marginTop: 6 },
  sipActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  sipActionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
