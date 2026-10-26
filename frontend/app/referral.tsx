import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { ArrowLeft, Copy, Share2, Users, Gift } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

function inr(n: number) { return "₹" + n.toFixed(0); }

export default function ReferralScreen() {
  const { colors } = useTheme();
  const { isLoggedIn } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    api("/referral").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const copyCode = async () => {
    if (data?.referral_code) {
      await Clipboard.setStringAsync(data.referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareCode = async () => {
    if (data?.referral_code) {
      await Share.share({ message: `Join Vaultra DigiGold and get ₹50 bonus! Use my referral code: ${data.referral_code}` });
    }
  };

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[ss.title, { color: colors.onSurface }]}>Refer & Earn</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
          <>
            <View style={[ss.codeCard, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}>
              <Gift size={32} color={colors.brand} />
              <Text style={[ss.codeLabel, { color: colors.muted }]}>Your Referral Code</Text>
              <Text style={[ss.codeValue, { color: colors.brand }]}>{data?.referral_code || "—"}</Text>
              <View style={ss.codeActions}>
                <TouchableOpacity style={[ss.codeBtn, { backgroundColor: colors.brand }]} onPress={copyCode}>
                  <Copy size={16} color="#FFF" /><Text style={{ color: "#FFF", fontWeight: "600", marginLeft: 6 }}>{copied ? "Copied!" : "Copy"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ss.codeBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]} onPress={shareCode}>
                  <Share2 size={16} color={colors.onSurface} /><Text style={{ color: colors.onSurface, fontWeight: "600", marginLeft: 6 }}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={ss.rewardRow}>
              <View style={[ss.rewardCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[ss.rewardAmount, { color: colors.success }]}>₹50</Text>
                <Text style={[ss.rewardLabel, { color: colors.muted }]}>You earn</Text>
              </View>
              <View style={[ss.rewardCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[ss.rewardAmount, { color: colors.success }]}>₹50</Text>
                <Text style={[ss.rewardLabel, { color: colors.muted }]}>Friend gets</Text>
              </View>
              <View style={[ss.rewardCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[ss.rewardAmount, { color: colors.brand }]}>{data?.referral_count || 0}</Text>
                <Text style={[ss.rewardLabel, { color: colors.muted }]}>Referrals</Text>
              </View>
            </View>
            <Text style={[ss.balanceText, { color: colors.onSurface }]}>Referral Earnings: {inr(data?.referral_balance || 0)}</Text>
            {data?.referrals?.length > 0 && (
              <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
                <Text style={[ss.sectionTitle, { color: colors.onSurface }]}>Your Referrals</Text>
                {data.referrals.map((r: any, i: number) => (
                  <View key={i} style={[ss.refRow, { borderColor: colors.divider }]}>
                    <Users size={16} color={colors.muted} />
                    <Text style={[ss.refName, { color: colors.onSurface }]}>{r.name}</Text>
                    <Text style={[ss.refDate, { color: colors.muted }]}>{new Date(r.joined).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  codeCard: { margin: 16, borderRadius: 16, padding: 24, borderWidth: 1, alignItems: "center" },
  codeLabel: { fontSize: 13, marginTop: 12 },
  codeValue: { fontSize: 28, fontWeight: "800", letterSpacing: 3, marginTop: 4 },
  codeActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  codeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  rewardRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  rewardCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  rewardAmount: { fontSize: 22, fontWeight: "800" },
  rewardLabel: { fontSize: 12, marginTop: 4 },
  balanceText: { fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  refRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  refName: { flex: 1, fontSize: 14, fontWeight: "500" },
  refDate: { fontSize: 12 },
});
