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
  text: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  attachment?: MessageAttachment;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  online?: boolean;
}
