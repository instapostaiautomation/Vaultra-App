import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { ArrowLeft, Phone, Lock } from "lucide-react-native";

type Step = "phone" | "otp" | "register";

export default function LoginScreen() {
  const { colors } = useTheme();
  const { requestOtp, login } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Registration fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const handlePhoneSubmit = async () => {
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true); setError("");
    try {
      const resp = await requestOtp(phone);
      setChallengeId(resp.challenge_id);
      setDemoOtp(resp.demo_otp);
      setIsNew(resp.is_new_user);
      setOtp(resp.demo_otp); // Auto-fill demo OTP
      setStep("otp");
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    if (isNew) { setStep("register"); return; }
    setLoading(true); setError("");
    try {
      await login(challengeId, otp);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!firstName.trim()) { setError("First name is required"); return; }
    setLoading(true); setError("");
    try {
      await login(challengeId, otp, {
        first_name: firstName, last_name: lastName,
        email, dob, gender, referral_code: referralCode,
      });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const goBack = () => {
    if (step === "register") setStep("otp");
    else if (step === "otp") setStep("phone");
    else router.back();
  };

  return (
    <KeyboardAvoidingView style={[ss.flex, { backgroundColor: colors.surface }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
          <TouchableOpacity onPress={goBack} style={ss.backBtn}>
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>

          <Text style={[ss.title, { color: colors.brand, marginTop: 24 }]}>
            {step === "phone" ? "Welcome" : step === "otp" ? "Verify OTP" : "Create Account"}
          </Text>
          <Text style={[ss.subtitle, { color: colors.muted }]}>
            {step === "phone" ? "Enter your phone number to get started" :
             step === "otp" ? `OTP sent to +91 ${phone}` :
             "Complete your profile to start investing"}
          </Text>

          {error ? <Text style={[ss.error, { color: colors.error }]}>{error}</Text> : null}

          {step === "phone" && (
            <View style={ss.formSection}>
              <View style={[ss.inputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                <Phone size={20} color={colors.muted} />
                <Text style={[ss.prefix, { color: colors.onSurface }]}>+91</Text>
                <TextInput
                  value={phone} onChangeText={setPhone}
                  placeholder="Phone number" keyboardType="phone-pad"
                  maxLength={10} style={[ss.input, { color: colors.onSurface }]}
                  placeholderTextColor={colors.mutedLight} autoFocus
                />
              </View>
              <TouchableOpacity style={[ss.primaryBtn, { backgroundColor: colors.brand }]} onPress={handlePhoneSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={ss.primaryBtnText}>Get OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === "otp" && (
            <View style={ss.formSection}>
              <View style={[ss.demoBanner, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>Demo OTP: {demoOtp}</Text>
              </View>
              <View style={[ss.inputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                <Lock size={20} color={colors.muted} />
                <TextInput
                  value={otp} onChangeText={setOtp}
                  placeholder="6-digit OTP" keyboardType="number-pad"
                  maxLength={6} style={[ss.input, { color: colors.onSurface, letterSpacing: 8, fontSize: 22 }]}
                  placeholderTextColor={colors.mutedLight} autoFocus
                />
              </View>
              <TouchableOpacity style={[ss.primaryBtn, { backgroundColor: colors.brand }]} onPress={handleOtpSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={ss.primaryBtnText}>{isNew ? "Next" : "Verify & Login"}</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === "register" && (
            <View style={ss.formSection}>
              <InputField label="First Name *" value={firstName} onChange={setFirstName} colors={colors} autoFocus />
              <InputField label="Last Name" value={lastName} onChange={setLastName} colors={colors} />
              <InputField label="Email" value={email} onChange={setEmail} colors={colors} keyboardType="email-address" />
              <InputField label="Date of Birth" value={dob} onChange={setDob} colors={colors} placeholder="YYYY-MM-DD" />
              <View style={{ marginBottom: 12 }}>
                <Text style={[ss.fieldLabel, { color: colors.muted }]}>Gender</Text>
                <View style={ss.genderRow}>
                  {["Male", "Female", "Other"].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[ss.genderBtn, { borderColor: gender === g ? colors.brand : colors.border, backgroundColor: gender === g ? colors.brandTertiary : colors.surfaceSecondary }]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={{ color: gender === g ? colors.brand : colors.muted, fontWeight: "600" }}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <InputField label="Referral Code (optional)" value={referralCode} onChange={setReferralCode} colors={colors} placeholder="e.g. VDG1ABC" autoCapitalize="characters" />
              <TouchableOpacity style={[ss.primaryBtn, { backgroundColor: colors.brand }]} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={ss.primaryBtnText}>Create Account & Start</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({ label, value, onChange, colors, placeholder, keyboardType, autoFocus, autoCapitalize }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[ss.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <View style={[ss.inputWrap, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
        <TextInput
          value={value} onChangeText={onChange}
          placeholder={placeholder || label} style={[ss.input, { color: colors.onSurface }]}
          placeholderTextColor={colors.mutedLight}
          keyboardType={keyboardType} autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 15, marginTop: 6, lineHeight: 22 },
  error: { fontSize: 13, marginTop: 12, fontWeight: "600" },
  formSection: { marginTop: 28, gap: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 54, gap: 10 },
  prefix: { fontSize: 16, fontWeight: "600" },
  input: { flex: 1, fontSize: 16, fontWeight: "500", height: 54, padding: 0 },
  primaryBtn: { height: 54, borderRadius: 14, justifyContent: "center", alignItems: "center", marginTop: 16 },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  demoBanner: { padding: 12, borderRadius: 10, marginBottom: 12, alignItems: "center" },
});
