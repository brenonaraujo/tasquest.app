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
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import type { TaskList } from "@/lib/types";

export default function ListsScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ data: TaskList[] }>({
    queryKey: ["/api/v1/lists"],
    enabled: isAuthenticated,
  });

  const lists = data?.data || [];

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <View style={styles.container}>
      <FlatList
        data={lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My Lists</Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push("/create-list")}
            >
              <Ionicons name="add" size={22} color={Colors.white} />
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <ListCard list={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptyText}>Create your first list to start organizing tasks</Text>
              <Pressable
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/create-list")}
              >
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Create List</Text>
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

function ListCard({ list }: { list: TaskList }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(lists)/[id]", params: { id: list.id } })}
    >
      <View style={[styles.listIcon, { backgroundColor: list.isShared ? Colors.secondary + "20" : Colors.primary + "20" }]}>
        <Ionicons
          name={list.isShared ? "people" : "list"}
          size={20}
          color={list.isShared ? Colors.secondary : Colors.primary}
        />
      </View>
      <View style={styles.listContent}>
        <Text style={styles.listName} numberOfLines={1}>
          {list.name}
        </Text>
        {list.description ? (
          <Text style={styles.listDesc} numberOfLines={1}>
            {list.description}
          </Text>
        ) : null}
        <View style={styles.listMeta}>
          {list.isShared ? (
            <View style={styles.sharedBadge}>
              <Ionicons name="people" size={10} color={Colors.secondary} />
              <Text style={styles.sharedText}>Shared</Text>
            </View>
          ) : (
            <View style={styles.sharedBadge}>
              <Ionicons name="person" size={10} color={Colors.textMuted} />
              <Text style={[styles.sharedText, { color: Colors.textMuted }]}>Personal</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  listIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listContent: { flex: 1, gap: 2 },
  listName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  listDesc: { fontSize: 13, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  listMeta: { flexDirection: "row", marginTop: 4 },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.secondary + "15",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sharedText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.secondary },
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
