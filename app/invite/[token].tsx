import { useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import type { AcceptListInviteResponse, ListInviteResponse } from "@/lib/types";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    data: invite,
    isLoading,
    refetch,
  } = useQuery<ListInviteResponse>({
    queryKey: ["/api/v1/invites", token],
    enabled: isAuthenticated && !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/v1/invites/${token}/accept`);
      return (await res.json()) as AcceptListInviteResponse;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/(lists)/[id]", params: { id: data.listId } });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/v1/invites/${token}/reject`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.back();
    },
  });

  const inviteStatus = useMemo(() => {
    if (!invite) return "";
    if (invite.revokedAt) return "revoked";
    if (invite.acceptedAt) return "accepted";
    return "pending";
  }, [invite]);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topTitle}>List Invite</Text>
          {invite?.listName ? (
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {invite.listName}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 28 }} />
      </View>

      {!isAuthenticated ? (
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={50} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to view this invite</Text>
          <Text style={styles.emptyText}>Log in to accept or reject list invitations.</Text>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Go to login</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : invite ? (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{invite.listName}</Text>
            <Text style={styles.cardSubtitle}>Invited by {invite.invitedByName}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="people" size={12} color={Colors.secondary} />
                <Text style={styles.metaText}>{invite.role.toUpperCase()}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="calendar" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaText}>Expires {new Date(invite.expiresAt).toLocaleDateString()}</Text>
              </View>
            </View>
            {inviteStatus !== "pending" ? (
              <View style={styles.statusRow}>
                <Ionicons
                  name={inviteStatus === "accepted" ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={inviteStatus === "accepted" ? Colors.success : Colors.danger}
                />
                <Text style={styles.statusText}>
                  {inviteStatus === "accepted" ? "Invitation accepted" : "Invitation revoked"}
                </Text>
              </View>
            ) : null}
          </View>

          {inviteStatus === "pending" ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending || acceptMutation.isPending}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  (rejectMutation.isPending || acceptMutation.isPending) && styles.btnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator size={14} color={Colors.danger} />
                ) : (
                  <Text style={styles.secondaryBtnText}>Reject</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || rejectMutation.isPending}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (acceptMutation.isPending || rejectMutation.isPending) && styles.btnDisabled,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {acceptMutation.isPending ? (
                  <ActivityIndicator size={14} color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Accept invite</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.secondaryBtnText}>Refresh status</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.centered}>
          <Ionicons name="mail-open-outline" size={50} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Invite not found</Text>
          <Text style={styles.emptyText}>This invite may have expired or been revoked.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: Colors.background,
  },
  topBarCenter: { flex: 1, gap: 2 },
  topTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  topSubtitle: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  cardTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  cardSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  actionRow: { flexDirection: "row", gap: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.danger + "55",
    backgroundColor: Colors.danger + "10",
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.danger },
  btnDisabled: { opacity: 0.6 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
});
