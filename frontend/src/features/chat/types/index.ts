export interface MessageAttachment {
  type: 'image' | 'video' | 'file';
  url: string;
  name: string;
  size?: string;
  thumbnail?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'UNSEEN' | 'SEEN' | 'pending';
  messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL';
  attachment?: {
    type: 'image' | 'video' | 'file' | 'audio';
    url: string;
    thumbnail?: string;
    name?: string;
    size?: string;
  };
  isEncrypted?: boolean;
  isEdited?: boolean;
  isForwarded?: boolean;
  createdAt?: string;
  fileMeta?: string;
  isDeleted?: boolean;
  replyTo?: {
    id: string;
    senderId: string;
    text?: string;
    messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL';
    isEncrypted?: boolean;
  };
  reactions?: {
    userId: string;
    emoji: string;
  }[];
}



export interface Chat {
  id: string;
  name: string;
  username: string;
  avatar: string;
  lastMessage?: string;
  lastMessageId?: string;
  lastMessageSenderId?: string;
  lastMessageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CALL';
  isEncrypted?: boolean;
  isForwarded?: boolean;
  lastMessageTime?: string;
  unreadCount?: number;
  online?: boolean;
  lastSeen?: string;
}
