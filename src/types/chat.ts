export type ConversationType = 'DM' | 'GROUP';

export interface ConversationDto {
  id: number;
  type: ConversationType;
  name: string | null;
  organizationId: number | null;
  otherUserId: number | null;
  otherUserName: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  content: string;
  sentAt: string;
}

export interface UserSummaryDto {
  id: number;
  name: string;
  email: string;
  globalRole: string | null;
}
