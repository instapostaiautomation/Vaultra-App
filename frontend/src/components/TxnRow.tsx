import { ArrowDownLeft, ArrowUpRight, Gift, RefreshCw, Repeat, Store } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBadge } from "@/src/components/ui";
import { dateTime, grams, inr, TXN_LABEL } from "@/src/format";
import { colors, fonts } from "@/src/theme";

const ICON: Record<string, any> = { buy: ArrowDownLeft, sell: ArrowUpRight, sip: Repeat, redemption: Gift, counter_sale: Store, reversal: RefreshCw };

export function TxnRow({ t, onPress, dark }: { t: any; onPress?: () => void; dark?: boolean }) {
  const Icon = ICON[t.type] || ArrowDownLeft;
  const credit = ["buy", "sip", "counter_sale"].includes(t.type) || (t.type === "reversal" && ["sell", "redemption"].includes(t.original_type));
  const fg = dark ? colors.adminOnSurface : colors.onSurface;
  return (
    <Pressable testID={`txn-row-${t.id}`} onPress={onPress} style={[styles.row, { borderBottomColor: dark ? colors.adminBorder : colors.divider }]}>
      <View style={[styles.icon, { backgroundColor: dark ? colors.adminGoldTint : credit ? colors.brandTertiary : colors.surfaceTertiary }]}>
        <Icon size={18} color={credit ? colors.brandSecondary : dark ? colors.adminOnSurfaceTertiary : colors.onSurfaceTertiary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
          {TXN_LABEL[t.type] || t.type}
          {t.item ? ` · ${t.item}` : ""}
        </Text>
        <Text style={[styles.sub, { color: dark ? colors.adminMuted : colors.muted }]} numberOfLines={1}>
          {dateTime(t.created_at)} · {t.invoice_no}
        </Text>
        <StatusBadge status={t.status} dark={dark} testID={`txn-status-${t.id}`} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={[styles.grams, { color: credit ? colors.success : fg }]}>
          {credit ? "+" : "−"}
          {grams(t.grams)}
        </Text>
        <Text style={[styles.amt, { color: dark ? colors.adminMuted : colors.muted }]}>{inr(t.type === "redemption" ? t.amount : t.total)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.semibold, fontSize: 14 },
  sub: { fontFamily: fonts.regular, fontSize: 11 },
  grams: { fontFamily: fonts.bold, fontSize: 14, letterSpacing: -0.2 },
  amt: { fontFamily: fonts.medium, fontSize: 12 },
});
