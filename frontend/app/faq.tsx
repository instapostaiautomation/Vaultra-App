import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";

const FAQS = [
  { q: "How does digital gold buying work?", a: "You pay any INR amount at the current live rate. You receive fractional grams of 24K gold in your digital vault. For example, ₹2,000 at ₹7,500/g gives you 0.2667g." },
  { q: "What is a Wallet ID?", a: "Your Wallet ID is a unique identifier shown in the app. When you visit the jeweller's shop for redemption, show this ID. The jeweller verifies it and gives you physical gold or jewellery." },
  { q: "How do I redeem physical gold?", a: "Accumulate the minimum grams set by your jeweller (usually 1g). Visit the physical shop, show your Wallet ID. The jeweller approves, and grams are deducted from your digital wallet." },
  { q: "Is my gold safe?", a: "Yes. All gold is 24K 99.9% pure, LBMA certified, and stored in secure vaults. Your holdings are tracked digitally and backed by physical procurement." },
  { q: "What is Gold SIP?", a: "Systematic Investment Plan lets you auto-buy gold daily, weekly, or monthly. Set an amount and the system buys gold at the live rate on each installment date." },
  { q: "How does the referral program work?", a: "Share your referral code with friends. When they sign up and enter your code, both of you get ₹50 referral bonus." },
  { q: "What are GST charges?", a: "3% GST is applied on gold purchases as per Indian tax law. This is added to your purchase amount." },
  { q: "Can I gift gold to someone?", a: "Yes! Use the Gift Gold feature to send gold to any phone number. They'll receive the gold in their digital vault." },
];

export default function FaqScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}><ArrowLeft size={24} color={colors.onSurface} /></TouchableOpacity>
        <Text style={[ss.title, { color: colors.onSurface }]}>FAQ</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {FAQS.map((f, i) => (
          <TouchableOpacity key={i} style={[ss.faqCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => setOpen(open === i ? null : i)}>
            <View style={ss.faqHeader}>
              <Text style={[ss.faqQ, { color: colors.onSurface }]}>{f.q}</Text>
              {open === i ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
            </View>
            {open === i && <Text style={[ss.faqA, { color: colors.muted }]}>{f.a}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  faqCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10 },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  faqQ: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  faqA: { fontSize: 13, lineHeight: 20, marginTop: 10 },
});
