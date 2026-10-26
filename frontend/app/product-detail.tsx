import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { ArrowLeft, ShoppingBag, Check } from "lucide-react-native";

function inr(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function ProductDetailScreen() {
  const { colors } = useTheme();
  const { isLoggedIn } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) api(`/products/${id}`, { auth: "none" }).then(setProduct).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={[ss.center, { backgroundColor: colors.surface }]}><ActivityIndicator size="large" color={colors.brand} /></View>;
  if (!product) return <View style={[ss.center, { backgroundColor: colors.surface }]}><Text style={{ color: colors.muted }}>Product not found</Text></View>;

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
        <View style={[ss.imgSection, { backgroundColor: colors.brandTertiary }]}>
          <ShoppingBag size={64} color={colors.brand} />
        </View>
        <View style={{ padding: 16 }}>
          {product.tag && <View style={[ss.tagBadge, { backgroundColor: colors.brand }]}><Text style={ss.tagText}>{product.tag}</Text></View>}
          <Text style={[ss.productName, { color: colors.onSurface }]}>{product.name}</Text>
          <Text style={[ss.productCategory, { color: colors.muted }]}>{product.category} · {product.grams}g</Text>
          <View style={[ss.priceCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={ss.priceRow}><Text style={[ss.priceLabel, { color: colors.muted }]}>Gold Value ({product.grams}g)</Text><Text style={[ss.priceValue, { color: colors.onSurface }]}>{inr(product.gold_value)}</Text></View>
            <View style={ss.priceRow}><Text style={[ss.priceLabel, { color: colors.muted }]}>Making Charges</Text><Text style={[ss.priceValue, { color: colors.onSurface }]}>{inr(product.making_charges)}</Text></View>
            <View style={[ss.divider, { backgroundColor: colors.divider }]} />
            <View style={ss.priceRow}><Text style={[ss.totalLabel, { color: colors.brand }]}>Total Price</Text><Text style={[ss.totalValue, { color: colors.brand }]}>{inr(product.total_price)}</Text></View>
            <Text style={[ss.rateNote, { color: colors.muted }]}>Live rate: {inr(product.live_rate)}/g</Text>
          </View>
          {product.description && <Text style={[ss.description, { color: colors.onSurface }]}>{product.description}</Text>}
          {product.features?.map((f: string, i: number) => (
            <View key={i} style={ss.featureRow}>
              <Check size={16} color={colors.success} />
              <Text style={[ss.featureText, { color: colors.onSurface }]}>{f}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[ss.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[ss.redeemBtn, { backgroundColor: isLoggedIn ? colors.brand : colors.muted }]}
          onPress={() => isLoggedIn ? router.push("/(tabs)/vault") : router.push("/login")}
        >
          <Text style={ss.redeemBtnText}>{isLoggedIn ? "Redeem from Vault" : "Login to Redeem"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  imgSection: { width: "100%", height: 250, justifyContent: "center", alignItems: "center" },
  tagBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  tagText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  productName: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  productCategory: { fontSize: 14, marginTop: 4, textTransform: "capitalize" },
  priceCard: { marginTop: 20, borderRadius: 14, padding: 16, borderWidth: 1 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 14, fontWeight: "600" },
  divider: { height: 1, marginVertical: 8 },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "800" },
  rateNote: { fontSize: 11, marginTop: 6 },
  description: { fontSize: 14, lineHeight: 22, marginTop: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  featureText: { fontSize: 14 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  redeemBtn: { height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  redeemBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
