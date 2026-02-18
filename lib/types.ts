export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  creationXpBalance: number;
}

export interface TaskList {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  isShared: boolean;
}

export interface CreateListRequest {
  name: string;
  description?: string | null;
}

export interface ListMember {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  status: "active" | "pending";
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  listId: string;
  creatorUserId: string;
  assigneeUserId?: string | null;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  rewardXp: number;
  needsApproval: boolean;
  status: "open" | "in_progress" | "pending_approval" | "completed" | "cancelled";
  completedAt?: string | null;
  subtasks: Subtask[];
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  rewardXp: number;
  needsApproval: boolean;
  assigneeUserId?: string | null;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
}

export interface TaskDetails {
  task: Task;
  creator: TaskUserSummary;
  assignee?: TaskUserSummary | null;
  assignableUsers: TaskUserSummary[];
  canManageAssignee: boolean;
}

export interface TaskUserSummary {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  parentCommentId?: string | null;
  author: TaskUserSummary;
  content: string;
  likes: number;
  dislikes: number;
  userVote: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedItem {
  id: string;
  type: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  taskId?: string | null;
  listId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FeedResponse {
  data: FeedItem[];
  nextCursor?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  taskId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationResponse {
  data: Notification[];
  unreadCount: number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  totalXp: number;
  level: number;
  completedTasks: number;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  nextCursor?: string | null;
}

export interface XPSuggestionResponse {
  suggestedXp: number;
  justification: string;
}

export interface LedgerEntry {
  id: string;
  resourceType: "xp" | "energy";
  direction: "credit" | "debit";
  amount: number;
  sourceType: string;
  sourceId?: string | null;
  balanceAfter: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface CreateListInviteRequest {
  email: string;
}

export interface CreateListInviteResponse {
  token: string;
  invitePath: string;
  email: string;
  role: string;
  expiresAt: string;
}

export interface ListInviteResponse {
  listId: string;
  listName: string;
  role: "owner" | "admin" | "member";
  invitedByName: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
}

export interface AcceptListInviteResponse {
  listId: string;
}

export interface CreateSubtaskRequest {
  title: string;
}

export interface VoteTaskCommentRequest {
  value: -1 | 0 | 1;
}

export interface CreateTaskCommentRequest {
  content: string;
  parentCommentId?: string | null;
}

export interface RejectTaskRequest {
  reason: string;
}

export type TaskStatus = Task["status"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending_approval: "Pending",
  completed: "Done",
  cancelled: "Cancelled",
};
