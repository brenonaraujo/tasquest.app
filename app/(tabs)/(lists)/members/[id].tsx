import { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, getApiUrl, queryClient } from "@/lib/query-client";
import type { CreateListInviteResponse, ListMember, TaskList } from "@/lib/types";

const ROLE_LABELS: Record<ListMember["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_COLORS: Record<ListMember["role"], string> = {
  owner: Colors.secondary,
  admin: Colors.primary,
  member: Colors.textMuted,
};

export default function ListMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteData, setInviteData] = useState<CreateListInviteResponse | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  const { data: listData } = useQuery<TaskList>({
    queryKey: ["/api/v1/lists", id],
    enabled: isAuthenticated && !!id,
  });

  const {
    data: membersData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<{ data: ListMember[] }>({
    queryKey: [`/api/v1/lists/${id}/members`],
    enabled: isAuthenticated && !!id && !!listData?.isShared,
  });

  const members = membersData?.data || [];
  const currentMember = members.find((member) => member.userId === user?.id);
  const isOwner = !!user && listData?.ownerUserId === user.id;
  const isAdmin = currentMember?.role === "admin";
  const canManage = isOwner || isAdmin;

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/v1/lists/${id}/invites`, {
        email: email.trim().toLowerCase(),
      });
      return (await res.json()) as CreateListInviteResponse;
    },
    onSuccess: (data) => {
      setInviteError("");
      setInviteData(data);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: [`/api/v1/lists/${id}/members`] });
    },
    onError: (err: Error) => {
      setInviteError(err.message || "Failed to send invite");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (member: ListMember) => {
      const targetId = member.userId || member.id;
      if (!targetId) {
        throw new Error("Cannot revoke this member yet");
      }
      setRemovingId(targetId);
      setRemoveError("");
      await apiRequest("DELETE", `/api/v1/lists/${id}/members/${targetId}`);
    },
    onSuccess: () => {
      setRemovingId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/v1/lists/${id}/members`] });
    },
    onError: (err: Error) => {
      setRemovingId(null);
      setRemoveError(err.message || "Failed to update member");
    },
  });

  const inviteUrl = useMemo(() => {
    if (!inviteData) return "";
    const baseUrl = getApiUrl();
    return new URL(inviteData.invitePath, baseUrl).toString();
  }, [inviteData]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  function handleInvite() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setInviteError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setInviteError("Enter a valid email");
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === normalizedEmail)) {
      setInviteError("This email is already a member or has a pending invite");
      return;
    }
    if (user?.email?.toLowerCase() === normalizedEmail) {
      setInviteError("You are already part of this list");
      return;
    }
    setInviteError("");
    inviteMutation.mutate();
  }

  async function handleShareInvite() {
    if (!inviteUrl) return;
    try {
      await Share.share({ message: inviteUrl });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function confirmRemove(member: ListMember) {
    const isPending = member.status === "pending";
    const actionLabel = isPending ? "Revoke invite" : "Remove member";
    const message = isPending
      ? `Revoke the invitation for ${member.email}?`
      : `Remove ${member.name} from this list?`;

    if (Platform.OS === "web") {
      const confirmed = typeof globalThis.confirm === "function" ? globalThis.confirm(message) : false;
      if (confirmed) removeMutation.mutate(member);
      return;
    }

    Alert.alert(actionLabel, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: actionLabel,
        style: "destructive",
        onPress: () => removeMutation.mutate(member),
      },
    ]);
  }

  function renderMember(member: ListMember) {
    const initials = member.name
      ? member.name
          .split(" ")
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase()
      : member.email.slice(0, 2).toUpperCase();
    const isPending = member.status === "pending";
    const canRevoke = canManage && member.role !== "owner";
    const targetId = member.userId || member.id;
    const isRemoving = targetId ? removingId === targetId : false;

    return (
      <View style={styles.memberCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberRow}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.name}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[member.role] + "22" }]}>
              <Text style={[styles.roleText, { color: ROLE_COLORS[member.role] }]}>
                {ROLE_LABELS[member.role]}
              </Text>
            </View>
          </View>
          <Text style={styles.memberEmail} numberOfLines={1}>
            {member.email}
          </Text>
          {isPending ? (
            <View style={styles.pendingBadge}>
              <Ionicons name="time" size={12} color={Colors.statusPendingApproval} />
              <Text style={styles.pendingText}>Invitation pending</Text>
            </View>
          ) : null}
        </View>
        {canRevoke ? (
          <Pressable
            onPress={() => confirmRemove(member)}
            disabled={isRemoving}
            hitSlop={8}
            style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
          >
            {isRemoving ? (
              <ActivityIndicator size={14} color={Colors.danger} />
            ) : (
              <Ionicons name={isPending ? "close-circle" : "trash-outline"} size={18} color={Colors.danger} />
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

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
          <Text style={styles.topTitle}>Members</Text>
          {listData?.name ? (
            <Text style={styles.topSubtitle} numberOfLines={1}>
              {listData.name}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {!listData?.isShared ? (
              <View style={styles.noticeBox}>
                <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
                <Text style={styles.noticeText}>This list is personal and does not support members.</Text>
              </View>
            ) : null}

            {listData?.isShared && canManage ? (
              <View style={styles.inviteBox}>
                <Text style={styles.sectionTitle}>Invite member</Text>
                {removeError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                    <Text style={styles.errorText}>{removeError}</Text>
                  </View>
                ) : null}
                {inviteError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                    <Text style={styles.errorText}>{inviteError}</Text>
                  </View>
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder="member@email.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (inviteError) setInviteError("");
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Pressable
                  onPress={handleInvite}
                  disabled={inviteMutation.isPending}
                  style={({ pressed }) => [
                    styles.inviteBtn,
                    inviteMutation.isPending && styles.inviteBtnDisabled,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {inviteMutation.isPending ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color={Colors.white} />
                      <Text style={styles.inviteBtnText}>Send invite</Text>
                    </>
                  )}
                </Pressable>
                <Text style={styles.inviteHint}>
                  Invited members receive a link and a notification when they log in.
                </Text>
              </View>
            ) : null}

            {inviteData ? (
              <View style={styles.inviteResult}>
                <View style={styles.inviteRow}>
                  <Ionicons name="link" size={16} color={Colors.primary} />
                  <Text style={styles.inviteLink} numberOfLines={2} ellipsizeMode="middle">
                    {inviteUrl}
                  </Text>
                </View>
                <View style={styles.inviteMeta}>
                  <Text style={styles.inviteMetaText}>Expires {new Date(inviteData.expiresAt).toLocaleDateString()}</Text>
                  <Pressable
                    onPress={handleShareInvite}
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="share-social" size={14} color={Colors.primary} />
                    <Text style={styles.shareText}>Share link</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members</Text>
              {listData?.isShared ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{members.length}</Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => renderMember(item)}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={46} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No members yet</Text>
              <Text style={styles.emptyText}>Invite teammates to collaborate on this list.</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
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
  headerSection: { paddingBottom: 10 },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, flex: 1 },
  inviteBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  inviteBtnDisabled: { opacity: 0.6 },
  inviteBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.white },
  inviteHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.danger + "12",
    padding: 8,
    borderRadius: 8,
  },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.danger, flex: 1 },
  inviteResult: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  inviteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  inviteLink: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  inviteMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteMetaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary + "12",
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  shareText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  countBadge: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  memberInfo: { flex: 1, gap: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  memberName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text, flex: 1 },
  memberEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.statusPendingApproval + "18",
  },
  pendingText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.statusPendingApproval },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.danger + "12",
  },
  empty: { alignItems: "center", paddingTop: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
});
