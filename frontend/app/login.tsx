import { useRouter } from "expo-router";
import { ArrowLeft, KeyRound, ShieldCheck, Smartphone } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { LogoMark } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { Button } from "@/src/components/ui";
import { TENANT_NAME } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signIn, tenant } = useApp();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const request = async () => {
    setErr("");
    setBusy(true);
    try {
      const c = await api("/auth/otp/request", { method: "POST", body: { phone }, auth: "none" });
      setChallenge(c);
      setOtp("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await api("/auth/otp/verify", { method: "POST", body: { challenge_id: challenge.challenge_id, otp, tenant, name }, auth: "none" });
      await signIn(r.access_token, r.user);
      toast("success", `Welcome, ${r.user.name.split(" ")[0]}`, "Your gold vault is ready");
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (challenge ? setChallenge(null) : router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} testID="login-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <LogoMark size={52} />
        <Text style={styles.title}>{challenge ? "Verify your number" : "Sign in to your gold vault"}</Text>
        <Text style={styles.sub}>
          {challenge ? `Enter the 6-digit code sent to +91 ${phone}` : `Secure phone login · ${TENANT_NAME[tenant]}`}
        </Text>

        {!challenge ? (
          <>
            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.field}>
              <Smartphone size={18} color={colors.muted} />
              <Text style={styles.cc}>+91</Text>
              <TextInput
                testID="login-phone-input"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="98765 43210"
                placeholderTextColor={colors.mutedLight}
                style={styles.input}
                autoFocus
              />
            </View>
            <Text style={styles.hint}>Demo customer: 9876543210 (has gold, KYC approved)</Text>
            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}
            <Button title="Send OTP" size="lg" loading={busy} disabled={phone.length !== 10} onPress={request} style={{ marginTop: 16 }} testID="login-send-otp-button" />
          </>
        ) : (
          <>
            <View style={styles.demo} testID="login-demo-otp-banner">
              <KeyRound size={18} color={colors.onBrandTertiary} />
              <Text style={styles.demoText}>
                Demo OTP: <Text style={styles.demoCode} testID="login-demo-otp">{challenge.demo_otp}</Text>
              </Text>
              <Pressable onPress={() => setOtp(challenge.demo_otp)} testID="login-autofill-otp" style={styles.fill}>
                <Text style={styles.fillText}>Autofill</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>One-time password</Text>
            <TextInput
              testID="login-otp-input"
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              placeholder="••••••"
              placeholderTextColor={colors.mutedLight}
              style={[styles.field, styles.otp]}
              autoFocus
              maxLength={6}
            />
            {challenge.is_new_user ? (
              <>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  testID="login-name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  placeholderTextColor={colors.mutedLight}
                  style={[styles.field, styles.input, { paddingHorizontal: 16 }]}
                />
              </>
            ) : null}
            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}
            <Button title="Verify & Continue" size="lg" loading={busy} disabled={otp.length !== 6} onPress={verify} style={{ marginTop: 16 }} testID="login-verify-button" />
            <Pressable onPress={request} style={styles.resend} testID="login-resend-otp">
              <Text style={styles.resendText}>Resend OTP</Text>
            </Pressable>
          </>
        )}
        <View style={styles.secure}>
          <ShieldCheck size={16} color={colors.success} />
          <Text style={styles.secureText}>256-bit encrypted · RBI-compliant KYC partners</Text>
        </View>
        <Pressable onPress={() => router.push("/admin/login")} style={styles.resend} testID="login-staff-portal-link">
          <Text style={styles.resendText}>Store staff? Open Admin Panel →</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  back: { width: 44, height: 44, justifyContent: "center", marginBottom: 16 },
  title: { fontFamily: fonts.black, fontSize: 28, letterSpacing: -1, color: colors.onSurface, marginTop: 20 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurfaceTertiary, marginBottom: 8, marginTop: 12 },
  field: { flexDirection: "row", alignItems: "center", gap: 8, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 16, backgroundColor: colors.surface },
  cc: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.onSurface, height: 52 },
  otp: { fontFamily: fonts.black, fontSize: 26, letterSpacing: 10, color: colors.onSurface, textAlign: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 8 },
  err: { fontFamily: fonts.medium, fontSize: 13, color: colors.error, marginTop: 12 },
  demo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: "#F0E2B0" },
  demoText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.onBrandTertiary },
  demoCode: { fontFamily: fonts.black, letterSpacing: 2 },
  fill: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  fillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrandPrimary },
  resend: { alignSelf: "center", padding: 12, marginTop: 8 },
  resendText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brandSecondary },
  secure: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 32 },
  secureText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
