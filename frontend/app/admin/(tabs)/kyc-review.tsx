import { useFocusEffect } from "expo-router";
import { BadgeCheck, CreditCard, Fingerprint, XCircle } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ACard, AdminHeader, adminText, TenantFilter } from "@/src/components/AdminUI";
import { useToast } from "@/src/components/Toast";
import { Button, Sheet, StatusBadge } from "@/src/components/ui";
import { dateTime, maskPhone, TENANT_NAME, timeAgo } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { tenantQS, useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

export default function KycReview() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { staff, tenantFilter } = useStaff();
  const [queue, setQueue] = useState<any[] | null>(null);
  const [reviewed, setReviewed] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const qs = tenantQS(tenantFilter);

  const load = useCallback(async () => {
    try {
      const [q, r] = await Promise.all([api(`/admin/kyc-queue?${qs}`, { auth: "staff" }), api(`/admin/kyc-reviewed?${qs}`, { auth: "staff" })]);
      setQueue(q);
      setReviewed(r);
    } catch {
      setQueue([]);
    }
  }, [qs]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (approve: boolean) => {
    if (!approve && note.trim().length < 3) {
      toast("error", "Add a rejection reason");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    try {
      await api(`/admin/kyc/${sel.id}/decision`, { method: "POST", auth: "staff", body: { approve, note: note.trim() } });
      toast(approve ? "success" : "info", approve ? "KYC approved" : "KYC rejected", `${sel.name} · reviewed by ${staff?.staff_id}`);
      setSel(null);
      setNote("");
      load();
    } catch (e: any) {
      toast("error", "Action failed", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root} testID="admin-kyc-screen">
      <AdminHeader title="KYC Review Queue" subtitle="Oldest submissions first" />
      <TenantFilter />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: bottomChrome + 24, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.brandPrimary} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {queue === null ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 32 }} />
        ) : queue.length === 0 ? (
          <ACard style={{ alignItems: "center", gap: 8, paddingVertical: 32 }} testID="kyc-queue-empty">
            <BadgeCheck size={32} color={colors.success} />
            <Text style={adminText.h}>Queue clear</Text>
            <Text style={adminText.m}>No pending KYC reviews right now.</Text>
          </ACard>
        ) : (
          queue.map((u, i) => (
            <Pressable key={u.id} onPress={() => setSel(u)} style={styles.item} testID={`kyc-queue-item-${u.id}`}>
              <View style={styles.pos}>
                <Text style={styles.posText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={adminText.h}>{u.kyc?.full_name || u.name}</Text>
                <Text style={adminText.m}>
                  {maskPhone(u.phone)} · {TENANT_NAME[u.tenant]}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <StatusBadge status="pending" dark />
                <Text style={adminText.m}>{timeAgo(u.kyc?.submitted_at)}</Text>
              </View>
            </Pressable>
          ))
        )}

        {reviewed.length ? <Text style={[adminText.label, { marginTop: 16 }]}>Recently reviewed</Text> : null}
        {reviewed.slice(0, 8).map((u) => (
          <View key={u.id} style={styles.reviewed} testID={`kyc-reviewed-${u.id}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.revName}>{u.name}</Text>
              <Text style={adminText.m}>
                by {u.kyc?.reviewed_by} · {dateTime(u.kyc?.reviewed_at)}
              </Text>
            </View>
            <StatusBadge status={u.kyc_status} dark label={u.kyc_status === "approved" ? "Approved" : "Rejected"} />
          </View>
        ))}
      </ScrollView>

      <Sheet visible={!!sel} onClose={() => setSel(null)} title="Review documents" dark testID="kyc-review-sheet">
        {sel ? (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={styles.aadhaar} testID="kyc-aadhaar-card">
              <View style={styles.docHead}>
                <Fingerprint size={18} color="#FF9933" />
                <Text style={styles.docTitle}>AADHAAR · Govt. of India</Text>
              </View>
              <View style={styles.docBody}>
                <View style={styles.photo}>
                  <Text style={styles.photoText}>{(sel.kyc?.full_name || sel.name).split(" ").map((x: string) => x[0]).join("").slice(0, 2)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.docName}>{sel.kyc?.full_name}</Text>
                  <Text style={styles.docMeta}>DOB: {sel.kyc?.dob || "—"}</Text>
                  <Text style={styles.docNum} testID="kyc-aadhaar-number">
                    {String(sel.kyc?.aadhaar || "").replace(/(\d{4})(?=\d)/g, "$1 ")}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.pan} testID="kyc-pan-card">
              <View style={styles.docHead}>
                <CreditCard size={18} color="#1E3A8A" />
                <Text style={[styles.docTitle, { color: "#1E3A8A" }]}>INCOME TAX DEPARTMENT · PAN</Text>
              </View>
              <Text style={[styles.docNum, { color: "#0F172A", letterSpacing: 3 }]} testID="kyc-pan-number">
                {sel.kyc?.pan}
              </Text>
              <Text style={[styles.docName, { color: "#0F172A" }]}>{sel.kyc?.full_name?.toUpperCase()}</Text>
            </View>
            <Text style={adminText.m}>
              Submitted {dateTime(sel.kyc?.submitted_at)} · Reviewer ID {staff?.staff_id} will be recorded
            </Text>
            <TextInput
              testID="kyc-review-note-input"
              value={note}
              onChangeText={setNote}
              placeholder="Note (required for rejection)"
              placeholderTextColor={colors.adminMuted}
              style={adminText.input}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Reject" variant="danger" loading={busy === "reject"} onPress={() => decide(false)} style={{ flex: 1 }} icon={<XCircle size={18} color={colors.onError} />} testID="kyc-reject-button" />
              <Button title="Approve" variant="success" loading={busy === "approve"} onPress={() => decide(true)} style={{ flex: 1 }} icon={<BadgeCheck size={18} color={colors.onSuccess} />} testID="kyc-approve-button" />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.adminSurfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, padding: 14 },
  pos: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.adminGoldTint, alignItems: "center", justifyContent: "center" },
  posText: { fontFamily: fonts.bold, fontSize: 13, color: colors.brandPrimary },
  reviewed: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.adminBorder },
  revName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.adminOnSurface },
  aadhaar: { backgroundColor: "#FFFFFF", borderRadius: radius.md, padding: 14, borderTopWidth: 4, borderTopColor: "#FF9933", borderBottomWidth: 4, borderBottomColor: "#138808" },
  pan: { backgroundColor: "#E0F2FE", borderRadius: radius.md, padding: 14, gap: 6 },
  docHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  docTitle: { fontFamily: fonts.bold, fontSize: 11, color: "#B45309", letterSpacing: 0.6 },
  docBody: { flexDirection: "row", gap: 12, alignItems: "center" },
  photo: { width: 56, height: 64, borderRadius: 8, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  photoText: { fontFamily: fonts.black, fontSize: 18, color: "#6B7280" },
  docName: { fontFamily: fonts.bold, fontSize: 14, color: "#111827" },
  docMeta: { fontFamily: fonts.regular, fontSize: 12, color: "#4B5563" },
  docNum: { fontFamily: fonts.black, fontSize: 18, color: "#111827", letterSpacing: 1.5, marginTop: 4 },
});
