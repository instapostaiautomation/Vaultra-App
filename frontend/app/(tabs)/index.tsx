import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Dimensions, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import {
  Bell, User, TrendingUp, TrendingDown, Gift, Users, Shield,
  ShoppingBag, Zap, Target, ChevronRight,
} from "lucide-react-native";

const { width: SW } = Dimensions.get("window");

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user, isLoggedIn, price, isLoading, refreshPrice, jewellerConfig } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const p = await api<any[]>("/products", { auth: "none" });
      setProducts(p.slice(0, 4));
    } catch {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshPrice(), loadProducts()]);
    setRefreshing(false);
  }, [refreshPrice]);

  if (isLoading) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface, flex: 1 }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const shopName = jewellerConfig?.business_name || "Vaultra DigiGold";
  const goldDir = price?.direction === "up";
  const silverDir = price?.silver?.direction === "up";

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header */}
        <View style={[ss.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface }]}>
          <View style={ss.headerLeft}>
            <Text style={[ss.shopName, { color: colors.brand }]}>{shopName}</Text>
            {isLoggedIn && user ? (
              <Text style={[ss.greeting, { color: colors.muted }]}>
                Hi, {user.first_name} 👋
              </Text>
            ) : (
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={[ss.loginPrompt, { color: colors.brand }]}>Login / Sign Up →</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={ss.headerRight}>
            {isLoggedIn && (
              <TouchableOpacity style={[ss.iconBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => router.push("/notifications")}>
                <Bell size={20} color={colors.onSurface} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[ss.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => isLoggedIn ? router.push("/profile") : router.push("/login")}
            >
              <User size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Cards */}
        <View style={ss.priceRow}>
          {/* Gold Card */}
          <View style={[ss.priceCard, { backgroundColor: "#FFF8E1", borderColor: "#FFD54F" }]}>
            <View style={ss.priceCardHeader}>
              <Text style={ss.metalEmoji}>🪙</Text>
              <Text style={[ss.metalLabel, { color: "#5D4037" }]}>24K Gold</Text>
            </View>
            <Text style={[ss.metalPrice, { color: "#5D4037" }]}>
              {price ? inr(price.buy) : "—"}/g
            </Text>
            <View style={ss.changeRow}>
              {goldDir ? <TrendingUp size={14} color="#16A34A" /> : <TrendingDown size={14} color="#DC2626" />}
              <Text style={{ fontSize: 12, color: goldDir ? "#16A34A" : "#DC2626", marginLeft: 4 }}>
                {price ? `${goldDir ? "+" : ""}${price.change.toFixed(2)} (${price.change_pct}%)` : "—"}
              </Text>
            </View>
          </View>
          {/* Silver Card */}
          <View style={[ss.priceCard, { backgroundColor: "#F5F5F5", borderColor: "#BDBDBD" }]}>
            <View style={ss.priceCardHeader}>
              <Text style={ss.metalEmoji}>🥈</Text>
              <Text style={[ss.metalLabel, { color: "#455A64" }]}>Silver</Text>
            </View>
            <Text style={[ss.metalPrice, { color: "#455A64" }]}>
              {price?.silver ? inr(price.silver.buy) : "—"}/g
            </Text>
            <View style={ss.changeRow}>
              {silverDir ? <TrendingUp size={14} color="#16A34A" /> : <TrendingDown size={14} color="#DC2626" />}
              <Text style={{ fontSize: 12, color: silverDir ? "#16A34A" : "#DC2626", marginLeft: 4 }}>
                {price?.silver ? `${silverDir ? "+" : ""}${price.silver.change.toFixed(2)} (${price.silver.change_pct}%)` : "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Wallet ID Banner (for logged in users) */}
        {isLoggedIn && user && (
          <View style={[ss.walletBanner, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}>
            <View>
              <Text style={[ss.walletLabel, { color: colors.muted }]}>Your Wallet ID</Text>
              <Text style={[ss.walletId, { color: colors.brand }]}>{user.wallet_id}</Text>
            </View>
            <View>
              <Text style={[ss.walletLabel, { color: colors.muted }]}>Gold Balance</Text>
              <Text style={[ss.walletGrams, { color: colors.onSurface }]}>{user.gold_grams.toFixed(4)}g</Text>
            </View>
          </View>
        )}

        {/* Buy Gold Quick Action */}
        {isLoggedIn && (
          <BuyWidget />
        )}

        {/* Quick Actions */}
        <Text style={[ss.sectionTitle, { color: colors.onSurface }]}>Quick Actions</Text>
        <View style={ss.actionsGrid}>
          <ActionCard icon={<Zap size={22} color="#D4AF37" />} label="Auto SIP" sub="Recurring gold" onPress={() => router.push("/(tabs)/sip")} colors={colors} />
          <ActionCard icon={<Gift size={22} color="#E91E63" />} label="Gift Gold" sub="Send gold" onPress={() => isLoggedIn ? router.push("/gift") : router.push("/login")} colors={colors} />
          <ActionCard icon={<Target size={22} color="#2196F3" />} label="Price Alert" sub="Track rates" onPress={() => router.push("/(tabs)/vault")} colors={colors} />
          <ActionCard icon={<Users size={22} color="#4CAF50" />} label="Refer & Earn" sub="₹50 each" onPress={() => isLoggedIn ? router.push("/referral") : router.push("/login")} colors={colors} />
        </View>

        {/* Jewellery Preview */}
        <View style={ss.sectionHeader}>
          <Text style={[ss.sectionTitle, { color: colors.onSurface }]}>Jewellery Catalog</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/jewellery")}>
            <Text style={{ color: colors.brand, fontSize: 13 }}>View All <ChevronRight size={13} color={colors.brand} /></Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {products.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[ss.productCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => router.push(`/product-detail?id=${p.id}`)}
            >
              <View style={[ss.productImg, { backgroundColor: colors.brandTertiary }]}>
                <ShoppingBag size={28} color={colors.brand} />
              </View>
              <Text style={[ss.productName, { color: colors.onSurface }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[ss.productMeta, { color: colors.muted }]}>{p.grams}g · {p.tag}</Text>
              <Text style={[ss.productPrice, { color: colors.brand }]}>{inr(p.total_price)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Info Cards */}
        <View style={[ss.infoCard, { backgroundColor: colors.surfaceSecondary, marginHorizontal: 16, marginTop: 20 }]}>
          <Shield size={20} color={colors.brand} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[ss.infoTitle, { color: colors.onSurface }]}>24K 99.9% Pure Gold</Text>
            <Text style={[ss.infoSub, { color: colors.muted }]}>BIS Hallmarked · LBMA Certified · Secure Vault Storage</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function BuyWidget() {
  const { colors } = useTheme();
  const { price, refreshUser } = useApp();
  const [amount, setAmount] = useState("");
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const rate = metal === "gold" ? price?.buy : price?.silver?.buy;
  const grams = rate && amount ? (parseFloat(amount) / rate) : 0;

  const handleBuy = async () => {
    if (!amount || parseFloat(amount) < 10) return;
    setLoading(true);
    setResult(null);
    try {
      const quote = await api<any>(`/quote?metal=${metal}`, { method: "POST" });
      const order = await api<any>("/orders/buy", {
        method: "POST",
        body: { quote_id: quote.id, mode: "rupees", value: parseFloat(amount), method: "upi" },
      });
      const confirmed = await api<any>(`/orders/${order.id}/mock-confirm`, {
        method: "POST", body: { method: "upi", success: true },
      });
      setResult(`✅ Bought ${confirmed.transaction.grams.toFixed(4)}g ${metal} for ${inr(confirmed.transaction.total)}`);
      setAmount("");
      refreshUser();
    } catch (e: any) {
      setResult(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[ss.buySection, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <Text style={[ss.buySectionTitle, { color: colors.onSurface }]}>Buy {metal === "gold" ? "Gold" : "Silver"}</Text>
      <View style={ss.metalToggle}>
        {(["gold", "silver"] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[ss.metalBtn, metal === m && { backgroundColor: colors.brand }]}
            onPress={() => setMetal(m)}
          >
            <Text style={{ color: metal === m ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>
              {m === "gold" ? "🪙 Gold" : "🥈 Silver"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={ss.buyInputRow}>
        <View style={[ss.buyInputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[ss.rupeeSign, { color: colors.muted }]}>₹</Text>
          <View style={ss.buyInputInner}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              keyboardType="numeric"
              style={[ss.buyInput, { color: colors.onSurface }]}
              placeholderTextColor={colors.mutedLight}
            />
          </View>
        </View>
        <TouchableOpacity
          style={[ss.buyBtn, { backgroundColor: colors.brand, opacity: loading ? 0.6 : 1 }]}
          onPress={handleBuy}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={ss.buyBtnText}>Buy</Text>}
        </TouchableOpacity>
      </View>
      {grams > 0 && (
        <Text style={[ss.gramsPreview, { color: colors.muted }]}>
          ≈ {grams.toFixed(4)}g at {inr(rate || 0)}/g + 3% GST
        </Text>
      )}
      <View style={ss.quickAmounts}>
        {[500, 1000, 2000, 5000].map((a) => (
          <TouchableOpacity key={a} style={[ss.quickAmt, { borderColor: colors.border }]} onPress={() => setAmount(a.toString())}>
            <Text style={{ color: colors.onSurface, fontSize: 12 }}>{inr(a)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {result && <Text style={[ss.resultText, { color: result.startsWith("✅") ? colors.success : colors.error }]}>{result}</Text>}
    </View>
  );
}

// TextInput already imported above

function ActionCard({ icon, label, sub, onPress, colors }: any) {
  return (
    <TouchableOpacity style={[ss.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={onPress}>
      <View style={[ss.actionIcon, { backgroundColor: colors.brandTertiary }]}>{icon}</View>
      <Text style={[ss.actionLabel, { color: colors.onSurface }]}>{label}</Text>
      <Text style={[ss.actionSub, { color: colors.muted }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 16, paddingBottom: 12 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "row", gap: 8 },
  shopName: { fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  greeting: { fontSize: 14, marginTop: 2 },
  loginPrompt: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  priceRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginTop: 4 },
  priceCard: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  priceCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  metalEmoji: { fontSize: 20 },
  metalLabel: { fontSize: 13, fontWeight: "600" },
  metalPrice: { fontSize: 20, fontWeight: "800", marginTop: 8 },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  walletBanner: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  walletLabel: { fontSize: 11, fontWeight: "500" },
  walletId: { fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  walletGrams: { fontSize: 18, fontWeight: "700", textAlign: "right" },
  buySection: { margin: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  buySectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  metalToggle: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metalBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  buyInputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  buyInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  rupeeSign: { fontSize: 18, fontWeight: "600", marginRight: 4 },
  buyInputInner: { flex: 1 },
  buyInput: { fontSize: 18, fontWeight: "600", height: 48, padding: 0 },
  buyBtn: { height: 48, paddingHorizontal: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  buyBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  gramsPreview: { fontSize: 12, marginTop: 8 },
  quickAmounts: { flexDirection: "row", gap: 8, marginTop: 10 },
  quickAmt: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  resultText: { fontSize: 13, marginTop: 10, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 16, marginTop: 20, marginBottom: 12 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  actionCard: { width: (SW - 44) / 2, borderRadius: 14, padding: 16, borderWidth: 1 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  actionLabel: { fontSize: 14, fontWeight: "700" },
  actionSub: { fontSize: 12, marginTop: 2 },
  productCard: { width: 150, borderRadius: 14, padding: 12, borderWidth: 1 },
  productImg: { width: "100%", height: 80, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  productName: { fontSize: 13, fontWeight: "600" },
  productMeta: { fontSize: 11, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  infoCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14 },
  infoTitle: { fontSize: 14, fontWeight: "600" },
  infoSub: { fontSize: 12, marginTop: 2 },
});
