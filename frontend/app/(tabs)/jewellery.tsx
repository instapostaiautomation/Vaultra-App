import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { api } from "@/src/api";
import { ShoppingBag } from "lucide-react-native";

const { width: SW } = Dimensions.get("window");
const CARD_W = (SW - 48) / 2;

function inr(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function JewelleryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api<any[]>("/products", { auth: "none" }).then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const categories = ["all", ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = filter === "all" ? products : products.filter(p => p.category === filter);

  if (loading) return <View style={[ss.center, { backgroundColor: colors.surface }]}><ActivityIndicator size="large" color={colors.brand} /></View>;

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={[ss.title, { color: colors.onSurface }]}>Jewellery Catalog</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.filterRow}>
        {categories.map(c => (
          <TouchableOpacity
            key={c}
            style={[ss.filterBtn, { backgroundColor: filter === c ? colors.brand : colors.surfaceSecondary, borderColor: filter === c ? colors.brand : colors.border }]}
            onPress={() => setFilter(c)}
          >
            <Text style={{ color: filter === c ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>
              {c === "all" ? "All" : c.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={ss.grid}>
        {filtered.map(p => (
          <TouchableOpacity key={p.id} style={[ss.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => router.push(`/product-detail?id=${p.id}`)}>
            <View style={[ss.cardImg, { backgroundColor: colors.brandTertiary }]}>
              <ShoppingBag size={32} color={colors.brand} />
              {p.tag ? <View style={[ss.tagBadge, { backgroundColor: colors.brand }]}><Text style={ss.tagText}>{p.tag}</Text></View> : null}
            </View>
            <View style={ss.cardBody}>
              <Text style={[ss.cardName, { color: colors.onSurface }]} numberOfLines={2}>{p.name}</Text>
              <Text style={[ss.cardMeta, { color: colors.muted }]}>{p.grams}g · {p.category}</Text>
              <Text style={[ss.cardPrice, { color: colors.brand }]}>{inr(p.total_price)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800" },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, paddingBottom: 32 },
  card: { width: CARD_W, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardImg: { width: "100%", height: 120, justifyContent: "center", alignItems: "center" },
  tagBadge: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  cardBody: { padding: 12 },
  cardName: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardMeta: { fontSize: 11, marginTop: 4 },
  cardPrice: { fontSize: 15, fontWeight: "700", marginTop: 6 },
});
