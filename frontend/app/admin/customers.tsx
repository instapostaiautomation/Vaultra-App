import { Search, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AdminHeader, adminText, TenantFilter } from "@/src/components/AdminUI";
import { StatusBadge } from "@/src/components/ui";
import { grams, maskPhone, shortDate, TENANT_NAME } from "@/src/format";
import { tenantQS, useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

export default function Customers() {
  const insets = useSafeAreaInsets();
  const { tenantFilter } = useStaff();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api(`/admin/customers?${tenantQS(tenantFilter)}&search=${encodeURIComponent(q)}`, { auth: "staff" }));
    } catch {
      setRows([]);
    }
  }, [tenantFilter, q]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <View style={styles.root} testID="admin-customers-screen">
      <AdminHeader title="Customers Directory" subtitle={rows ? `${rows.length} customers` : undefined} back />
      <TenantFilter />
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.adminMuted} />
        <TextInput
          testID="customers-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Search name or phone"
          placeholderTextColor={colors.adminMuted}
          style={styles.search}
        />
      </View>
      {rows === null ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={
            <View style={styles.thead}>
              <Text style={[adminText.label, { flex: 1 }]}>Customer</Text>
              <Text style={[adminText.label, { width: 96, textAlign: "right" }]}>Vault</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: 32, gap: 8 }} testID="customers-empty">
              <Users size={28} color={colors.adminMuted} />
              <Text style={adminText.m}>No customers match</Text>
            </View>
          }
          renderItem={({ item: u }) => (
            <View style={styles.row} testID={`customer-row-${u.id}`}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={adminText.m}>
                  {maskPhone(u.phone)} · {TENANT_NAME[u.tenant]}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <StatusBadge status={u.kyc_status} dark label={u.kyc_status === "not_submitted" ? "No KYC" : u.kyc_status[0].toUpperCase() + u.kyc_status.slice(1)} />
                  <Text style={adminText.m}>Joined {shortDate(u.created_at)}</Text>
                </View>
              </View>
              <Text style={styles.bal}>{grams(u.gold_grams)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, marginBottom: 8, height: 44, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.adminSurfaceSecondary, borderWidth: 1, borderColor: colors.adminBorder },
  search: { flex: 1, height: 42, fontFamily: fonts.medium, fontSize: 14, color: colors.adminOnSurface },
  thead: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.adminBorder },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.adminBorder, gap: 12 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.adminOnSurface },
  bal: { width: 96, textAlign: "right", fontFamily: fonts.bold, fontSize: 14, color: colors.brandPrimary },
});
