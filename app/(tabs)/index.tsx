import { useCallback, useEffect, useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/query-client";
import XPBar from "@/components/XPBar";
import FeedItemCard from "@/components/FeedItemCard";
import type { FeedResponse, FeedItem } from "@/lib/types";

type FeedFilter = "all" | "mine" | "in_progress" | "general";

const FEED_FILTERS: { key: FeedFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "grid-outline" },
  { key: "mine", label: "Mine", icon: "person-outline" },
  { key: "in_progress", label: "Active", icon: "flash-outline" },
  { key: "general", label: "General", icon: "globe-outline" },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("all");

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: ["/api/v1/feed"],
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled: isAuthenticated,
  });

  const dismissMutation = useMutation({
    mutationFn: async (feedItemId: string) => {
      await apiRequest("POST", `/api/v1/feed/${feedItemId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/feed"] });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [authLoading, isAuthenticated]);

  const onRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/v1/auth/me"] });
  }, [refetch]);

  const handleDismiss = useCallback((id: string) => {
    dismissMutation.mutate(id);
  }, [dismissMutation]);

  const allFeedItems = useMemo(() => {
    return data?.pages?.flatMap((page) => page.data) || [];
  }, [data]);

  const myActiveItems = useMemo(() => {
    return allFeedItems.filter(
      (item) =>
        item.type === "task_started" &&
        (item.actorUserId === user?.id || item.targetUserId === user?.id)
    );
  }, [allFeedItems, user?.id]);

  const filteredItems = useMemo(() => {
    const myActiveIds = new Set(myActiveItems.map((i) => i.id));
    let items = allFeedItems.filter((i) => !myActiveIds.has(i.id));
    if (activeFilter === "mine") {
      items = items.filter((item) => item.actorUserId === user?.id);
    } else if (activeFilter === "in_progress") {
      items = items.filter((item) => item.type === "task_started");
    } else if (activeFilter === "general") {
      items = items.filter((item) => item.actorUserId !== user?.id);
    }
    return items;
  }, [allFeedItems, activeFilter, user?.id, myActiveItems]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (authLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.greeting}>
              <Text style={styles.greetingText}>
                {getGreeting()},{" "}
                <Text style={styles.userName}>{user?.name?.split(" ")[0]}</Text>
              </Text>
            </View>
            {user ? (
              <View style={styles.xpSection}>
                <XPBar
                  level={user.level}
                  totalXp={user.totalXp}
                  xpToNextLevel={user.xpToNextLevel}
                  energy={user.creationXpBalance}
                />
              </View>
            ) : null}

            {myActiveItems.length > 0 ? (
              <View style={styles.activeSection}>
                <View style={styles.activeSectionHeader}>
                  <Ionicons name="flash" size={16} color={Colors.statusInProgress} />
                  <Text style={styles.activeSectionTitle}>Your Active Tasks</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{myActiveItems.length}</Text>
                  </View>
                </View>
                {myActiveItems.map((item, index) => (
                  <View key={item.id} style={index > 0 ? { marginTop: 10 } : undefined}>
                    <FeedItemCard item={item} onDismiss={handleDismiss} />
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Activity</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterStrip}
              contentContainerStyle={styles.filterStripContent}
            >
              {FEED_FILTERS.map((f) => {
                const isActive = activeFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      setActiveFilter(f.key);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name={f.icon}
                      size={14}
                      color={isActive ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <FeedItemCard item={item} onDismiss={handleDismiss} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>Create tasks and complete quests to see activity here</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.93 }] }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/create-task");
        }}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  header: { marginBottom: 16 },
  greeting: { marginBottom: 16 },
  greetingText: { fontSize: 22, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  userName: { fontFamily: "Inter_700Bold", color: Colors.text },
  xpSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 20,
  },
  activeSection: {
    backgroundColor: Colors.statusInProgress + "08",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.statusInProgress + "25",
    marginBottom: 20,
  },
  activeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  activeSectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.statusInProgress,
    flex: 1,
  },
  activeBadge: {
    backgroundColor: Colors.statusInProgress + "20",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.statusInProgress,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  filterStrip: { marginBottom: 4 },
  filterStripContent: { gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + "18",
    borderColor: Colors.primary + "50",
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" as const },
  fab: {
    position: "absolute",
    bottom: Platform.OS === "web" ? 100 : 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    boxShadow: "0px 4px 12px rgba(6, 182, 212, 0.4)",
  },
});
