import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { api } from "@/src/api";
import { BANNERS as DEFAULT_BANNERS, IMAGES } from "@/src/assets";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

type Banner = { id: string; image?: string; image_url?: string; eyebrow?: string; title?: string; subtitle?: string; link?: string };
const LINK_ROUTES: Record<string, string> = { buy: "/", sip: "/sip", jewellery: "/jewellery", gift: "/gift", refer: "/referral" };
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export function BannerCarousel() {
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, 720) - 32;
  const ref = useRef<ScrollViewInstance>(null);
  const [idx, setIdx] = useState(0);
  const { tenant } = useApp();
  const router = useRouter();
  const [BANNERS, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  useEffect(() => {
    api<{ banners: Banner[] }>(`/content?jeweller_id=${tenant}`, { auth: "none" })
      .then((r) => setBanners(r.banners?.length ? r.banners : DEFAULT_BANNERS))
      .catch(() => {});
  }, [tenant]);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => {
        const n = (i + 1) % BANNERS.length;
        ref.current?.scrollTo({ x: n * (width + 16), animated: true });
        return n;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [width, BANNERS.length]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / (width + 16)));
  };

  return (
    <View testID="hero-banner-carousel">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled={false}
        snapToInterval={width + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}
      >
        {BANNERS.map((b) => (
          <Pressable key={b.id} style={[styles.banner, { width }]} testID={`banner-${b.id}`} disabled={!b.link || !LINK_ROUTES[b.link]} onPress={() => b.link && LINK_ROUTES[b.link] && router.push(LINK_ROUTES[b.link] as any)}>
            <Image source={b.image_url ? { uri: b.image_url.startsWith("/") ? BASE + b.image_url : b.image_url } : IMAGES[b.image || "banner-1"]} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient colors={["transparent", "rgba(17,24,39,0.88)"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.15 }} end={{ x: 0, y: 1 }} />
            <View style={styles.bannerBody}>
              {b.eyebrow ? (
                <View style={styles.eyebrow}>
                  <Text style={styles.eyebrowText}>{b.eyebrow}</Text>
                </View>
              ) : null}
              {b.title ? <Text style={styles.title}>{b.title}</Text> : null}
              {b.subtitle ? <Text style={styles.subtitle}>{b.subtitle}</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {BANNERS.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === idx && styles.dotOn]} testID={`banner-dot-${i}`} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 200,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInverse,
  },
  bannerBody: { position: "absolute", left: 16, right: 16, bottom: 16 },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  eyebrowText: { fontFamily: fonts.bold, fontSize: 10, color: colors.onBrandPrimary, letterSpacing: 0.8 },
  title: { fontFamily: fonts.black, fontSize: 20, lineHeight: 24, letterSpacing: -0.6, color: colors.onSurfaceInverse },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: "#F3E7C1", marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { width: 20, backgroundColor: colors.brandPrimary },
});
