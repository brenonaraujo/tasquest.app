import { useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import XPBar from "@/components/XPBar";
import type { LedgerEntry } from "@/lib/types";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, refreshProfile } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery<{ data: LedgerEntry[] }>({
    queryKey: ["/api/v1/me/ledger"],
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace("/(auth)/login");
  }

  if (!user) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const ledger = ledgerData?.data || [];
  const recentLedger = ledger.slice(0, 10);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: topPad + 12,
        paddingHorizontal: 16,
        paddingBottom: 120 + bottomPad,
      }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatarLg}>
          <Text style={styles.avatarLgText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      <View style={styles.xpCard}>
        <XPBar
          level={user.level}
          totalXp={user.totalXp}
          xpToNextLevel={user.xpToNextLevel}
          energy={user.creationXpBalance}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatBox icon="diamond" color={Colors.xp} label="Total XP" value={String(user.totalXp)} />
        <StatBox icon="star" color={Colors.level} label="Level" value={String(user.level)} />
        <StatBox icon="flash" color={Colors.energy} label="Energy" value={String(user.creationXpBalance)} />
        <StatBox icon="arrow-forward" color={Colors.info} label="Next Level" value={`${user.xpToNextLevel} XP`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {ledgerLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
        ) : recentLedger.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet</Text>
        ) : (
          recentLedger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

function StatBox({ icon, color, label, value }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit = entry.direction === "credit";
  const isXp = entry.resourceType === "xp";

  return (
    <View style={styles.ledgerRow}>
      <View style={[styles.ledgerIcon, { backgroundColor: (isXp ? Colors.xp : Colors.energy) + "15" }]}>
        <Ionicons name={isXp ? "diamond" : "flash"} size={14} color={isXp ? Colors.xp : Colors.energy} />
      </View>
      <View style={styles.ledgerContent}>
        <Text style={styles.ledgerSource}>{entry.sourceType.replace(/_/g, " ")}</Text>
        <Text style={styles.ledgerMeta}>Balance: {entry.balanceAfter}</Text>
      </View>
      <Text style={[styles.ledgerAmount, isCredit ? styles.ledgerCredit : styles.ledgerDebit]}>
        {isCredit ? "+" : "-"}{entry.amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileCard: { alignItems: "center", marginBottom: 20 },
  avatarLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + "30",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLgText: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.primary },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text },
  userEmail: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  xpCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 12 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  ledgerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ledgerContent: { flex: 1, gap: 1 },
  ledgerSource: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text, textTransform: "capitalize" as const },
  ledgerMeta: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  ledgerAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  ledgerCredit: { color: Colors.success },
  ledgerDebit: { color: Colors.danger },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger + "30",
    marginTop: 10,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.danger },
});
