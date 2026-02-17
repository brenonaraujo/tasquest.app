import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import type { FeedItem } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
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
  hidden?: boolean;
  onToggleHide?: (id: string) => void;
}

export default function FeedItemCard({ item, hidden, onToggleHide }: FeedItemCardProps) {
  const config = FEED_CONFIG[item.type] || { icon: "ellipsis-horizontal-circle", color: Colors.textMuted, verb: item.type };
  const payload = item.payload || {};
  const actorName = (payload.actorName as string) || "Someone";
  const taskTitle = (payload.taskTitle as string) || (payload.title as string) || "";
  const xpGained = payload.xpGained as number | undefined;
  const newLevel = payload.newLevel as number | undefined;
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  const isInProgress = item.type === "task_started";

  function handlePress() {
    if (item.taskId) {
      router.push({ pathname: "/task/[id]", params: { id: item.taskId, listId: item.listId || "" } });
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isInProgress && styles.cardInProgress,
        hidden && styles.cardHidden,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <View style={[styles.iconWrap, { backgroundColor: config.color + "20" }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.text, hidden && styles.textHidden]} numberOfLines={2}>
          <Text style={styles.actor}>{actorName}</Text> {config.verb}
          {taskTitle ? <Text style={styles.taskRef}> "{taskTitle}"</Text> : null}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.time}>{timeAgo}</Text>
          {isInProgress ? (
            <View style={[styles.xpPill, { backgroundColor: Colors.statusInProgress + "20" }]}>
              <Ionicons name="flash" size={10} color={Colors.statusInProgress} />
              <Text style={[styles.xpVal, { color: Colors.statusInProgress }]}>Active</Text>
            </View>
          ) : null}
          {xpGained ? (
            <View style={styles.xpPill}>
              <Ionicons name="diamond" size={10} color={Colors.xp} />
              <Text style={styles.xpVal}>+{xpGained}</Text>
            </View>
          ) : null}
          {newLevel ? (
            <View style={[styles.xpPill, { backgroundColor: Colors.level + "20" }]}>
              <Ionicons name="star" size={10} color={Colors.level} />
              <Text style={[styles.xpVal, { color: Colors.level }]}>Lv.{newLevel}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {onToggleHide ? (
        <Pressable
          onPress={() => {
            onToggleHide(item.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          hitSlop={10}
          style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons
            name={hidden ? "eye-off-outline" : "eye-outline"}
            size={16}
            color={Colors.textMuted}
          />
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
  cardInProgress: {
    borderColor: Colors.statusInProgress + "50",
    borderLeftWidth: 3,
    borderLeftColor: Colors.statusInProgress,
  },
  cardHidden: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 4 },
  text: { fontSize: 14, color: Colors.text, lineHeight: 20, fontFamily: "Inter_400Regular" },
  textHidden: { color: Colors.textMuted },
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
  hideBtn: {
    padding: 4,
    marginTop: 2,
  },
});
