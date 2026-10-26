import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import {
  ArrowLeft, User, Phone, Mail, Calendar, Shield, Moon, Sun,
  ChevronRight, LogOut, HelpCircle, Gift, Bell, CreditCard,
} from "lucide-react-native";

export default function ProfileScreen() {
  const { colors, scheme, toggle } = useTheme();
  const { user, isLoggedIn, logout, jewellerConfig } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/(tabs)"); } },
    ]);
  };

  if (!isLoggedIn || !user) {
    return (
      <View style={[ss.center, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <User size={48} color={colors.brand} />
        <Text style={[ss.emptyTitle, { color: colors.onSurface }]}>Profile</Text>
        <Text style={[ss.emptyText, { color: colors.muted }]}>Login to view your profile</Text>
        <TouchableOpacity style={[ss.loginBtn, { backgroundColor: colors.brand }]} onPress={() => router.push("/login")}>
          <Text style={ss.loginBtnText}>Login / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <View style={ss.profileHeader}>
          <View style={[ss.avatar, { backgroundColor: colors.brandTertiary }]}>
            <Text style={[ss.avatarText, { color: colors.brand }]}>{(user.first_name || "G")[0].toUpperCase()}</Text>
          </View>
          <Text style={[ss.profileName, { color: colors.onSurface }]}>{user.first_name} {user.last_name}</Text>
          <Text style={[ss.profilePhone, { color: colors.muted }]}>+91 {user.phone}</Text>
          <Text style={[ss.walletIdText, { color: colors.brand }]}>Wallet ID: {user.wallet_id}</Text>
          {jewellerConfig && (
            <Text style={[ss.shopText, { color: colors.muted }]}>{jewellerConfig.business_name}</Text>
          )}
        </View>

        {/* KYC Status */}
        <View style={[ss.kycCard, {
          backgroundColor: user.kyc_status === "approved" ? "#DCFCE7" : user.kyc_status === "pending" ? "#FEF3C7" : colors.surfaceSecondary,
          borderColor: user.kyc_status === "approved" ? "#16A34A" : user.kyc_status === "pending" ? "#D97706" : colors.border,
        }]}>
          <Shield size={20} color={user.kyc_status === "approved" ? "#16A34A" : user.kyc_status === "pending" ? "#D97706" : colors.muted} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: "600", color: user.kyc_status === "approved" ? "#16A34A" : user.kyc_status === "pending" ? "#D97706" : colors.onSurface }}>
              KYC {user.kyc_status === "approved" ? "Verified" : user.kyc_status === "pending" ? "Under Review" : "Not Submitted"}
            </Text>
            {user.kyc_status === "not_submitted" && <Text style={{ color: colors.muted, fontSize: 12 }}>Complete KYC to sell gold and access all features</Text>}
          </View>
        </View>

        {/* Menu Items */}
        <View style={ss.menuSection}>
          <MenuItem icon={<Moon size={20} color={colors.brand} />} label={scheme === "dark" ? "Light Mode" : "Dark Mode"}
            right={scheme === "dark" ? <Sun size={18} color={colors.brand} /> : <Moon size={18} color={colors.brand} />}
            onPress={toggle} colors={colors} />
          <MenuItem icon={<Bell size={20} color={colors.brand} />} label="Notifications" onPress={() => router.push("/notifications")} colors={colors} />
          <MenuItem icon={<Gift size={20} color={colors.brand} />} label="Refer & Earn" onPress={() => router.push("/referral")} colors={colors} />
          <MenuItem icon={<CreditCard size={20} color={colors.brand} />} label="Wallet" onPress={() => router.push("/(tabs)/wallet")} colors={colors} />
          <MenuItem icon={<HelpCircle size={20} color={colors.brand} />} label="FAQ" onPress={() => router.push("/faq")} colors={colors} />
          <MenuItem icon={<LogOut size={20} color={colors.error} />} label="Logout" onPress={handleLogout} colors={colors} isDestructive />
        </View>

        {/* Details */}
        <View style={ss.detailSection}>
          <Text style={[ss.detailTitle, { color: colors.onSurface }]}>Account Details</Text>
          <DetailRow icon={<Phone size={16} color={colors.muted} />} label="Phone" value={`+91 ${user.phone}`} colors={colors} />
          {user.email ? <DetailRow icon={<Mail size={16} color={colors.muted} />} label="Email" value={user.email} colors={colors} /> : null}
          {user.dob ? <DetailRow icon={<Calendar size={16} color={colors.muted} />} label="DOB" value={user.dob} colors={colors} /> : null}
          {user.gender ? <DetailRow icon={<User size={16} color={colors.muted} />} label="Gender" value={user.gender} colors={colors} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, onPress, colors, right, isDestructive }: any) {
  return (
    <TouchableOpacity style={[ss.menuItem, { borderColor: colors.divider }]} onPress={onPress}>
      {icon}
      <Text style={[ss.menuLabel, { color: isDestructive ? colors.error : colors.onSurface }]}>{label}</Text>
      {right || <ChevronRight size={18} color={colors.muted} />}
    </TouchableOpacity>
  );
}

function DetailRow({ icon, label, value, colors }: any) {
  return (
    <View style={[ss.detailRow, { borderColor: colors.divider }]}>
      {icon}
      <Text style={[ss.detailLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[ss.detailValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 6 },
  loginBtn: { marginTop: 20, height: 48, paddingHorizontal: 32, borderRadius: 14, justifyContent: "center" },
  loginBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  profileHeader: { alignItems: "center", paddingVertical: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 32, fontWeight: "800" },
  profileName: { fontSize: 22, fontWeight: "700", marginTop: 12 },
  profilePhone: { fontSize: 14, marginTop: 4 },
  walletIdText: { fontSize: 14, fontWeight: "700", marginTop: 6, letterSpacing: 1 },
  shopText: { fontSize: 13, marginTop: 4 },
  kycCard: { marginHorizontal: 16, borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  menuSection: { marginTop: 20, paddingHorizontal: 16 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, gap: 14 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  detailSection: { marginTop: 24, paddingHorizontal: 16 },
  detailTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  detailLabel: { fontSize: 13, width: 60 },
  detailValue: { flex: 1, fontSize: 14, fontWeight: "500" },
});
