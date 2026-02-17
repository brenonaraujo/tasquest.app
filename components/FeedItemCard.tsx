import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import type { FeedItem } from "@/lib/types";
import { formatDistanceToNow, format, isPast, isToday } from "date-fns";
import * as Haptics from "expo-haptics";

const FEED_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; verb: string }> = {
  task_created: { icon: "add-circle", color: Colors.info, verb: "created a task" },
  task_started: { icon: "play-circle", color: Colors.statusInProgress, verb: "started working on" },
  task_completed: { icon: "checkmark-circle", color: Colors.success, verb: "completed" },
  task_pending_approval: { icon: "time", color: Colors.secondary, verb: "submitted for approval" },
  task_approved: { icon: "shield-checkmark", color: Colors.success, verb: "approved" },
  task_rejected: { icon: "close-circle", color: Colors.danger, verb: "rejected" },
  list_invite_created: { icon: "person-add", color: Colors.info, verb: "invited someone to" },
  user_level_up: { icon: "arrow-up-circle", color: Colors.accent, verb: "leveled up!" },
  reminder_due_today: { icon: "alarm", color: Colors.warning, verb: "due today" },
};

interface FeedItemCardProps {
  item: FeedItem;
  onDismiss?: (id: string) => void;
}

export default function FeedItemCard({ item, onDismiss }: FeedItemCardProps) {
  const config = FEED_CONFIG[item.type] || { icon: "ellipsis-horizontal-circle", color: Colors.textMuted, verb: item.type };
  const payload = item.payload || {};
  const actorName = (payload.actorName as string) || "Someone";
  const taskTitle = (payload.taskTitle as string) || (payload.title as string) || "";
  const xpGained = payload.xpGained as number | undefined;
  const rewardXp = payload.rewardXp as number | undefined;
  const newLevel = payload.newLevel as number | undefined;
  const dueAt = payload.dueAt as string | undefined;
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  const isInProgress = item.type === "task_started";

  const dueDate = dueAt ? new Date(dueAt) : null;
  const isOverdue = dueDate && isPast(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  function handlePress() {
    if (item.taskId) {
      router.push({ pathname: "/task/[id]", params: { id: item.taskId, listId: item.listId || "" } });
    }
  }

  if (isInProgress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
        onPress={handlePress}
      >
        <View style={styles.taskCardTop}>
          <View style={styles.taskCardRow}>
            <View style={[styles.statusDot, { backgroundColor: Colors.statusInProgress }]} />
            <View style={styles.taskCardContent}>
              <Text style={styles.taskCardTitle} numberOfLines={2}>{taskTitle}</Text>
              <Text style={styles.taskCardActor}>
                <Text style={styles.actor}>{actorName}</Text> {config.verb}
              </Text>
            </View>
            {(rewardXp || xpGained) ? (
              <View style={styles.xpBadge}>
                <Ionicons name="diamond" size={12} color={Colors.xp} />
                <Text style={styles.xpBadgeText}>{rewardXp || xpGained}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.taskCardFooter}>
          <View style={styles.taskCardTags}>
            <View style={[styles.statusTag, { backgroundColor: Colors.statusInProgress + "20" }]}>
              <Ionicons name="flash" size={10} color={Colors.statusInProgress} />
              <Text style={[styles.tagText, { color: Colors.statusInProgress }]}>Active</Text>
            </View>
            {dueDate ? (
              <View style={[styles.statusTag, { backgroundColor: (isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textMuted) + "20" }]}>
                <Ionicons name="calendar-outline" size={10} color={isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textSecondary} />
                <Text style={[styles.tagText, { color: isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textSecondary }]}>
                  {isOverdue ? "Overdue" : isDueToday ? "Today" : format(dueDate, "MMM d")}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.taskCardMeta}>
            <Text style={styles.time}>{timeAgo}</Text>
            {onDismiss ? (
              <Pressable
                onPress={() => {
                  onDismiss(item.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                hitSlop={10}
                style={({ pressed }) => [pressed && { opacity: 0.5 }]}
              >
                <Ionicons name="eye-off-outline" size={14} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.color + "20" }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.actor}>{actorName}</Text> {config.verb}
          {taskTitle ? <Text style={styles.taskRef}> "{taskTitle}"</Text> : null}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.time}>{timeAgo}</Text>
          {(rewardXp || xpGained) ? (
            <View style={styles.xpPill}>
              <Ionicons name="diamond" size={10} color={Colors.xp} />
              <Text style={styles.xpVal}>{xpGained ? `+${xpGained}` : `${rewardXp}`}</Text>
            </View>
          ) : null}
          {newLevel ? (
            <View style={[styles.xpPill, { backgroundColor: Colors.level + "20" }]}>
              <Ionicons name="star" size={10} color={Colors.level} />
              <Text style={[styles.xpVal, { color: Colors.level }]}>Lv.{newLevel}</Text>
            </View>
          ) : null}
          {dueDate ? (
            <View style={[styles.xpPill, { backgroundColor: (isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textMuted) + "15" }]}>
              <Ionicons name="calendar-outline" size={10} color={isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textSecondary} />
              <Text style={[styles.xpVal, { color: isOverdue ? Colors.danger : isDueToday ? Colors.accent : Colors.textSecondary }]}>
                {isOverdue ? "Overdue" : isDueToday ? "Today" : format(dueDate, "MMM d")}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {onDismiss ? (
        <Pressable
          onPress={() => {
            onDismiss(item.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="eye-off-outline" size={14} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 4 },
  text: { fontSize: 14, color: Colors.text, lineHeight: 20, fontFamily: "Inter_400Regular" },
  actor: { fontFamily: "Inter_600SemiBold", color: Colors.text },
  taskRef: { fontFamily: "Inter_500Medium", color: Colors.primaryLight },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  time: { fontSize: 11, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.xp + "15",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  xpVal: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.xp },
  hideBtn: { padding: 4, marginTop: 2 },

  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.statusInProgress + "50",
    borderLeftWidth: 3,
    borderLeftColor: Colors.statusInProgress,
  },
  taskCardTop: { marginBottom: 10 },
  taskCardRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  taskCardContent: { flex: 1, gap: 2 },
  taskCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  taskCardActor: { fontSize: 12, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.xp + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  xpBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.xp },
  taskCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  taskCardTags: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  taskCardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
});
