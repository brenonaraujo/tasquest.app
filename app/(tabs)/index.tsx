import { useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { queryClient } from "@/lib/query-client";
import XPBar from "@/components/XPBar";
import FeedItemCard from "@/components/FeedItemCard";
import type { FeedResponse } from "@/lib/types";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: feedData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<FeedResponse>({
    queryKey: ["/api/v1/feed"],
    enabled: isAuthenticated,
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

  if (authLoading) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return null;

  const feedItems = feedData?.data || [];

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        contentInsetAdjustmentBehavior="automatic"
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
            <Text style={styles.sectionTitle}>Activity Feed</Text>
          </View>
        }
        renderItem={({ item }) => <FeedItemCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
              <Pressable
                style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/(tabs)/lists")}
              >
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.emptyBtnText}>Get Started</Text>
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
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
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
