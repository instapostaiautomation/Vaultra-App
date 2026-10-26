import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { ArrowLeft, Send } from "lucide-react-native";

const THEMES = ["diwali", "birthday", "wedding", "thank_you", "congrats"];
const THEME_EMOJIS: Record<string, string> = { diwali: "🪔", birthday: "🎂", wedding: "💍", thank_you: "🙏", congrats: "🎉" };

export default function GiftScreen() {
  const { colors } = useTheme();
  const { price, refreshUser } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [theme, setTheme] = useState("diwali");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const grams = price?.buy && amount ? (parseFloat(amount) / price.buy) : 0;

  const send = async () => {
    if (phone.replace(/\D/g, "").length < 10) { Alert.alert("Error", "Enter a valid phone number"); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert("Error", "Enter an amount"); return; }
    setLoading(true);
    try {
      await api("/gifts", { method: "POST", body: { phone, mode: "rupees", value: parseFloat(amount), theme, message } });
      Alert.alert("Gift Sent!", `${grams.toFixed(4)}g gold sent successfully!`);
      refreshUser();
      router.back();
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={[ss.flex, { backgroundColor: colors.surface }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}><ArrowLeft size={24} color={colors.onSurface} /></TouchableOpacity>
        <Text style={[ss.title, { color: colors.onSurface }]}>Gift Gold</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={[ss.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[ss.label, { color: colors.muted }]}>Recipient Phone</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="10-digit phone" keyboardType="phone-pad" maxLength={10}
            style={[ss.input, { color: colors.onSurface, borderColor: colors.border }]} placeholderTextColor={colors.mutedLight} />
          <Text style={[ss.label, { color: colors.muted, marginTop: 14 }]}>Amount (₹)</Text>
          <TextInput value={amount} onChangeText={setAmount} placeholder="Enter amount" keyboardType="numeric"
            style={[ss.input, { color: colors.onSurface, borderColor: colors.border }]} placeholderTextColor={colors.mutedLight} />
          {grams > 0 && <Text style={[ss.estimate, { color: colors.muted }]}>≈ {grams.toFixed(4)}g gold</Text>}
          <Text style={[ss.label, { color: colors.muted, marginTop: 14 }]}>Theme</Text>
          <View style={ss.themeRow}>
            {THEMES.map(t => (
              <TouchableOpacity key={t} style={[ss.themeBtn, { borderColor: theme === t ? colors.brand : colors.border, backgroundColor: theme === t ? colors.brandTertiary : "transparent" }]} onPress={() => setTheme(t)}>
                <Text style={{ fontSize: 20 }}>{THEME_EMOJIS[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[ss.label, { color: colors.muted, marginTop: 14 }]}>Message (optional)</Text>
          <TextInput value={message} onChangeText={setMessage} placeholder="Write a message..." multiline style={[ss.input, ss.msgInput, { color: colors.onSurface, borderColor: colors.border }]} placeholderTextColor={colors.mutedLight} />
          <TouchableOpacity style={[ss.sendBtn, { backgroundColor: colors.brand }]} onPress={send} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <><Send size={18} color="#FFF" /><Text style={ss.sendBtnText}>Send Gift</Text></>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  card: { borderRadius: 16, padding: 20, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 16, marginTop: 6 },
  msgInput: { height: 80, textAlignVertical: "top", paddingTop: 12 },
  estimate: { fontSize: 12, marginTop: 6 },
  themeRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  themeBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  sendBtn: { height: 52, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 },
  sendBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
