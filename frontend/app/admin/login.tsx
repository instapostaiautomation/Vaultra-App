import { useRouter } from "expo-router";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { adminText } from "@/src/components/AdminUI";
import { LogoMark } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { Button } from "@/src/components/ui";
import { api } from "@/src/api";
import { useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

export default function StaffLogin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { staff, signIn } = useStaff();
  const [sid, setSid] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (staff) router.replace("/admin/dashboard");
  }, [staff, router]);

  const login = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await api("/admin/login", { method: "POST", body: { staff_id: sid, pin }, auth: "none" });
      await signIn(r.access_token, r.staff);
      toast("success", `Welcome, ${r.staff.name}`, r.staff.role);
    } catch (e: any) {
      setErr(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="admin-login-screen">
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} testID="admin-login-back">
          <ArrowLeft size={22} color={colors.adminOnSurface} />
        </Pressable>
        <LogoMark size={52} />
        <Text style={styles.eyebrow}>VAULTRA STORE CONSOLE</Text>
        <Text style={styles.title}>Staff sign in</Text>
        <Text style={adminText.b}>Authorised store staff only. All actions are audited.</Text>

        <Text style={[adminText.label, { marginTop: 24, marginBottom: 8 }]}>Staff ID</Text>
        <TextInput
          testID="admin-staff-id-input"
          value={sid}
          onChangeText={(t) => setSid(t.toUpperCase())}
          autoCapitalize="characters"
          placeholder="STF001"
          placeholderTextColor={colors.adminMuted}
          style={adminText.input}
        />
        <Text style={[adminText.label, { marginTop: 16, marginBottom: 8 }]}>PIN</Text>
        <TextInput
          testID="admin-pin-input"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••"
          placeholderTextColor={colors.adminMuted}
          style={[adminText.input, { letterSpacing: 8, fontFamily: fonts.bold }]}
        />
        {err ? <Text style={styles.err} testID="admin-login-error">{err}</Text> : null}
        <Button title="Unlock Console" size="lg" loading={busy} disabled={!sid || pin.length < 4} onPress={login} style={{ marginTop: 24 }} icon={<KeyRound size={18} color={colors.onBrandPrimary} />} testID="admin-login-button" />

        <View style={styles.demo}>
          <ShieldCheck size={16} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.demoTitle}>Demo staff accounts</Text>
            <Text style={adminText.m}>STF001 / 1234 · HQ Admin (all stores)</Text>
            <Text style={adminText.m}>STF002 / 5678 · Tanishq Partner</Text>
            <Text style={adminText.m}>STF003 / 2468 · Malabar Partner</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  back: { width: 44, height: 44, justifyContent: "center", marginBottom: 16 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: colors.brandPrimary, marginTop: 20 },
  title: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -1, color: colors.adminOnSurface, marginTop: 4, marginBottom: 6 },
  err: { fontFamily: fonts.medium, fontSize: 13, color: "#F87171", marginTop: 12 },
  demo: { flexDirection: "row", gap: 12, marginTop: 32, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, backgroundColor: colors.adminSurfaceSecondary },
  demoTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.adminOnSurface, marginBottom: 4 },
});
