import { RotateCcw } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AdminHeader, adminText, TenantFilter } from "@/src/components/AdminUI";
import { useToast } from "@/src/components/Toast";
import { Button, Chip, ChipRow, Row, Sheet, StatusBadge } from "@/src/components/ui";
import { dateTime, grams, inr, TENANT_NAME, TXN_LABEL } from "@/src/format";
import { tenantQS, useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

const TYPES = ["all", "buy", "sip", "counter_sale", "sell", "redemption", "reversal"];

export default function Ledger() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { tenantFilter } = useStaff();
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sel, setSel] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api(`/admin/ledger?type=${type}&${tenantQS(tenantFilter)}`, { auth: "staff" }));
    } catch {
      setRows([]);
    }
  }, [type, tenantFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const reverse = async () => {
    setBusy(true);
    try {
      await api(`/admin/ledger/${sel.id}/reverse`, { method: "POST", auth: "staff", body: { reason: reason.trim() } });
      toast("success", "Transaction reversed", `${sel.invoice_no} · mirror entries posted`);
      setSel(null);
      setReason("");
      load();
    } catch (e: any) {
      toast("error", "Reversal failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="admin-ledger-screen">
      <AdminHeader title="Store Ledger" subtitle="Double-entry journal & reversals" back />
      <TenantFilter />
      <ChipRow dark>
        {TYPES.map((t) => (
          <Chip key={t} dark label={t === "all" ? "All" : TXN_LABEL[t]} selected={type === t} onPress={() => setType(t)} testID={`ledger-filter-${t}`} />
        ))}
      </ChipRow>
      {rows === null ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: insets.bottom + 24, gap: 8 }}
          ListEmptyComponent={<Text style={[adminText.m, { textAlign: "center", marginTop: 32 }]}>No ledger entries</Text>}
          renderItem={({ item: t }) => {
            const canReverse = t.type !== "reversal" && !["reversed", "failed"].includes(t.status);
            return (
              <Pressable onPress={() => setExpanded(expanded === t.id ? null : t.id)} style={styles.item} testID={`ledger-row-${t.id}`}>
                <View style={styles.head}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.title}>
                      {TXN_LABEL[t.type]}
                      {t.original_type ? ` of ${TXN_LABEL[t.original_type]}` : ""}
                    </Text>
                    <Text style={adminText.m}>
                      {t.invoice_no} · {t.name} · {TENANT_NAME[t.tenant]}
                    </Text>
                    <Text style={adminText.m}>{dateTime(t.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.amt}>{inr(t.total)}</Text>
                    <Text style={adminText.m}>{grams(t.grams)}</Text>
                    <StatusBadge status={t.status} dark testID={`ledger-status-${t.id}`} />
                  </View>
                </View>
                {expanded === t.id ? (
                  <View style={styles.entries} testID={`ledger-entries-${t.id}`}>
                    <View style={styles.eRow}>
                      <Text style={[adminText.label, { flex: 1 }]}>Account</Text>
                      <Text style={[adminText.label, styles.num]}>Debit</Text>
                      <Text style={[adminText.label, styles.num]}>Credit</Text>
                    </View>
                    {(t.entries || []).map((e: any, i: number) => (
                      <View key={i} style={styles.eRow}>
                        <Text style={[adminText.b, { flex: 1 }]} numberOfLines={1}>
                          {e.account}
                        </Text>
                        <Text style={[styles.eNum, styles.num]}>{e.debit ? inr(e.debit) : "—"}</Text>
                        <Text style={[styles.eNum, styles.num]}>{e.credit ? inr(e.credit) : "—"}</Text>
                      </View>
                    ))}
                    {t.reversal_reason ? <Text style={[adminText.m, { marginTop: 6 }]}>Reversed by {t.reversed_by}: {t.reversal_reason}</Text> : null}
                    {t.type === "reversal" && t.note ? <Text style={[adminText.m, { marginTop: 6 }]}>Reason: {t.note} · by {t.staff_id}</Text> : null}
                  </View>
                ) : null}
                {canReverse ? (
                  <Pressable onPress={() => setSel(t)} style={styles.revBtn} testID={`ledger-reverse-${t.id}`}>
                    <RotateCcw size={14} color="#F87171" />
                    <Text style={styles.revText}>Reverse Transaction</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <Sheet visible={!!sel} onClose={() => setSel(null)} title="Reverse transaction?" dark testID="reverse-sheet">
        {sel ? (
          <View style={{ paddingBottom: 8 }}>
            <Row dark label="Invoice" value={sel.invoice_no} />
            <Row dark label="Type" value={TXN_LABEL[sel.type]} />
            <Row dark label="Gold" value={grams(sel.grams)} />
            <Row dark label="Amount" value={inr(sel.total)} bold />
            <Text style={[adminText.m, { marginVertical: 8 }]}>
              Mirror journal entries will be posted and the customer&apos;s vault balance adjusted. This action is audited.
            </Text>
            <TextInput
              testID="reverse-reason-input"
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for reversal (required)"
              placeholderTextColor={colors.adminMuted}
              style={[adminText.input, { height: 80, paddingTop: 12, textAlignVertical: "top" }]}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button title="Cancel" variant="adminOutline" style={{ flex: 1 }} onPress={() => setSel(null)} testID="reverse-cancel-button" />
              <Button title="Confirm Reversal" variant="danger" style={{ flex: 1 }} loading={busy} disabled={reason.trim().length < 3} onPress={reverse} testID="reverse-confirm-button" />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  item: { backgroundColor: colors.adminSurfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, padding: 14 },
  head: { flexDirection: "row", gap: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 14, color: colors.adminOnSurface },
  amt: { fontFamily: fonts.bold, fontSize: 14, color: colors.adminOnSurface },
  entries: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.adminBorder, gap: 4 },
  eRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  num: { width: 84, textAlign: "right" },
  eNum: { fontFamily: fonts.semibold, fontSize: 12, color: colors.adminOnSurfaceTertiary },
  revBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 12, height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.adminErrorTint },
  revText: { fontFamily: fonts.semibold, fontSize: 12, color: "#F87171" },
});
