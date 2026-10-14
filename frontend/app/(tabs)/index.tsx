import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ArrowRight, Gift, HelpCircle, ShieldCheck, Truck, TrendingUp } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { CATEGORIES, IMAGES } from "@/src/assets";
import { BannerCarousel } from "@/src/components/BannerCarousel";
import { BuyWidget } from "@/src/components/BuyWidget";
import { HomeHeader } from "@/src/components/Header";
import { PriceAlertBanner, PriceAlertCard } from "@/src/components/PriceAlert";
import { Product, ProductCard, RedeemSheet } from "@/src/components/Product";
import { usesNativeTabs } from "@/src/navigation";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh, token } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  useEffect(() => {
    api<Product[]>("/products", { auth: "none" }).then(setProducts).catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (token) await refresh();
    setRefreshing(false);
  };

  return (
    <View style={styles.root} testID="home-screen">
      <HomeHeader />
      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomChrome + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        keyboardShouldPersistTaps="handled"
      >
        <PriceAlertBanner />
        <Animated.View entering={FadeInDown.duration(400)}>
          <BannerCarousel />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginTop: 20 }}>
          <BuyWidget />
        </Animated.View>

        <View style={styles.trust}>
          {[
            { Icon: ShieldCheck, t: "LBMA 99.9%" },
            { Icon: Truck, t: "BRINK'S insured" },
            { Icon: TrendingUp, t: "Sell anytime" },
          ].map(({ Icon, t }) => (
            <View key={t} style={styles.trustItem}>
              <Icon size={16} color={colors.brandSecondary} />
              <Text style={styles.trustText}>{t}</Text>
            </View>
          ))}
        </View>
        <PriceAlertCard />

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              testID={`category-${c.id}`}
              onPress={() => router.push({ pathname: "/jewellery", params: { category: c.id } })}
              style={styles.cat}
            >
              <View style={styles.catImg}>
                <Image source={IMAGES[c.image]} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <Text style={styles.catLabel} numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Trending Jewellery</Text>
          <Pressable onPress={() => router.push("/jewellery")} style={styles.seeAll} testID="see-all-jewellery">
            <Text style={styles.seeAllText}>See all</Text>
            <ArrowRight size={14} color={colors.brandSecondary} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} width={196} onRedeem={(x) => setTarget({ kind: "product", product: x })} />
          ))}
        </ScrollView>

        <Pressable style={styles.sipPromo} onPress={() => router.push("/sip")} testID="home-sip-promo">
          <View style={{ flex: 1 }}>
            <Text style={styles.sipEyebrow}>AUTO SIP</Text>
            <Text style={styles.sipTitle}>Save in gold daily from ₹100</Text>
            <Text style={styles.sipSub}>UPI AutoPay · Pause or cancel anytime</Text>
          </View>
          <View style={styles.sipArrow}>
            <ArrowRight size={20} color={colors.onBrandPrimary} />
          </View>
        </Pressable>

        <Pressable style={styles.giftPromo} onPress={() => router.push("/gift")} testID="home-gift-promo">
          <View style={styles.giftIcon}>
            <Gift size={22} color={colors.giftDiwaliAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.giftTitle}>Gift Gold</Text>
            <Text style={styles.giftSub}>Send grams to any phone with a greeting card</Text>
          </View>
          <ArrowRight size={18} color={colors.giftDiwaliAccent} />
        </Pressable>

        <Pressable style={styles.faqRow} onPress={() => router.push("/faq")} testID="home-faq-link">
          <HelpCircle size={20} color={colors.onSurfaceTertiary} />
          <Text style={styles.faqText}>Frequently asked questions</Text>
          <ArrowRight size={16} color={colors.muted} />
        </Pressable>
      </ScrollView>
      <RedeemSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  trust: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 16, marginTop: 16 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceTertiary },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 32, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.black, fontSize: 20, letterSpacing: -0.6, color: colors.onSurface },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  seeAllText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandSecondary },
  cat: { alignItems: "center", width: 72 },
  catImg: { width: 68, height: 68, borderRadius: 34, overflow: "hidden", borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary },
  catLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurface, marginTop: 6 },
  sipPromo: {
    marginHorizontal: 16,
    marginTop: 32,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sipEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: colors.brandPrimary, letterSpacing: 1 },
  sipTitle: { fontFamily: fonts.black, fontSize: 18, color: colors.onSurfaceInverse, letterSpacing: -0.4, marginTop: 4 },
  sipSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedLight, marginTop: 4 },
  sipArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  giftPromo: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: colors.giftDiwali },
  giftIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.overlayLight, alignItems: "center", justifyContent: "center" },
  giftTitle: { fontFamily: fonts.black, fontSize: 17, color: colors.onSurfaceInverse, letterSpacing: -0.4 },
  giftSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.giftDiwaliAccent, marginTop: 2 },
  faqRow: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
});
