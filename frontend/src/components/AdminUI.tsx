import { LogOut } from "lucide-react-native";
import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Chip, ChipRow } from "@/src/components/ui";
import { useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

export function AdminHeader({ title, subtitle, back, showLogout }: { title: string; subtitle?: string; back?: boolean; showLogout?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { staff, signOut } = useStaff();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/admin/dashboard"))} style={styles.iconBtn} testID="admin-back-button">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{staff ? `${staff.staff_id} · ${staff.role}` : "STAFF CONSOLE"}</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        {showLogout ? (
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/admin/login");
            }}
            style={styles.logout}
            testID="admin-logout-button"
          >
            <LogOut size={18} color={colors.adminOnSurfaceTertiary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TenantFilter() {
  const { staff, tenantFilter, setTenantFilter } = useStaff();
  if (!staff || staff.tenant !== "all") return null;
  return (
    <ChipRow dark style={{ borderBottomWidth: 1, borderBottomColor: colors.adminBorder }}>
      {[
        ["all", "All Stores"],
        ["vaultra", "Vaultra"],
        ["tanishq", "Tanishq"],
        ["malabar", "Malabar"],
      ].map(([id, label]) => (
        <Chip key={id} dark label={label} selected={tenantFilter === id} onPress={() => setTenantFilter(id)} testID={`admin-tenant-filter-${id}`} />
      ))}
    </ChipRow>
  );
}

export function ACard({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export const adminText = StyleSheet.create({
  h: { fontFamily: fonts.bold, fontSize: 16, color: colors.adminOnSurface, letterSpacing: -0.3 },
  b: { fontFamily: fonts.regular, fontSize: 13, color: colors.adminOnSurfaceTertiary },
  m: { fontFamily: fonts.regular, fontSize: 12, color: colors.adminMuted },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.adminMuted, letterSpacing: 0.6, textTransform: "uppercase" },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.adminBorder,
    backgroundColor: colors.adminSurfaceTertiary,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.adminOnSurface,
  },
});

const styles = StyleSheet.create({
  header: { backgroundColor: colors.adminSurface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.adminBorder },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandPrimary, letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontFamily: fonts.black, fontSize: 24, letterSpacing: -0.8, color: colors.adminOnSurface, marginTop: 2 },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.adminMuted, marginTop: 2 },
  iconBtn: { width: 36, height: 44, justifyContent: "center" },
  backText: { fontFamily: fonts.medium, fontSize: 34, color: colors.adminOnSurface, marginTop: -4 },
  logout: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, alignItems: "center", justifyContent: "center", backgroundColor: colors.adminSurfaceSecondary },
  card: { backgroundColor: colors.adminSurfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, padding: 16 },
});
