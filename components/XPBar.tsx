import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

interface XPBarProps {
  level: number;
  totalXp: number;
  xpToNextLevel: number;
  energy: number;
  compact?: boolean;
}

export default function XPBar({ level, totalXp, xpToNextLevel, energy, compact }: XPBarProps) {
  const xpForCurrentLevel = 100 * level;
  const currentLevelProgress = xpForCurrentLevel > 0 ? Math.max(0, (xpForCurrentLevel - xpToNextLevel) / xpForCurrentLevel) : 0;
  const progressPercent = Math.min(currentLevelProgress, 1);

  const barStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progressPercent * 100}%`, { duration: 800 }),
  }));

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <View style={styles.levelBadge}>
          <Ionicons name="star" size={10} color={Colors.white} />
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <View style={styles.compactBar}>
          <Animated.View style={[styles.compactBarFill, barStyle]} />
        </View>
        <View style={styles.energyPill}>
          <Ionicons name="flash" size={10} color={Colors.energy} />
          <Text style={styles.energyVal}>{energy}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadgeLg}>
          <Ionicons name="star" size={16} color={Colors.white} />
          <Text style={styles.levelTextLg}>Level {level}</Text>
        </View>
        <View style={styles.xpInfo}>
          <Ionicons name="diamond" size={14} color={Colors.xp} />
          <Text style={styles.xpTotal}>{totalXp} XP</Text>
        </View>
      </View>
      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFill, barStyle]} />
      </View>
      <View style={styles.barMeta}>
        <Text style={styles.barLabel}>{xpToNextLevel} XP to next level</Text>
        <View style={styles.energyRow}>
          <Ionicons name="flash" size={14} color={Colors.energy} />
          <Text style={styles.energyLabel}>{energy} Energy</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelBadgeLg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.level,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  levelTextLg: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.white },
  xpInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  xpTotal: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.xp },
  barContainer: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: "hidden" as const,
  },
  barFill: {
    height: "100%",
    backgroundColor: Colors.xp,
    borderRadius: 4,
  },
  barMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barLabel: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  energyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  energyLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.energy },
  compactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.level,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  levelText: { fontSize: 11, fontFamily: "Inter_700Bold", color: Colors.white },
  compactBar: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  compactBarFill: {
    height: "100%",
    backgroundColor: Colors.xp,
    borderRadius: 3,
  },
  energyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.energy + "15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  energyVal: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.energy },
});
