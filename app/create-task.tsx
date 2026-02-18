import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient, getApiUrl, getAuthToken } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import { useAuth } from "@/lib/auth-context";
import type { XPSuggestionResponse, TaskList, ListMember } from "@/lib/types";
import { format } from "date-fns";

export default function CreateTaskScreen() {
  const params = useLocalSearchParams<{ listId?: string }>();
  const { isAuthenticated, user } = useAuth();
  const [selectedListId, setSelectedListId] = useState(params.listId || "");
  const [showListPicker, setShowListPicker] = useState(!params.listId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardXp, setRewardXp] = useState(10);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [approverUserId, setApproverUserId] = useState<string | null>(null);
  const [showApproverPicker, setShowApproverPicker] = useState(false);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [dueAtInput, setDueAtInput] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const webDateInputProps: Partial<TextInputProps> & { type?: string } =
    Platform.OS === "web" ? ({ type: "datetime-local" } as Partial<TextInputProps>) : {};
  const [subtaskInputs, setSubtaskInputs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiJustification, setAiJustification] = useState("");

  const { data: listsData } = useQuery<{ data: TaskList[] }>({
    queryKey: ["/api/v1/lists"],
    enabled: isAuthenticated,
  });

  const { data: membersData } = useQuery<{ data: ListMember[] }>({
    queryKey: [`/api/v1/lists/${selectedListId}/members`],
    enabled: isAuthenticated && !!selectedListId,
  });

  const lists = listsData?.data || [];
  const members = membersData?.data || [];
  const selectedList = lists.find((l) => l.id === selectedListId);
  const selectedAssignee = members.find((m) => m.userId === assigneeUserId);
  const selectedApprover = members.find((m) => m.userId === approverUserId);

  useEffect(() => {
    if (!selectedListId && lists.length === 1) {
      setSelectedListId(lists[0].id);
      setShowListPicker(false);
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    if (!needsApproval) return;
    if (approverUserId) return;
    if (user?.id) setApproverUserId(user.id);
  }, [needsApproval, approverUserId, user?.id]);

  useEffect(() => {
    if (!needsApproval) return;
    if (members.length === 0) return;
    const activeMemberIds = new Set(members.filter((m) => m.status === "active").map((m) => m.userId));
    if (approverUserId && activeMemberIds.has(approverUserId)) return;
    if (user?.id && activeMemberIds.has(user.id)) {
      setApproverUserId(user.id);
      return;
    }
    const firstActive = members.find((m) => m.status === "active");
    if (firstActive) setApproverUserId(firstActive.userId);
  }, [members, needsApproval, approverUserId, user?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        rewardXp,
        needsApproval,
        assigneeUserId: assigneeUserId || null,
      };
      if (needsApproval && approverUserId) {
        payload.approverUserId = approverUserId;
      }
      if (dueAt) {
        payload.dueAt = dueAt.toISOString();
      }
      const res = await apiRequest("POST", `/api/v1/lists/${selectedListId}/tasks`, payload);
      const task = await res.json();
      const validSubtasks = subtaskInputs.filter((s) => s.trim());
      for (const st of validSubtasks) {
        await apiRequest("POST", `/api/v1/tasks/${task.id}/subtasks`, { title: st.trim() });
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/lists/${selectedListId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/active-tasks"] });
      router.back();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create task");
    },
  });

  async function suggestXP() {
    if (!title.trim()) {
      setError("Enter a title first");
      return;
    }
    setAiLoading(true);
    setAiJustification("");
    setError("");
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/xp-suggest", baseUrl);
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      if (res.ok) {
        const data = (await res.json()) as XPSuggestionResponse;
        setRewardXp(data.suggestedXp);
        setAiJustification(data.justification);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setError("AI suggestion unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  function addSubtaskInput() {
    setSubtaskInputs((prev) => [...prev, ""]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function updateSubtask(index: number, text: string) {
    setSubtaskInputs((prev) => prev.map((s, i) => (i === index ? text : s)));
  }

  function removeSubtask(index: number) {
    setSubtaskInputs((prev) => prev.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleSubmit() {
    if (!selectedListId) {
      setError("Select a list first");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (rewardXp < 5 || rewardXp > 50) {
      setError("XP must be between 5 and 50");
      return;
    }
    if (Platform.OS === "web" && dueAtInput && !dueAt) {
      setError("Deadline must be a valid date and time");
      return;
    }
    if (needsApproval && !approverUserId) {
      setError("Select an approver");
      return;
    }
    setError("");
    createMutation.mutate();
  }

  const xpSliderValues = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.sheetTitle}>New Task</Text>
          <View style={{ width: 32 }} />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>List</Text>
          {showListPicker ? (
            <View style={styles.pickerContainer}>
              {lists.length === 0 ? (
                <Text style={styles.pickerEmpty}>No lists available. Create one first.</Text>
              ) : (
                lists.map((list) => (
                  <Pressable
                    key={list.id}
                    style={({ pressed }) => [
                      styles.pickerItem,
                      selectedListId === list.id && styles.pickerItemActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      setSelectedListId(list.id);
                      setShowListPicker(false);
                      setAssigneeUserId(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name={list.isShared ? "people" : "list"}
                      size={16}
                      color={selectedListId === list.id ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedListId === list.id && { color: Colors.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {list.name}
                    </Text>
                    {selectedListId === list.id ? (
                      <Ionicons name="checkmark" size={16} color={Colors.primary} />
                    ) : null}
                  </Pressable>
                ))
              )}
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.selectedPill, pressed && { opacity: 0.8 }]}
              onPress={() => setShowListPicker(true)}
            >
              <Ionicons
                name={selectedList?.isShared ? "people" : "list"}
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.selectedPillText} numberOfLines={1}>
                {selectedList?.name || "Select list"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="What needs to be done?"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add more details..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            numberOfLines={3}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.deadlineHeader}>
            <Text style={styles.label}>Deadline</Text>
            {dueAt ? (
              <Pressable
                onPress={() => {
                  setDueAt(null);
                  setDueAtInput("");
                }}
                style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={14} color={Colors.textMuted} />
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {Platform.OS === "web" ? (
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DDTHH:mm"
              placeholderTextColor={Colors.textMuted}
              value={dueAtInput}
              onChangeText={(value) => {
                setDueAtInput(value);
                const parsed = new Date(value);
                if (!Number.isNaN(parsed.getTime())) {
                  setDueAt(parsed);
                } else {
                  setDueAt(null);
                }
              }}
              {...webDateInputProps}
            />
          ) : (
            <Pressable
              style={({ pressed }) => [styles.selectedPill, pressed && { opacity: 0.8 }]}
              onPress={() => {
                if (Platform.OS === "ios") {
                  setShowDatePicker(true);
                } else {
                  setShowDatePicker(true);
                }
              }}
            >
              <Ionicons name="calendar" size={16} color={Colors.textMuted} />
              <Text style={[styles.selectedPillText, !dueAt && { color: Colors.textMuted }]}>
                {dueAt ? format(dueAt, "MMM d, yyyy • HH:mm") : "Add date & time"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
            </Pressable>
          )}
          {showDatePicker && Platform.OS !== "web" ? (
            <DateTimePicker
              mode={Platform.OS === "ios" ? "datetime" : "date"}
              value={dueAt || new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, selectedDate) => {
                setShowDatePicker(false);
                if (!selectedDate) return;
                if (Platform.OS === "android") {
                  setDueAt(selectedDate);
                  setShowTimePicker(true);
                } else {
                  setDueAt(selectedDate);
                }
              }}
            />
          ) : null}
          {showTimePicker && Platform.OS === "android" ? (
            <DateTimePicker
              mode="time"
              value={dueAt || new Date()}
              display="default"
              onChange={(_event, selectedDate) => {
                setShowTimePicker(false);
                if (!selectedDate || !dueAt) return;
                const merged = new Date(dueAt);
                merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                setDueAt(merged);
              }}
            />
          ) : null}
        </View>

        {selectedListId && members.length > 0 ? (
          <View style={styles.field}>
            <Text style={styles.label}>Assign to</Text>
            {showAssigneePicker ? (
              <View style={styles.pickerContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerItem,
                    !assigneeUserId && styles.pickerItemActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => {
                    setAssigneeUserId(null);
                    setShowAssigneePicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.pickerItemText}>Unassigned</Text>
                </Pressable>
                {members
                  .filter((m) => m.status === "active")
                  .map((member) => (
                    <Pressable
                      key={member.userId}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        assigneeUserId === member.userId && styles.pickerItemActive,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        setAssigneeUserId(member.userId);
                        setShowAssigneePicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            assigneeUserId === member.userId && { color: Colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {member.name}
                        </Text>
                        <Text style={styles.memberRole}>{member.role}</Text>
                      </View>
                      {assigneeUserId === member.userId ? (
                        <Ionicons name="checkmark" size={16} color={Colors.primary} />
                      ) : null}
                    </Pressable>
                  ))}
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.selectedPill, pressed && { opacity: 0.8 }]}
                onPress={() => setShowAssigneePicker(true)}
              >
                {selectedAssignee ? (
                  <>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {selectedAssignee.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.selectedPillText}>{selectedAssignee.name}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={16} color={Colors.textMuted} />
                    <Text style={[styles.selectedPillText, { color: Colors.textMuted }]}>
                      Tap to assign
                    </Text>
                  </>
                )}
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.field}>
          <View style={styles.xpHeader}>
            <Text style={styles.label}>XP Reward</Text>
            <Pressable
              style={({ pressed }) => [
                styles.aiBtn,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
                aiLoading && { opacity: 0.6 },
              ]}
              onPress={suggestXP}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator color={Colors.secondary} size="small" />
              ) : (
                <Ionicons name="sparkles" size={16} color={Colors.secondary} />
              )}
              <Text style={styles.aiBtnText}>AI Suggest</Text>
            </Pressable>
          </View>

          <View style={styles.xpDisplay}>
            <Ionicons name="diamond" size={24} color={Colors.xp} />
            <Text style={styles.xpValue}>{rewardXp}</Text>
            <Text style={styles.xpUnit}>XP</Text>
          </View>

          <View style={styles.xpPicker}>
            {xpSliderValues.map((val) => (
              <Pressable
                key={val}
                style={[styles.xpChip, rewardXp === val && styles.xpChipActive]}
                onPress={() => {
                  setRewardXp(val);
                  setAiJustification("");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.xpChipText, rewardXp === val && styles.xpChipTextActive]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>

          {aiJustification ? (
            <View style={styles.aiReason}>
              <Ionicons name="sparkles" size={12} color={Colors.secondary} />
              <Text style={styles.aiReasonText}>{aiJustification}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.field}>
          <View style={styles.subtaskHeader}>
            <Text style={styles.label}>Subtasks</Text>
            <Pressable
              style={({ pressed }) => [styles.addSubBtn, pressed && { opacity: 0.7 }]}
              onPress={addSubtaskInput}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addSubText}>Add</Text>
            </Pressable>
          </View>
          {subtaskInputs.map((st, i) => (
            <View key={i} style={styles.subtaskRow}>
              <View style={styles.subtaskDot} />
              <TextInput
                style={styles.subtaskInput}
                placeholder={`Subtask ${i + 1}`}
                placeholderTextColor={Colors.textMuted}
                value={st}
                onChangeText={(t) => updateSubtask(i, t)}
                maxLength={120}
              />
              <Pressable
                onPress={() => removeSubtask(i)}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.5 }]}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Requires Approval</Text>
            <Text style={styles.switchDesc}>A designated approver must approve before awarding XP</Text>
          </View>
          <Switch
            value={needsApproval}
            onValueChange={setNeedsApproval}
            trackColor={{ false: Colors.surfaceLight, true: Colors.primary + "60" }}
            thumbColor={needsApproval ? Colors.primary : Colors.textMuted}
          />
        </View>

        {needsApproval && selectedListId ? (
          <View style={styles.field}>
            <Text style={styles.label}>Aprovador</Text>
            {showApproverPicker ? (
              <View style={styles.pickerContainer}>
                {members
                  .filter((m) => m.status === "active")
                  .map((member) => (
                    <Pressable
                      key={member.userId}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        approverUserId === member.userId && styles.pickerItemActive,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => {
                        setApproverUserId(member.userId);
                        setShowApproverPicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.pickerItemText,
                            approverUserId === member.userId && { color: Colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {member.name}
                        </Text>
                        <Text style={styles.memberRole}>{member.role}</Text>
                      </View>
                      {approverUserId === member.userId ? (
                        <Ionicons name="checkmark" size={16} color={Colors.primary} />
                      ) : null}
                    </Pressable>
                  ))}
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.selectedPill, pressed && { opacity: 0.8 }]}
                onPress={() => setShowApproverPicker(true)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(selectedApprover?.name || user?.name || "A").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.selectedPillText}>
                  {approverUserId === user?.id ? "Aprovador: voce" : selectedApprover?.name || "Selecionar aprovador"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            createMutation.isPending && styles.submitDisabled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color={Colors.white} />
              <Text style={styles.submitText}>Create Task</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { padding: 20, paddingBottom: 40 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger + "15",
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: { fontSize: 12, color: Colors.danger, fontFamily: "Inter_500Medium", flex: 1 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" as const },
  pickerContainer: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  pickerItemActive: {
    backgroundColor: Colors.primary + "10",
  },
  pickerItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  pickerEmpty: {
    padding: 14,
    fontSize: 13,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectedPillText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  memberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary + "25",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  memberRole: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  xpHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondary + "15",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  aiBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.secondary },
  xpDisplay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  xpValue: { fontSize: 36, fontFamily: "Inter_700Bold", color: Colors.xp },
  xpUnit: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  xpPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  xpChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  xpChipActive: { backgroundColor: Colors.xp + "20", borderColor: Colors.xp },
  xpChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  xpChipTextActive: { color: Colors.xp },
  aiReason: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.secondary + "10",
    padding: 10,
    borderRadius: 8,
  },
  aiReasonText: { fontSize: 12, color: Colors.secondary, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },
  deadlineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  clearText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  subtaskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary + "15",
  },
  addSubText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  subtaskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  subtaskInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: Colors.surfaceLight,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  switchLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  switchDesc: { fontSize: 11, color: Colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
