import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import type { FeedItem, Task } from "@/lib/types";
import { formatDistanceToNow, format, isPast, isToday } from "date-fns";
import * as Haptics from "expo-haptics";
import TaskCard from "@/components/TaskCard";

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

const ACTIVE_TASK_TYPES = new Set(["task_started", "task_pending_approval"]);
const ACTIVE_TASK_STATUSES = new Set(["in_progress", "pending_approval"]);

interface FeedItemCardProps {
  item: FeedItem;
  onDismiss?: (id: string) => void;
  onUndismiss?: (id: string) => void;
}

export default function FeedItemCard({ item, onDismiss, onUndismiss }: FeedItemCardProps) {
  const isActiveType = ACTIVE_TASK_TYPES.has(item.type);

  if (isActiveType && item.taskId) {
    return <ActiveTaskFeedCard item={item} onDismiss={onDismiss} onUndismiss={onUndismiss} />;
  }

  return <StandardFeedCard item={item} onDismiss={onDismiss} onUndismiss={onUndismiss} />;
}

function ActiveTaskFeedCard({ item, onDismiss, onUndismiss }: FeedItemCardProps) {
  const payload = item.payload || {};
  const actorName = (payload.actorName as string) || "Someone";
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: [`/api/v1/tasks/${item.taskId}`],
    enabled: !!item.taskId,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>
    );
  }

  if (!task) {
    return <StandardFeedCard item={item} onDismiss={onDismiss} onUndismiss={onUndismiss} />;
  }

  if (!ACTIVE_TASK_STATUSES.has(task.status)) {
    return null;
  }

  return (
    <View>
      <TaskCard task={task} />
      <View style={styles.taskMeta}>
        <View style={styles.taskMetaLeft}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarText}>{actorName.charAt(0)}</Text>
          </View>
          <Text style={styles.actorSmall}>{actorName}</Text>
          <Text style={styles.dotSep}>·</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>
    </View>
  );
}

function StandardFeedCard({ item, onDismiss, onUndismiss }: FeedItemCardProps) {
  const config = FEED_CONFIG[item.type] || { icon: "ellipsis-horizontal-circle", color: Colors.textMuted, verb: item.type };
  const payload = item.payload || {};
  const actorName = (payload.actorName as string) || "Someone";
  const taskTitle = (payload.taskTitle as string) || (payload.title as string) || "";
  const xpGained = (payload.xpGained as number) || (payload.xp as number) || undefined;
  const rewardXp = payload.rewardXp as number | undefined;
  const newLevel = payload.newLevel as number | undefined;
  const toLevel = payload.toLevel as number | undefined;
  const dueAt = payload.dueAt as string | undefined;
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

  const dueDate = dueAt ? new Date(dueAt) : null;
  const isOverdue = dueDate && isPast(dueDate);
  const isDueToday = dueDate && isToday(dueDate);

  const displayLevel = newLevel || toLevel;

  function handlePress() {
    if (item.taskId) {
      router.push({ pathname: "/task/[id]", params: { id: item.taskId, listId: item.listId || "" } });
    }
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
          {displayLevel ? (
            <View style={[styles.xpPill, { backgroundColor: Colors.level + "20" }]}>
              <Ionicons name="star" size={10} color={Colors.level} />
              <Text style={[styles.xpVal, { color: Colors.level }]}>Lv.{displayLevel}</Text>
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
      {onUndismiss ? (
        <Pressable
          onPress={() => {
            onUndismiss(item.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="eye-outline" size={16} color={Colors.primary} />
        </Pressable>
      ) : onDismiss ? (
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

  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  taskMetaLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  avatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.primary },
  actorSmall: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  dotSep: { fontSize: 11, color: Colors.textMuted },
});
