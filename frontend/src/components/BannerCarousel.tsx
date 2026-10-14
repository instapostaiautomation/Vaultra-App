import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { BANNERS, IMAGES } from "@/src/assets";
import { colors, fonts, radius } from "@/src/theme";

export function BannerCarousel() {
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, 720) - 32;
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => {
        const n = (i + 1) % BANNERS.length;
        ref.current?.scrollTo({ x: n * (width + 12), animated: true });
        return n;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / (width + 12)));
  };

  return (
    <View testID="hero-banner-carousel">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled={false}
        snapToInterval={width + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {BANNERS.map((b) => (
          <View key={b.id} style={[styles.banner, { width }]} testID={`banner-${b.id}`}>
            <Image source={IMAGES[b.image]} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient colors={["transparent", "rgba(17,24,39,0.88)"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.15 }} end={{ x: 0, y: 1 }} />
            <View style={styles.bannerBody}>
              <View style={styles.eyebrow}>
                <Text style={styles.eyebrowText}>{b.eyebrow}</Text>
              </View>
              <Text style={styles.title}>{b.title}</Text>
              <Text style={styles.subtitle}>{b.subtitle}</Text>
            </View>
          </View>
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
    height: 184,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
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
