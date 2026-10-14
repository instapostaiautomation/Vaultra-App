import * as Haptics from "expo-haptics";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius } from "@/src/theme";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; title: string; message?: string };

const ToastCtx = createContext<(kind: Kind, title: string, message?: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback((kind: Kind, title: string, message?: string) => {
    const id = ++idRef.current;
    setItems((s) => [...s.slice(-1), { id, kind, title, message }]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        kind === "error" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
          const tint = t.kind === "success" ? colors.success : t.kind === "error" ? colors.error : colors.brandPrimary;
          return (
            <Animated.View key={t.id} entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp} style={styles.toast} testID={`toast-${t.kind}`}>
              <Icon size={20} color={tint} strokeWidth={2.2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} testID="toast-title">{t.title}</Text>
                {t.message ? <Text style={styles.msg}>{t.message}</Text> : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, gap: 8, alignItems: "stretch", zIndex: 9999, elevation: 30 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  title: { color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: 14 },
  msg: { color: colors.mutedLight, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
});
