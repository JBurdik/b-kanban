import type { Id } from "convex/_generated/dataModel";

// ============================================================================
// Core Types
// ============================================================================

export type Priority = "low" | "medium" | "high";
export type BoardRole = "owner" | "admin" | "member";
export type NotificationType = "assigned" | "mentioned" | "commented" | "card_updated";

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: Id<"users">;
  name: string;
  email: string;
  image?: string;
}

// ============================================================================
// Card Types
// ============================================================================

export interface Card {
  _id: Id<"cards">;
  columnId: Id<"columns">;
  slug: string;
  title: string;
  content?: string;
  position: number;
  priority: Priority;
  effort?: number;
  assignee?: User | null;
  dueDate?: number;
}

export interface CardWithColumn extends Card {
  column: {
    id: Id<"columns">;
    name: string;
  };
}

// ============================================================================
// Column Types
// ============================================================================

export interface Column {
  _id: Id<"columns">;
  boardId: Id<"boards">;
  name: string;
  position: number;
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

// ============================================================================
// Board Member Types
// ============================================================================

export interface BoardMember {
  id: Id<"boardMembers">;
  role: BoardRole;
  userId: Id<"users">;
  user: User | null;
}

// ============================================================================
// Board Types
// ============================================================================

export interface Board {
  _id: Id<"boards">;
  name: string;
  description?: string;
  columns?: Column[] | ColumnWithCards[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

export interface BoardWithColumns extends Board {
  columns: ColumnWithCards[];
}

// ============================================================================
// Comment Types
// ============================================================================

export interface Comment {
  _id: Id<"comments">;
  cardId: Id<"cards">;
  content: string;
  createdAt: number;
  updatedAt: number;
  author?: User | null;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  _id: Id<"notifications">;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: number;
  cardId?: Id<"cards">;
  boardId?: Id<"boards">;
}
