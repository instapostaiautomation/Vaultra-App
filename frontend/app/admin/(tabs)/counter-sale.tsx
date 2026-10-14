import { Banknote, CreditCard, Printer, Search, Smartphone, UserCheck, UserPlus } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ACard, AdminHeader, adminText } from "@/src/components/AdminUI";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet } from "@/src/components/ui";
import { dateTime, grams, inr, maskPhone, TENANT_NAME } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { useStaff } from "@/src/store/StaffContext";
import { colors, fonts, radius } from "@/src/theme";

const WEIGHTS = [0.5, 1, 2, 5, 10];
const METHODS = [
  { id: "cash", label: "Cash", Icon: Banknote },
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "upi", label: "UPI", Icon: Smartphone },
];

export default function CounterSale() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { staff } = useStaff();
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<any>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("1");
  const [method, setMethod] = useState("cash");
  const [rate, setRate] = useState(0);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const tenant = staff?.tenant === "all" ? "vaultra" : staff?.tenant || "vaultra";

  useEffect(() => {
    const load = () => api(`/price?tenant=${tenant}`, { auth: "none" }).then((p) => setRate(p.buy)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [tenant]);

  const doLookup = async () => {
    setLooking(true);
    try {
      setLookup(await api(`/admin/customers/lookup?phone=${phone}`, { auth: "staff" }));
    } catch (e: any) {
      toast("error", "Lookup failed", e.message);
    } finally {
      setLooking(false);
    }
  };

  const w = parseFloat(weight) || 0;
  const base = Math.round(w * rate * 100) / 100;
  const gst = Math.round(base * 0.03 * 100) / 100;
  const total = Math.round((base + gst) * 100) / 100;

  const generate = async () => {
    setBusy(true);
    try {
      const t = await api("/admin/counter-sale", { method: "POST", auth: "staff", body: { phone, name: lookup?.customer?.name || name, grams: w, method } });
      setBill(t);
      toast("success", "Bill generated", `${t.invoice_no} · ${inr(t.total)}`);
    } catch (e: any) {
      toast("error", "Transaction failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setBill(null);
    setPhone("");
    setLookup(null);
    setName("");
    setWeight("1");
  };

  return (
    <View style={styles.root} testID="admin-pos-screen">
      <AdminHeader title="Counter Gold Sale" subtitle={`POS · ${TENANT_NAME[tenant]} · ${inr(rate)}/g`} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: bottomChrome + 24, gap: 12 }}>
        <ACard>
          <Text style={[adminText.label, { marginBottom: 8 }]}>1 · Customer phone</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              testID="pos-phone-input"
              value={phone}
              onChangeText={(t) => {
                setPhone(t.replace(/\D/g, "").slice(0, 10));
                setLookup(null);
              }}
              keyboardType="phone-pad"
              placeholder="10-digit mobile"
              placeholderTextColor={colors.adminMuted}
              style={[adminText.input, { flex: 1 }]}
            />
            <Button title="Lookup" size="md" variant="adminOutline" loading={looking} disabled={phone.length !== 10} onPress={doLookup} icon={<Search size={16} color={colors.adminOnSurface} />} testID="pos-lookup-button" />
          </View>
          {lookup?.found ? (
            <View style={styles.found} testID="pos-customer-found">
              <UserCheck size={18} color="#4ADE80" />
              <View style={{ flex: 1 }}>
                <Text style={styles.foundName}>{lookup.customer.name}</Text>
                <Text style={adminText.m}>
                  Vault {grams(lookup.customer.gold_grams)} · KYC {lookup.customer.kyc_status.replace("_", " ")}
                </Text>
              </View>
            </View>
          ) : lookup ? (
            <View style={{ marginTop: 12 }} testID="pos-new-customer">
              <View style={styles.newRow}>
                <UserPlus size={16} color={colors.warning} />
                <Text style={[adminText.b, { color: colors.warning }]}>New walk-in customer — a vault will be created</Text>
              </View>
              <TextInput testID="pos-name-input" value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor={colors.adminMuted} style={[adminText.input, { marginTop: 8 }]} />
            </View>
          ) : null}
        </ACard>

        <ACard>
          <Text style={[adminText.label, { marginBottom: 8 }]}>2 · Weight (grams)</Text>
          <View style={styles.wrap}>
            {WEIGHTS.map((x) => (
              <Pressable key={x} onPress={() => setWeight(String(x))} style={[styles.wChip, w === x && styles.wOn]} testID={`pos-weight-${x}`}>
                <Text style={[styles.wText, w === x && { color: colors.brandPrimary }]}>{x}g</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            testID="pos-weight-input"
            value={weight}
            onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="Custom weight"
            placeholderTextColor={colors.adminMuted}
            style={[adminText.input, { marginTop: 8 }]}
          />
        </ACard>

        <ACard>
          <Text style={[adminText.label, { marginBottom: 8 }]}>3 · Payment method</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {METHODS.map(({ id, label, Icon }) => (
              <Pressable key={id} onPress={() => setMethod(id)} style={[styles.method, method === id && styles.methodOn]} testID={`pos-method-${id}`}>
                <Icon size={20} color={method === id ? colors.brandPrimary : colors.adminMuted} />
                <Text style={[styles.wText, method === id && { color: colors.brandPrimary }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ACard>

        <ACard testID="pos-summary">
          <Row dark label={`Gold ${grams(w, 3)} @ ${inr(rate)}`} value={inr(base)} />
          <Row dark label="GST (3%)" value={inr(gst)} />
          <Row dark label="Total" value={inr(total)} bold testID="pos-total" />
        </ACard>

        <Button
          title="Generate Bill"
          size="lg"
          loading={busy}
          disabled={phone.length !== 10 || !lookup || w <= 0 || (!lookup.found && name.trim().length < 2)}
          onPress={generate}
          icon={<Printer size={18} color={colors.onBrandPrimary} />}
          testID="pos-generate-bill-button"
        />
        {!lookup ? <Text style={[adminText.m, { textAlign: "center" }]}>Look up the customer phone to enable billing</Text> : null}
      </KeyboardAwareScrollView>

      <Sheet visible={!!bill} onClose={reset} title="Tax Invoice" dark testID="pos-bill-sheet">
        {bill ? (
          <View style={{ paddingBottom: 8 }}>
            <View style={styles.billHead}>
              <Text style={styles.billNo} testID="pos-bill-invoice">{bill.invoice_no}</Text>
              <Text style={adminText.m}>{dateTime(bill.created_at)}</Text>
            </View>
            <Row dark label="Customer" value={bill.name} />
            <Row dark label="Phone" value={maskPhone(bill.phone)} />
            <Row dark label="Store" value={TENANT_NAME[bill.tenant]} />
            <Row dark label="24K Gold" value={grams(bill.grams)} />
            <Row dark label="Rate" value={`${inr(bill.rate)}/g`} />
            <Row dark label="Value" value={inr(bill.amount)} />
            <Row dark label="GST (3%)" value={inr(bill.gst)} />
            <Row dark label={`Paid via ${bill.method.toUpperCase()}`} value={inr(bill.total)} bold />
            <Text style={[adminText.m, { marginTop: 8 }]}>Billed by {bill.staff_id} · gold credited to customer vault</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button
                title="Share"
                variant="adminOutline"
                style={{ flex: 1 }}
                onPress={() => Share.share({ message: `Vaultra DigiGold Invoice ${bill.invoice_no}\n${grams(bill.grams)} 24K @ ${inr(bill.rate)}/g\nTotal ${inr(bill.total)} (${bill.method.toUpperCase()})` }).catch(() => {})}
                testID="pos-bill-share"
              />
              <Button title="New Sale" style={{ flex: 1 }} onPress={reset} testID="pos-new-sale-button" />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminSurface },
  found: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.adminSuccessTint },
  foundName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.adminOnSurface },
  newRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wChip: { height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.adminBorder, backgroundColor: colors.adminSurfaceTertiary, justifyContent: "center" },
  wOn: { borderColor: colors.brandPrimary, backgroundColor: colors.adminGoldTint },
  wText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.adminOnSurfaceTertiary },
  method: { flex: 1, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.adminBorder, backgroundColor: colors.adminSurfaceTertiary, alignItems: "center", justifyContent: "center", gap: 4 },
  methodOn: { borderColor: colors.brandPrimary, backgroundColor: colors.adminGoldTint },
  billHead: { paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.adminBorder },
  billNo: { fontFamily: fonts.black, fontSize: 18, color: colors.brandPrimary, letterSpacing: 0.5 },
});
