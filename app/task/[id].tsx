import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/query-client";
import type { Task, TaskComment, VoteTaskCommentRequest } from "@/lib/types";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  open: { color: Colors.statusOpen, label: "Open" },
  in_progress: { color: Colors.statusInProgress, label: "In Progress" },
  pending_approval: { color: Colors.statusPendingApproval, label: "Pending Approval" },
  completed: { color: Colors.statusCompleted, label: "Completed" },
  cancelled: { color: Colors.statusCancelled, label: "Cancelled" },
};

export default function TaskDetailScreen() {
  const { id, listId } = useLocalSearchParams<{ id: string; listId?: string }>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [commentText, setCommentText] = useState("");

  const {
    data: taskData,
    isLoading,
    refetch,
  } = useQuery<Task>({
    queryKey: [`/api/v1/tasks/${id}`],
    enabled: isAuthenticated && !!id,
  });

  const { data: commentsData, refetch: refetchComments } = useQuery<{ data: TaskComment[] }>({
    queryKey: [`/api/v1/tasks/${id}/comments`],
    enabled: isAuthenticated && !!id,
  });

  const task = taskData;
  const comments = commentsData?.data || [];

  function invalidateAll() {
    refetch();
    refetchComments();
    const lid = listId || task?.listId;
    if (lid) queryClient.invalidateQueries({ queryKey: [`/api/v1/lists/${lid}/tasks`] });
    queryClient.invalidateQueries({ queryKey: ["/api/v1/feed"] });
    refreshProfile();
  }

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v1/tasks/${id}/start`),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); invalidateAll(); },
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v1/tasks/${id}/complete`),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); invalidateAll(); },
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/v1/tasks/${id}/approve`),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); invalidateAll(); },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => apiRequest("POST", `/api/v1/tasks/${id}/reject`, { reason }),
    onSuccess: () => { invalidateAll(); },
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/v1/tasks/${id}/comments`, { content }),
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ commentId, value }: { commentId: string; value: -1 | 0 | 1 }) =>
      apiRequest("POST", `/api/v1/comments/${commentId}/vote`, { value } as VoteTaskCommentRequest),
    onSuccess: () => refetchComments(),
  });

  const subtaskMutation = useMutation({
    mutationFn: ({ subtaskId, isDone }: { subtaskId: string; isDone: boolean }) =>
      apiRequest("PATCH", `/api/v1/subtasks/${subtaskId}`, { isDone }),
    onSuccess: () => { refetch(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  });

  function handleReject() {
    if (Platform.OS === "web") {
      const reason = prompt("Provide a reason for rejection (min 5 characters):");
      if (reason && reason.length >= 5) rejectMutation.mutate(reason);
      return;
    }
    Alert.prompt(
      "Reject Task",
      "Provide a reason for rejection (min 5 characters):",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: (reason) => {
            if (reason && reason.length >= 5) rejectMutation.mutate(reason);
          },
        },
      ],
      "plain-text",
    );
  }

  if (isLoading || !task) {
    return (
      <View style={[styles.centered, { paddingTop: topPad }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
  const isAssignedToMe = task.assigneeUserId === user?.id;
  const isCreator = task.creatorUserId === user?.id;
  const canStart = task.status === "open";
  const canComplete = task.status === "in_progress" && isAssignedToMe;
  const canApprove = task.status === "pending_approval" && isCreator;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>Task Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.statusBanner, { backgroundColor: statusCfg.color + "15" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            <View style={styles.xpReward}>
              <Ionicons name="diamond" size={14} color={Colors.xp} />
              <Text style={styles.xpRewardText}>{task.rewardXp} XP</Text>
            </View>
          </View>

          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}

          <View style={styles.metaGrid}>
            {task.dueAt ? (
              <MetaItem icon="calendar" label="Due" value={format(new Date(task.dueAt), "MMM d, yyyy")} />
            ) : null}
            {task.completedAt ? (
              <MetaItem icon="checkmark-done" label="Completed" value={format(new Date(task.completedAt), "MMM d, yyyy")} />
            ) : null}
            {task.needsApproval ? (
              <MetaItem icon="shield-checkmark" label="Approval" value="Required" />
            ) : null}
          </View>

          {(canStart || canComplete || canApprove) ? (
            <View style={styles.actions}>
              {canStart ? (
                <ActionBtn label="Start Task" icon="play" color={Colors.statusInProgress} loading={startMutation.isPending} onPress={() => startMutation.mutate()} />
              ) : null}
              {canComplete ? (
                <ActionBtn label="Complete" icon="checkmark" color={Colors.success} loading={completeMutation.isPending} onPress={() => completeMutation.mutate()} />
              ) : null}
              {canApprove ? (
                <View style={styles.approvalActions}>
                  <ActionBtn label="Approve" icon="shield-checkmark" color={Colors.success} loading={approveMutation.isPending} onPress={() => approveMutation.mutate()} />
                  <ActionBtn label="Reject" icon="close-circle" color={Colors.danger} loading={rejectMutation.isPending} onPress={handleReject} />
                </View>
              ) : null}
            </View>
          ) : null}

          {task.subtasks && task.subtasks.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Subtasks ({task.subtasks.filter((s) => s.isDone).length}/{task.subtasks.length})
              </Text>
              {task.subtasks.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={styles.subtaskRow}
                  onPress={() => subtaskMutation.mutate({ subtaskId: sub.id, isDone: !sub.isDone })}
                >
                  <Ionicons
                    name={sub.isDone ? "checkbox" : "square-outline"}
                    size={20}
                    color={sub.isDone ? Colors.success : Colors.textMuted}
                  />
                  <Text style={[styles.subtaskText, sub.isDone && styles.subtaskDone]}>{sub.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} onVote={(val) => voteMutation.mutate({ commentId: c.id, value: val })} />
            ))}
            {comments.length === 0 ? (
              <Text style={styles.noComments}>No comments yet</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.commentBar, { paddingBottom: bottomPad + 8 }]}>
          <TextInput
            style={styles.commentInput}
            placeholder="Write a comment..."
            placeholderTextColor={Colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Pressable
            onPress={() => {
              if (commentText.trim()) commentMutation.mutate(commentText.trim());
            }}
            disabled={!commentText.trim() || commentMutation.isPending}
          >
            <Ionicons
              name="send"
              size={22}
              color={commentText.trim() ? Colors.primary : Colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MetaItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={Colors.textMuted} />
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  label, icon, color, loading, onPress,
}: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: color }, pressed && { opacity: 0.8 }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color={Colors.white} size="small" /> : (
        <>
          <Ionicons name={icon} size={16} color={Colors.white} />
          <Text style={styles.actionBtnText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function CommentCard({ comment, onVote }: { comment: TaskComment; onVote: (v: -1 | 0 | 1) => void }) {
  return (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>{comment.author.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commentAuthor}>{comment.author.name}</Text>
          <Text style={styles.commentTime}>{format(new Date(comment.createdAt), "MMM d, h:mm a")}</Text>
        </View>
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
      <View style={styles.voteRow}>
        <Pressable
          style={[styles.voteBtn, comment.userVote === 1 && styles.voteBtnActive]}
          onPress={() => onVote(comment.userVote === 1 ? 0 : 1)}
        >
          <Ionicons name="thumbs-up" size={14} color={comment.userVote === 1 ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.voteCount, comment.userVote === 1 && { color: Colors.primary }]}>{comment.likes}</Text>
        </Pressable>
        <Pressable
          style={[styles.voteBtn, comment.userVote === -1 && styles.voteBtnActive]}
          onPress={() => onVote(comment.userVote === -1 ? 0 : -1)}
        >
          <Ionicons name="thumbs-down" size={14} color={comment.userVote === -1 ? Colors.primaryDark : Colors.textMuted} />
          <Text style={[styles.voteCount, comment.userVote === -1 && { color: Colors.primaryDark }]}>{comment.dislikes}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.background,
  },
  topTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center" as const },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  xpReward: { flexDirection: "row", alignItems: "center", gap: 4 },
  xpRewardText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.xp },
  taskTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  taskDesc: { fontSize: 15, color: Colors.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 16 },
  metaGrid: { gap: 8, marginBottom: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontSize: 12, color: Colors.textMuted, fontFamily: "Inter_500Medium" },
  metaValue: { fontSize: 13, color: Colors.text, fontFamily: "Inter_500Medium" },
  actions: { marginBottom: 20, gap: 10 },
  approvalActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 10 },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  subtaskText: { fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular", flex: 1 },
  subtaskDone: { textDecorationLine: "line-through", color: Colors.textMuted },
  noComments: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_400Regular" },
  commentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold", color: Colors.primary },
  commentAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text },
  commentTime: { fontSize: 10, color: Colors.textMuted, fontFamily: "Inter_400Regular" },
  commentContent: { fontSize: 14, color: Colors.text, fontFamily: "Inter_400Regular", lineHeight: 20 },
  voteRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  voteBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  voteBtnActive: { backgroundColor: Colors.primary + "12" },
  voteCount: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  commentBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    maxHeight: 80,
  },
});
