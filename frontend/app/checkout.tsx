import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { ArrowLeft } from "lucide-react-native";

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[ss.title, { color: colors.onSurface }]}>Checkout</Text>
      </View>
      <View style={ss.center}>
        <Text style={{ color: colors.muted, fontSize: 15 }}>
          Payment processing handled via mock confirmation.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
          Buy gold directly from the Home screen.
        </Text>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
});
