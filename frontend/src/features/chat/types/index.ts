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
  messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  attachment?: {
    type: 'image' | 'video' | 'file' | 'audio';
    url: string;
    thumbnail?: string;
    name?: string;
    size?: string;
  };
}

export interface Chat {
  id: string;
  name: string;
  username: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  online?: boolean;
}
