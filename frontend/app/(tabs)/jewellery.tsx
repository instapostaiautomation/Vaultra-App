import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { CATEGORIES } from "@/src/assets";
import { LiveTicker, ScreenHeader } from "@/src/components/Header";
import { Product, ProductCard, RedeemSheet } from "@/src/components/Product";
import { Button, Chip, ChipRow } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { colors, fonts } from "@/src/theme";

export default function Jewellery() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { width } = useWindowDimensions();
  const [cat, setCat] = useState<string>("all");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const cols = width > 700 ? 3 : 2;
  const cardW = Math.floor((Math.min(width, 960) - 32 - 12 * (cols - 1)) / cols);

  useEffect(() => {
    if (params.category) setCat(params.category);
  }, [params.category]);

  const load = () => {
    setError(false);
    api<Product[]>("/products", { auth: "none" })
      .then(setProducts)
      .catch(() => setError(true));
  };
  useEffect(load, []);

  const list = useMemo(() => (products || []).filter((p) => cat === "all" || p.category === cat), [products, cat]);

  return (
    <View style={styles.root} testID="jewellery-screen">
      <ScreenHeader title="Jewellery" subtitle="Redeem vault gold for hallmarked 24K pieces" />
      <ChipRow style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Chip label="All" selected={cat === "all"} onPress={() => setCat("all")} testID="jewellery-filter-all" />
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} selected={cat === c.id} onPress={() => setCat(c.id)} testID={`jewellery-filter-${c.id}`} />
        ))}
      </ChipRow>
      {error ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Couldn&apos;t load the catalogue</Text>
          <Button title="Retry" variant="outline" onPress={load} testID="jewellery-retry" />
        </View>
      ) : !products ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          key={cols}
          data={list}
          numColumns={cols}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomChrome + 24 }}
          ListHeaderComponent={
            <View style={styles.listHead}>
              <Text style={styles.count} testID="jewellery-count">
                {list.length} {list.length === 1 ? "piece" : "pieces"}
              </Text>
              <View style={{ flex: 1, maxWidth: 240 }}>
                <LiveTicker testID="jewellery-ticker" />
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>No pieces in this category yet</Text>}
          renderItem={({ item }) => <ProductCard p={item} width={cardW} onRedeem={(x) => setTarget({ kind: "product", product: x })} />}
        />
      )}
      <RedeemSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, textAlign: "center", marginTop: 24 },
});
