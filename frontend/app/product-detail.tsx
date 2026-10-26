import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Coins, Shield, Star, Truck } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { IMAGES } from "@/src/assets";
import { useToast } from "@/src/components/Toast";
import { RedeemSheet } from "@/src/components/Product";
import { Button } from "@/src/components/ui";
import { grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius } from "@/src/theme";

type ProductDetail = {
  id: string;
  name: string;
  category: string;
  grams: number;
  making_charges: number;
  image: string;
  tag: string;
  gold_value: number;
  total_price: number;
  live_rate: number;
  description: string;
  features: string[];
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { price, token } = useApp();
  const { width } = useWindowDimensions();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [target, setTarget] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api<ProductDetail>(`/products/${id}`, { auth: "none" })
      .then((p) => { setProduct(p); setLoading(false); })
      .catch(() => { setLoading(false); toast("error", "Product not found"); });
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Product not found</Text>
          <Button title="Go Back" variant="outline" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const imgW = Math.min(width, 600);
  const goldValue = price ? product.grams * price.buy : product.gold_value;
  const totalPrice = goldValue + product.making_charges;

  // Generate multiple image views from the same product image (simulating different angles)
  const productImages = [product.image, product.image, product.image, product.image];

  return (
    <View style={styles.root} testID="product-detail-screen">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="product-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={[styles.imageContainer, { height: imgW * 0.85 }]}>
          <Image
            source={IMAGES[productImages[activeImg]]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{product.tag}</Text>
          </View>
        </View>

        {/* Image Thumbnails */}
        <View style={styles.thumbRow}>
          {productImages.map((img, i) => (
            <Pressable
              key={i}
              onPress={() => setActiveImg(i)}
              style={[styles.thumb, activeImg === i && styles.thumbActive]}
            >
              <Image source={IMAGES[img]} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </Pressable>
          ))}
        </View>

        {/* Product Info */}
        <View style={styles.info}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category.toUpperCase()}</Text>
            </View>
            <View style={styles.purityBadge}>
              <Text style={styles.purityText}>24K · 99.9% Pure</Text>
            </View>
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {/* Pricing Card */}
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Weight</Text>
              <Text style={styles.priceValue}>{grams(product.grams, 1)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Gold Value (Live Rate)</Text>
              <Text style={styles.priceValue}>{inr(goldValue, 0)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Making Charges</Text>
              <Text style={styles.priceValue}>{inr(product.making_charges, 0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Price</Text>
              <Text style={styles.totalValue}>{inr(totalPrice, 0)}</Text>
            </View>
            <Text style={styles.rateHint}>
              Live 24K rate: {price ? inr(price.buy) : "—"}/g
            </Text>
          </View>

          {/* Features */}
          <Text style={styles.featuresTitle}>Product Highlights</Text>
          {product.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Check size={14} color={colors.success} />
              </View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Shield size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>BIS{"\n"}Hallmarked</Text>
            </View>
            <View style={styles.trustItem}>
              <Star size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>LBMA{"\n"}Certified</Text>
            </View>
            <View style={styles.trustItem}>
              <Truck size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>Insured{"\n"}Delivery</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaPrice}>{inr(totalPrice, 0)}</Text>
          <Text style={styles.ctaSub}>or {grams(product.grams, 1)} vault gold</Text>
        </View>
        <Button
          title="Redeem Now"
          onPress={() => {
            if (!token) {
              router.push("/login");
              return;
            }
            setTarget({ kind: "product", product });
          }}
          icon={<Coins size={18} color={colors.onBrandPrimary} />}
          style={{ flex: 1 }}
          testID="product-redeem-button"
        />
      </View>

      <RedeemSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface, textAlign: "center" },
  imageContainer: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  tagBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.onBrandPrimary, letterSpacing: 0.5 },
  thumbRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
  },
  thumbActive: {
    borderColor: colors.brandPrimary,
    borderWidth: 2.5,
  },
  info: { paddingHorizontal: 16 },
  productName: { fontFamily: fonts.black, fontSize: 24, letterSpacing: -0.8, color: colors.onSurface, marginBottom: 8 },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  categoryBadge: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryText: { fontFamily: fonts.bold, fontSize: 11, color: colors.onBrandTertiary, letterSpacing: 0.5 },
  purityBadge: {
    backgroundColor: colors.successTint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  purityText: { fontFamily: fonts.bold, fontSize: 11, color: colors.success, letterSpacing: 0.3 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted, marginBottom: 20 },
  priceCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  priceLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  priceValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  totalValue: { fontFamily: fonts.black, fontSize: 22, color: colors.brandSecondary, letterSpacing: -0.5 },
  rateHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 8, textAlign: "center" },
  featuresTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successTint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  trustRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
  },
  trustItem: { alignItems: "center", gap: 6 },
  trustText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onBrandTertiary, textAlign: "center" },
  bottomCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    ...cardShadow,
  },
  ctaPrice: { fontFamily: fonts.black, fontSize: 22, color: colors.onSurface, letterSpacing: -0.5 },
  ctaSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
