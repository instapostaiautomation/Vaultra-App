import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { useApp } from "@/src/store/AppContext";
import { api } from "@/src/api";
import { ArrowLeft, BellOff } from "lucide-react-native";

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { isLoggedIn } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    api("/notifications").then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [isLoggedIn]);

  const markRead = async () => {
    await api("/notifications/mark-read", { method: "POST" }).catch(() => {});
    const d = await api("/notifications").catch(() => null);
    if (d) setData(d);
  };

  return (
    <View style={[ss.flex, { backgroundColor: colors.surface }]}>
      <View style={[ss.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
          <ArrowLeft size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[ss.title, { color: colors.onSurface }]}>Notifications</Text>
        {data?.unread_count > 0 && (
          <TouchableOpacity onPress={markRead}>
            <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> :
         !data?.notifications?.length ? (
          <View style={ss.empty}>
            <BellOff size={40} color={colors.muted} />
            <Text style={[ss.emptyText, { color: colors.muted }]}>No notifications yet</Text>
          </View>
        ) : (
          data.notifications.map((n: any) => (
            <View key={n.id} style={[ss.notifRow, { borderColor: colors.divider, backgroundColor: n.read ? "transparent" : colors.brandTertiary }]}>
              <View style={[ss.dot, { backgroundColor: n.read ? "transparent" : colors.brand }]} />
              <View style={ss.notifContent}>
                <Text style={[ss.notifTitle, { color: colors.onSurface }]}>{n.title}</Text>
                <Text style={[ss.notifMsg, { color: colors.muted }]}>{n.message}</Text>
                <Text style={[ss.notifDate, { color: colors.mutedLight }]}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, marginTop: 12 },
  notifRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 12 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: "600" },
  notifMsg: { fontSize: 13, marginTop: 2 },
  notifDate: { fontSize: 11, marginTop: 4 },
});
