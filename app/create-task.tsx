import { useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, queryClient, getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import type { XPSuggestionResponse } from "@/lib/types";

export default function CreateTaskScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardXp, setRewardXp] = useState(10);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiJustification, setAiJustification] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/v1/lists/${listId}/tasks`, {
        title: title.trim(),
        description: description.trim() || null,
        rewardXp,
        needsApproval,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/lists/${listId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/feed"] });
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

  function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (rewardXp < 5 || rewardXp > 50) {
      setError("XP must be between 5 and 50");
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
        <Text style={styles.sheetTitle}>New Task</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={14} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

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
          <View style={styles.xpHeader}>
            <Text style={styles.label}>XP Reward</Text>
            <Pressable
              style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.8 }, aiLoading && { opacity: 0.6 }]}
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

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Requires Approval</Text>
            <Text style={styles.switchDesc}>An admin must approve before awarding XP</Text>
          </View>
          <Switch
            value={needsApproval}
            onValueChange={setNeedsApproval}
            trackColor={{ false: Colors.surfaceLight, true: Colors.primary + "60" }}
            thumbColor={needsApproval ? Colors.primary : Colors.textMuted}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            createMutation.isPending && styles.submitDisabled,
            pressed && { opacity: 0.9 },
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
  sheetTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 20, textAlign: "center" as const },
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
