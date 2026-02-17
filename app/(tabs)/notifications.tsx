import { useCallback, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { NotificationResponse, Notification } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const NOTIF_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  task_assigned: { icon: "person-add", color: Colors.info },
  task_pending_approval: { icon: "time", color: Colors.secondary },
  task_approved: { icon: "shield-checkmark", color: Colors.success },
  task_rejected: { icon: "close-circle", color: Colors.danger },
  list_invite_received: { icon: "mail", color: Colors.info },
  user_level_up: { icon: "arrow-up-circle", color: Colors.accent },
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [showRead, setShowRead] = useState(true);

  const { data, isLoading, refetch, isRefetching } = useQuery<NotificationResponse>({
    queryKey: ["/api/v1/notifications"],
    enabled: isAuthenticated,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/v1/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/notifications"] });
    },
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const allNotifications = data?.data || [];
  const readCount = allNotifications.filter((n) => n.isRead).length;

  const notifications = useMemo(() => {
    if (showRead) return allNotifications;
    return allNotifications.filter((n) => !n.isRead);
  }, [allNotifications, showRead]);

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              {data?.unreadCount ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{data.unreadCount} unread</Text>
                </View>
              ) : null}
            </View>
            {readCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.toggleReadBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setShowRead((v) => !v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name={showRead ? "eye-outline" : "eye-off-outline"}
                  size={16}
                  color={Colors.primary}
                />
                <Text style={styles.toggleReadText}>
                  {showRead ? "Hide read" : "Show read"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <NotifCard
            notification={item}
            onPress={() => {
              if (!item.isRead) {
                markReadMutation.mutate(item.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              if (item.taskId) {
                router.push({ pathname: "/task/[id]", params: { id: item.taskId } });
              }
            }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {!showRead && readCount > 0 ? "No unread notifications" : "All caught up"}
              </Text>
              <Text style={styles.emptyText}>
                {!showRead && readCount > 0
                  ? `You have ${readCount} read notification${readCount > 1 ? "s" : ""} hidden`
                  : "You'll be notified about tasks and approvals"}
              </Text>
              {!showRead && readCount > 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.showAllBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => setShowRead(true)}
                >
                  <Text style={styles.showAllText}>Show all</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function NotifCard({ notification, onPress }: { notification: Notification; onPress: () => void }) {
  const config = NOTIF_ICONS[notification.type] || { icon: "ellipsis-horizontal-circle", color: Colors.textMuted };
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !notification.isRead && styles.cardUnread,
        notification.isRead && styles.cardRead,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.color + "20" }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.notifTitle, !notification.isRead && styles.notifTitleUnread]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.notifMsg} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.notifTime}>{timeAgo}</Text>
      </View>
      {!notification.isRead ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  headerWrap: { marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text },
  unreadBadge: {
    backgroundColor: Colors.danger + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  unreadText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.danger },
  toggleReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primary + "12",
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  toggleReadText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  cardUnread: { borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "08" },
  cardRead: { opacity: 0.75 },
  cardPressed: { opacity: 0.8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  notifTitleUnread: { fontFamily: "Inter_600SemiBold" },
  notifMsg: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  notifTime: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" as const },
  showAllBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    marginTop: 8,
  },
  showAllText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary },
});
