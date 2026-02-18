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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import TaskCard from "@/components/TaskCard";
import type { TaskList, Task, ListMember, TaskStatus } from "@/lib/types";

type FilterOption = "all" | TaskStatus;

const FILTERS: { key: FilterOption; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: "all", label: "All", icon: "apps-outline", color: Colors.text },
  { key: "open", label: "Open", icon: "radio-button-off", color: Colors.statusOpen },
  { key: "in_progress", label: "Active", icon: "play-circle-outline", color: Colors.statusInProgress },
  { key: "pending_approval", label: "Review", icon: "time-outline", color: Colors.statusPendingApproval },
  { key: "completed", label: "Done", icon: "checkmark-circle-outline", color: Colors.statusCompleted },
];

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const { data: listData } = useQuery<TaskList>({
    queryKey: ["/api/v1/lists", id],
    enabled: isAuthenticated && !!id,
  });

  const {
    data: tasksData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ data: Task[] }>({
    queryKey: [`/api/v1/lists/${id}/tasks`],
    enabled: isAuthenticated && !!id,
  });

  const { data: membersData } = useQuery<{ data: ListMember[] }>({
    queryKey: [`/api/v1/lists/${id}/members`],
    enabled: isAuthenticated && !!id && !!listData?.isShared,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const allTasks = tasksData?.data || [];
  const members = membersData?.data || [];

  const filteredTasks = useMemo(() => {
    if (activeFilter === "all") return allTasks;
    return allTasks.filter((t) => t.status === activeFilter);
  }, [allTasks, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTasks.length };
    for (const t of allTasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [allTasks]);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {listData?.name || "List"}
          </Text>
          {listData?.isShared ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/(lists)/members/[id]", params: { id } });
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.sharedTag, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
              <Text style={styles.sharedTagText}>{members.length} members</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push({ pathname: "/create-task", params: { listId: id } });
          }}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </Pressable>
      </View>

      {listData?.description ? (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{listData.description}</Text>
        </View>
      ) : null}

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            const count = statusCounts[f.key] || 0;
            return (
              <Pressable
                key={f.key}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: f.color + "18", borderColor: f.color + "50" },
                ]}
                onPress={() => {
                  setActiveFilter(f.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons name={f.icon} size={13} color={isActive ? f.color : Colors.textMuted} />
                <Text style={[styles.filterText, isActive && { color: f.color }]}>
                  {f.label}
                </Text>
                <View style={[styles.filterCount, isActive && { backgroundColor: f.color + "25" }]}>
                  <Text style={[styles.filterCountText, isActive && { color: f.color }]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        renderItem={({ item }) => <TaskCard task={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              {activeFilter !== "all" ? (
                <>
                  <Ionicons name="filter-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No {FILTERS.find((f) => f.key === activeFilter)?.label.toLowerCase()} tasks</Text>
                  <Pressable
                    style={({ pressed }) => [styles.clearFilterBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => setActiveFilter("all")}
                  >
                    <Text style={styles.clearFilterText}>Show all tasks</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Ionicons name="clipboard-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No tasks yet</Text>
                  <Text style={styles.emptyText}>Add your first task to get started</Text>
                  <Pressable
                    style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    onPress={() => router.push({ pathname: "/create-task", params: { listId: id } })}
                  >
                    <Ionicons name="add" size={18} color={Colors.white} />
                    <Text style={styles.emptyBtnText}>Add Task</Text>
                  </Pressable>
                </>
              )}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.background,
  },
  topBarCenter: { flex: 1, gap: 2 },
  topTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  sharedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Colors.primary + "12",
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  sharedTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  descBox: { paddingHorizontal: 16, paddingBottom: 8 },
  descText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  filterContainer: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    marginBottom: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 5,
  },
  filterCountText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" as const },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },
  clearFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    marginTop: 8,
  },
  clearFilterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
});
