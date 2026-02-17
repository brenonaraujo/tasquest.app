import { useCallback } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import TaskCard from "@/components/TaskCard";
import type { TaskList, Task, ListMember } from "@/lib/types";

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  const tasks = tasksData?.data || [];
  const members = membersData?.data || [];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {listData?.name || "List"}
          </Text>
          {listData?.isShared ? (
            <View style={styles.sharedTag}>
              <Ionicons name="people" size={10} color={Colors.secondary} />
              <Text style={styles.sharedTagText}>{members.length} members</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/create-task", params: { listId: id } })}
          hitSlop={12}
        >
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </Pressable>
      </View>

      {listData?.description ? (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{listData.description}</Text>
        </View>
      ) : null}

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }) => <TaskCard task={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptyText}>Add your first task to get started</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                onPress={() => router.push({ pathname: "/create-task", params: { listId: id } })}
              >
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Add Task</Text>
              </Pressable>
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
  sharedTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  sharedTagText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.secondary },
  descBox: { paddingHorizontal: 16, paddingBottom: 12 },
  descText: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
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
});
