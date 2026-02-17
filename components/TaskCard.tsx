import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import type { Task, TaskStatus } from "@/lib/types";
import { format, isPast, isToday } from "date-fns";

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  open: { color: Colors.statusOpen, icon: "radio-button-off", label: "Open" },
  in_progress: { color: Colors.statusInProgress, icon: "play-circle", label: "In Progress" },
  pending_approval: { color: Colors.statusPendingApproval, icon: "time", label: "Pending" },
  completed: { color: Colors.statusCompleted, icon: "checkmark-circle", label: "Done" },
  cancelled: { color: Colors.statusCancelled, icon: "close-circle", label: "Cancelled" },
};

export default function TaskCard({ task, compact }: { task: Task; compact?: boolean }) {
  const config = STATUS_CONFIG[task.status];
  const completedSubtasks = task.subtasks?.filter((s) => s.isDone).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
  const isOverdue = dueDate && isPast(dueDate) && task.status !== "completed";
  const isDueToday = dueDate && isToday(dueDate);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id, listId: task.listId } })}
    >
      <View style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: config.color }]} />
        <View style={styles.content}>
          <Text style={[styles.title, task.status === "completed" && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {!compact && task.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {task.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.xpBadge}>
          <Ionicons name="diamond" size={12} color={Colors.xp} />
          <Text style={styles.xpText}>{task.rewardXp}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.tags}>
          <View style={[styles.statusTag, { backgroundColor: config.color + "20" }]}>
            <Ionicons name={config.icon} size={10} color={config.color} />
            <Text style={[styles.tagText, { color: config.color }]}>{config.label}</Text>
          </View>
          {task.needsApproval ? (
            <View style={[styles.statusTag, { backgroundColor: Colors.secondary + "20" }]}>
              <Ionicons name="shield-checkmark" size={10} color={Colors.secondary} />
              <Text style={[styles.tagText, { color: Colors.secondary }]}>Approval</Text>
            </View>
          ) : null}
          {totalSubtasks > 0 ? (
            <View style={[styles.statusTag, { backgroundColor: Colors.textMuted + "20" }]}>
              <Ionicons name="list" size={10} color={Colors.textSecondary} />
              <Text style={[styles.tagText, { color: Colors.textSecondary }]}>
                {completedSubtasks}/{totalSubtasks}
              </Text>
            </View>
          ) : null}
        </View>
        {dueDate ? (
          <Text style={[styles.dueText, isOverdue && styles.overdue, isDueToday && styles.dueToday]}>
            {isOverdue ? "Overdue" : isDueToday ? "Today" : format(dueDate, "MMM d")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  titleDone: { textDecorationLine: "line-through", color: Colors.textMuted },
  description: { fontSize: 13, color: Colors.textSecondary },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.xp + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  xpText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.xp },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  tags: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  dueText: { fontSize: 11, color: Colors.textSecondary, fontFamily: "Inter_500Medium" },
  overdue: { color: Colors.danger },
  dueToday: { color: Colors.accent },
});
