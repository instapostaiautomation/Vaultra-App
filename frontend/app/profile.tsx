import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, BadgeCheck, Gift, HelpCircle, LogOut, Moon, ShieldCheck, Sun, User, Users, Wallet } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { LogoMark } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { Button, Card, Row, StatusBadge } from "@/src/components/ui";
import { grams, maskPhone, shortDate } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, token, signOut, refresh, tenantName } = useApp();
  const { scheme, toggle: toggleTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !fullName) setFullName(user.name);
  }, [user, fullName]);

  const submitKyc = async () => {
    setBusy(true);
    try {
      await api("/kyc/submit", { method: "POST", body: { full_name: fullName.trim(), aadhaar, pan, dob } });
      await refresh();
      toast("success", "KYC submitted", "A store officer will review it shortly");
    } catch (e: any) {
      toast("error", "KYC submission failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = fullName.trim().length > 1 && aadhaar.length === 12 && /^[A-Z]{5}\d{4}[A-Z]$/.test(pan);
  const kyc = user?.kyc_status ?? "not_submitted";

  if (!token) {
    return (
      <View style={styles.root} testID="profile-screen">
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} testID="profile-back-button">
            <ArrowLeft size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.guestContainer}>
          <LogoMark size={64} />
          <Text style={styles.guestTitle}>Welcome to {tenantName || "Digital Gold"}</Text>
          <Text style={styles.guestSub}>Sign in or create an account to buy, sell and store 24K gold securely.</Text>
          <Button title="Log in or Sign up" size="lg" onPress={() => router.push("/login")} style={{ alignSelf: "stretch", marginTop: 24 }} testID="profile-signin-button" icon={<User size={18} color={colors.onBrandPrimary} />} />
          <Text style={styles.guestHint}>By continuing, you agree to our Terms of Use and Privacy Policy</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} testID="profile-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <User size={24} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="profile-name">{user?.name}</Text>
              <Text style={styles.meta}>{maskPhone(user?.phone)}</Text>
              {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
            </View>
            <StatusBadge status={kyc} testID="profile-kyc-status" />
          </View>
          <View style={{ marginTop: 12 }}>
            <Row label="Gold balance" value={grams(user?.gold_grams)} />
            {(user?.silver_grams ?? 0) > 0 ? <Row label="Silver balance" value={grams(user?.silver_grams)} /> : null}
            <Row label="Member since" value={shortDate(user?.created_at)} />
          </View>
        </Card>

        {/* Day / Night Theme */}
        <Card testID="theme-card">
          <View style={styles.themeRow}>
            {scheme === "dark" ? <Moon size={20} color={colors.brandSecondary} /> : <Sun size={20} color={colors.brandSecondary} />}
            <Text style={styles.themeLabel}>Dark Mode</Text>
            <Switch
              value={scheme === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
              thumbColor={colors.surface}
              testID="theme-toggle"
            />
          </View>
        </Card>

        <Card testID="kyc-card">
          <View style={styles.kycHead}>
            <BadgeCheck size={20} color={colors.brandSecondary} />
            <Text style={styles.section}>KYC Verification</Text>
          </View>
          {kyc === "approved" ? (
            <Text style={styles.meta}>Verified. You can redeem gold and silver at the store.</Text>
          ) : kyc === "pending" ? (
            <Text style={styles.meta} testID="kyc-pending-text">Under review by store staff.</Text>
          ) : (
            <>
              <Text style={styles.meta}>{kyc === "rejected" ? "Rejected. Please resubmit." : "Required to redeem coins and jewellery."}</Text>
              <Text style={styles.label}>Full name (as on PAN)</Text>
              <TextInput testID="kyc-name-input" value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Full name" placeholderTextColor={colors.mutedLight} />
              <Text style={styles.label}>Aadhaar number</Text>
              <TextInput testID="kyc-aadhaar-input" value={aadhaar} onChangeText={(t) => setAadhaar(t.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" style={styles.input} placeholder="12-digit Aadhaar" placeholderTextColor={colors.mutedLight} />
              <Text style={styles.label}>PAN</Text>
              <TextInput testID="kyc-pan-input" value={pan} onChangeText={(t) => setPan(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} autoCapitalize="characters" style={styles.input} placeholder="ABCDE1234F" placeholderTextColor={colors.mutedLight} />
              <Text style={styles.label}>Date of birth</Text>
              <TextInput testID="kyc-dob-input" value={dob} onChangeText={setDob} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedLight} />
              <Button title="Submit KYC" loading={busy} disabled={!canSubmit} onPress={submitKyc} style={{ marginTop: 16 }} testID="kyc-submit-button" icon={<ShieldCheck size={18} color={colors.onBrandPrimary} />} />
            </>
          )}
        </Card>

        <View style={styles.links}>
          <Pressable style={styles.link} onPress={() => router.push("/referral")} testID="profile-referral-link">
            <Users size={20} color={colors.brandSecondary} />
            <Text style={styles.linkText}>Refer & Earn</Text>
            <ArrowRight size={16} color={colors.muted} />
          </Pressable>
          <Pressable style={styles.link} onPress={() => router.push("/gift")} testID="profile-gift-link">
            <Gift size={20} color={colors.onSurfaceTertiary} />
            <Text style={styles.linkText}>Gift Gold</Text>
            <ArrowRight size={16} color={colors.muted} />
          </Pressable>
          <Pressable style={[styles.link, { borderBottomWidth: 0 }]} onPress={() => router.push("/faq")} testID="profile-faq-link">
            <HelpCircle size={20} color={colors.onSurfaceTertiary} />
            <Text style={styles.linkText}>FAQ & Help</Text>
            <ArrowRight size={16} color={colors.muted} />
          </Pressable>
        </View>

        <Button title="Sign Out" variant="outline" icon={<LogOut size={18} color={colors.error} />} textStyle={{ color: colors.error }} onPress={async () => { await signOut(); toast("info", "Signed out"); router.replace("/"); }} testID="profile-signout-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  guestContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  guestTitle: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -1, color: colors.onSurface, textAlign: "center", marginTop: 20 },
  guestSub: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
  guestHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedLight, textAlign: "center", marginTop: 12 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  kycHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  section: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurfaceTertiary, marginTop: 12, marginBottom: 6 },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  themeLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  links: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  link: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.divider, minHeight: 56 },
  linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
});
