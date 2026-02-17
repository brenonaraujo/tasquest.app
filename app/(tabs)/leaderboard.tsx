import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import type { LeaderboardResponse, LeaderboardEntry, TaskList } from "@/lib/types";

const RANK_COLORS = [Colors.accent, "#C0C0C0", "#CD7F32"];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const { data: listsData } = useQuery<{ data: TaskList[] }>({
    queryKey: ["/api/v1/lists"],
    enabled: isAuthenticated,
  });

  const leaderboardKey = selectedListId
    ? `/api/v1/gamification/leaderboard/${selectedListId}`
    : "/api/v1/gamification/leaderboard/global";

  const { data, isLoading, refetch, isRefetching } = useQuery<LeaderboardResponse>({
    queryKey: [leaderboardKey],
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const entries = data?.data || [];
  const lists = listsData?.data || [];

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Ranking</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterStrip}
              contentContainerStyle={styles.filterContent}
            >
              <Pressable
                style={[styles.filterChip, !selectedListId && styles.filterChipActive]}
                onPress={() => {
                  setSelectedListId(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name="globe-outline"
                  size={13}
                  color={!selectedListId ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.filterText, !selectedListId && styles.filterTextActive]}>
                  Global
                </Text>
              </Pressable>
              {lists.map((list) => {
                const isActive = selectedListId === list.id;
                return (
                  <Pressable
                    key={list.id}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      setSelectedListId(list.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name={list.isShared ? "people-outline" : "list-outline"}
                      size={13}
                      color={isActive ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[styles.filterText, isActive && styles.filterTextActive]}
                      numberOfLines={1}
                    >
                      {list.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item, index }) => (
          <LeaderboardRow entry={item} rank={index + 1} isMe={item.userId === user?.id} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No rankings yet</Text>
              <Text style={styles.emptyText}>Complete tasks to earn XP and climb the leaderboard</Text>
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

function LeaderboardRow({ entry, rank, isMe }: { entry: LeaderboardEntry; rank: number; isMe: boolean }) {
  const isTop3 = rank <= 3;
  const rankColor = isTop3 ? RANK_COLORS[rank - 1] : Colors.textMuted;

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={[styles.rankBadge, isTop3 && { backgroundColor: rankColor + "20" }]}>
        {isTop3 ? (
          <Ionicons name="trophy" size={16} color={rankColor} />
        ) : (
          <Text style={styles.rankNum}>{rank}</Text>
        )}
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
          {entry.name} {isMe ? "(You)" : ""}
        </Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="star" size={10} color={Colors.level} />
            <Text style={styles.statText}>Lv.{entry.level}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle" size={10} color={Colors.success} />
            <Text style={styles.statText}>{entry.completedTasks}</Text>
          </View>
        </View>
      </View>

      <View style={styles.xpCol}>
        <Ionicons name="diamond" size={14} color={Colors.xp} />
        <Text style={styles.xpValue}>{entry.totalXp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },
  filterStrip: { marginBottom: 4 },
  filterContent: { gap: 6 },
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
    maxWidth: 150,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  rowMe: { borderColor: Colors.primary, borderWidth: 1.5 },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceLight,
  },
  rankNum: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.textMuted },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.primary },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  nameMe: { color: Colors.primary },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  xpCol: { alignItems: "center", gap: 2 },
  xpValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: Colors.xp },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" as const },
});
