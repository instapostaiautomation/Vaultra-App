import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Gift, TrendingUp, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, cardShadow } from "@/src/theme";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  referral: <Users size={18} color={colors.brandSecondary} />,
  gift: <Gift size={18} color={colors.giftDiwaliAccent} />,
  price: <TrendingUp size={18} color={colors.success} />,
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, reloadNotifs } = useApp();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api<{ notifications: Notification[] }>("/notifications")
      .then((r) => {
        setNotifs(r.notifications);
        // Mark all as read
        api("/notifications/mark-read", { method: "POST" }).then(() => reloadNotifs()).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <View style={styles.root} testID="notifications-screen">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="notif-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Bell size={32} color={colors.mutedLight} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Updates and alerts will appear here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 8 }}>
          {notifs.map((n) => (
            <View key={n.id} style={[styles.notifCard, !n.read && styles.notifUnread]} testID={`notif-${n.id}`}>
              <View style={styles.notifIcon}>
                {TYPE_ICON[n.type] || <Bell size={18} color={colors.muted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifMsg}>{n.message}</Text>
                <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  notifUnread: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandTertiary,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface },
  notifMsg: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  notifTime: { fontFamily: fonts.medium, fontSize: 11, color: colors.mutedLight, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, marginTop: 6 },
});
