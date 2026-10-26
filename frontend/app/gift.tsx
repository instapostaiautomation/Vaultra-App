import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Gift, Send, Smartphone } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { GIFT_THEMES, GiftCard } from "@/src/components/GiftCard";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet } from "@/src/components/ui";
import { dateTime, floor4, grams, inr, maskPhone } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

const GRAM_CHIPS = [0.1, 0.25, 0.5, 1];
const RUPEE_CHIPS = [501, 1001, 2100, 5100];

export default function GiftScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, user, vault, price, tenant, refresh } = useApp();
  const [theme, setTheme] = useState<string>("diwali");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"grams" | "rupees">("grams");
  const [value, setValue] = useState("0.1");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<any>(null);
  const [tab, setTab] = useState<"sent" | "received">("received");
  const [gifts, setGifts] = useState<{ sent: any[]; received: any[] }>({ sent: [], received: [] });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const g = await api("/gifts");
      setGifts(g);
      if (g.unseen) api("/gifts/mark-seen", { method: "POST" }).catch(() => {});
    } catch {}
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rate = price?.buy ?? 0;
  const v = parseFloat(value) || 0;
  const g = mode === "grams" ? floor4(v) : rate ? floor4(v / rate) : 0;
  const bal = vault?.user.gold_grams ?? 0;
  const valid = phone.length === 10 && g >= 0.001 && g <= bal + 1e-9;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api("/gifts", { method: "POST", body: { phone, recipient_name: name.trim() || undefined, mode, value: v, theme, message: message.trim(), tenant } });
      setSent(r);
      await refresh();
      load();
      toast("success", "Gift sent", `${grams(r.grams)} gold gifted to ${r.recipient_name}`);
    } catch (e: any) {
      toast("error", "Gift failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setSent(null);
    setPhone("");
    setName("");
    setMessage("");
    setValue(mode === "grams" ? "0.1" : "501");
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  if (!token) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]} testID="gift-screen">
        <Pressable onPress={goBack} style={[styles.back, { marginLeft: 16 }]} testID="gift-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.center}>
          <Gift size={36} color={colors.brandSecondary} />
          <Text style={styles.h1}>Gift pure 24K gold</Text>
          <Text style={styles.muted}>Sign in to send gold to anyone with a phone number.</Text>
          <Button title="Sign In" onPress={() => router.push("/login")} style={{ alignSelf: "stretch" }} testID="gift-signin-button" />
        </View>
      </View>
    );
  }

  const list = tab === "sent" ? gifts.sent : gifts.received;

  return (
    <View style={styles.root} testID="gift-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} style={styles.back} testID="gift-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Gift Gold</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <GiftCard theme={theme} g={g} to={name.trim() || undefined} from={user?.name?.split(" ")[0]} message={message.trim() || undefined} testID="gift-card-preview" />

        <Text style={styles.label}>Greeting card</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          {GIFT_THEMES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTheme(t.id)}
              style={[styles.theme, { backgroundColor: t.bg, borderColor: theme === t.id ? colors.brandPrimary : "transparent" }]}
              testID={`gift-theme-${t.id}`}
            >
              <t.Icon size={18} color={t.accent} />
              <Text style={styles.themeText}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Recipient mobile</Text>
        <View style={styles.field}>
          <Smartphone size={18} color={colors.muted} />
          <Text style={styles.cc}>+91</Text>
          <TextInput
            testID="gift-phone-input"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="phone-pad"
            placeholder="98765 43210"
            placeholderTextColor={colors.mutedLight}
            style={styles.input}
          />
        </View>
        <TextInput
          testID="gift-name-input"
          value={name}
          onChangeText={setName}
          placeholder="Recipient name (shown on card)"
          placeholderTextColor={colors.mutedLight}
          style={[styles.field, { marginTop: 8, fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface }]}
        />

        <View style={styles.amountHead}>
          <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>Gift amount</Text>
          <View style={styles.toggle}>
            {(["grams", "rupees"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setValue(m === "grams" ? "0.1" : "501");
                }}
                style={[styles.tBtn, mode === m && styles.tOn]}
                testID={`gift-mode-${m}`}
              >
                <Text style={[styles.tText, mode === m && { color: colors.onSurfaceInverse }]}>{m === "grams" ? "Grams" : "Rupees"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.field, { borderColor: colors.brandPrimary }]}>
          <Text style={styles.prefix}>{mode === "grams" ? "g" : "₹"}</Text>
          <TextInput
            testID="gift-amount-input"
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            style={[styles.input, { fontSize: 20, fontFamily: fonts.bold }]}
          />
          <Text style={styles.conv} testID="gift-converted">
            {mode === "grams" ? `≈ ${inr(g * rate)}` : grams(g)}
          </Text>
        </View>
        <View style={styles.chips}>
          {(mode === "grams" ? GRAM_CHIPS : RUPEE_CHIPS).map((c) => (
            <Pressable key={c} onPress={() => setValue(String(c))} style={styles.chip} testID={`gift-chip-${c}`}>
              <Text style={styles.chipText}>{mode === "grams" ? `${c}g` : `₹${c.toLocaleString("en-IN")}`}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.muted} testID="gift-balance">
          Vault balance {grams(bal)}
          {g > bal ? " · insufficient gold" : ""}
        </Text>

        <Text style={styles.label}>Personal message</Text>
        <TextInput
          testID="gift-message-input"
          value={message}
          onChangeText={(t) => setMessage(t.slice(0, 240))}
          placeholder="May this gold bring you prosperity…"
          placeholderTextColor={colors.mutedLight}
          multiline
          style={[styles.field, styles.input, { height: 88, paddingHorizontal: 16, paddingTop: 12, textAlignVertical: "top" }]}
        />

        <Button title={`Send ${grams(g)} Gift`} size="lg" loading={busy} disabled={!valid} onPress={send} icon={<Send size={18} color={colors.onBrandPrimary} />} style={{ marginTop: 16 }} testID="gift-send-button" />
        {g > bal ? (
          <Pressable onPress={() => router.replace("/")} style={{ alignSelf: "center", padding: 12 }} testID="gift-buy-more">
            <Text style={styles.link}>Buy more gold first</Text>
          </Pressable>
        ) : null}

        <View style={styles.histHead}>
          <Text style={styles.h2}>Your gifts</Text>
          <View style={styles.toggle}>
            {(["received", "sent"] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tBtn, tab === t && styles.tOn]} testID={`gift-history-${t}`}>
                <Text style={[styles.tText, tab === t && { color: colors.onSurfaceInverse }]}>
                  {t === "received" ? `Received (${gifts.received.length})` : `Sent (${gifts.sent.length})`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {list.length === 0 ? (
          <Text style={[styles.muted, { textAlign: "center", paddingVertical: 24 }]} testID="gift-history-empty">
            {tab === "received" ? "No gifts received yet" : "You haven't sent any gifts yet"}
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {list.map((x) => (
              <View key={x.id} testID={`gift-history-item-${x.id}`}>
                <GiftCard
                  compact
                  theme={x.theme}
                  g={x.grams}
                  to={tab === "sent" ? x.recipient_name : undefined}
                  from={tab === "received" ? x.sender_name : undefined}
                  message={x.message || undefined}
                />
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  {tab === "sent" ? `To ${maskPhone(x.recipient_phone)}` : `From ${maskPhone(x.sender_phone)}`} · {dateTime(x.created_at)} · {inr(x.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>

      <Sheet visible={!!sent} onClose={resetForm} testID="gift-success-sheet">
        {sent ? (
          <View style={{ paddingBottom: 8, paddingTop: 8 }}>
            <Animated.View entering={ZoomIn.springify()}>
              <GiftCard theme={sent.theme} g={sent.grams} to={sent.recipient_name} from={sent.sender_name?.split(" ")[0]} message={sent.message || undefined} />
            </Animated.View>
            <Text style={[styles.h2, { marginTop: 16 }]} testID="gift-success-title">
              Gift delivered!
            </Text>
            <Text style={styles.muted}>{sent.recipient_name} can see it in their vault by signing in with {maskPhone(sent.recipient_phone)}.</Text>
            <View style={{ marginTop: 12 }}>
              <Row label="Gold gifted" value={grams(sent.grams)} />
              <Row label="Value" value={inr(sent.amount)} bold />
            </View>
            <Button title="Done" variant="dark" onPress={resetForm} style={{ marginTop: 16 }} testID="gift-success-done" />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  h1: { fontFamily: fonts.black, fontSize: 24, letterSpacing: -0.8, color: colors.onSurface },
  h2: { fontFamily: fonts.black, fontSize: 20, letterSpacing: -0.6, color: colors.onSurface },
  muted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 20, marginBottom: 8 },
  theme: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 2, flexShrink: 0 },
  themeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceInverse },
  field: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, backgroundColor: colors.surface },
  cc: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface, height: 48 },
  prefix: { fontFamily: fonts.bold, fontSize: 20, color: colors.brandSecondary },
  conv: { flexShrink: 0, marginLeft: 8, fontFamily: fonts.bold, fontSize: 14, color: colors.onBrandTertiary },
  amountHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 8 },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 3 },
  tBtn: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: "center" },
  tOn: { backgroundColor: colors.surfaceInverse },
  tText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  chips: { flexDirection: "row", gap: 8, marginVertical: 12 },
  chip: { flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "#F0E2B0", alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onBrandTertiary },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandSecondary },
  histHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 32, marginBottom: 12 },
});
