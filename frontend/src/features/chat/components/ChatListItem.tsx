import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { Chat } from "../types";
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';

interface ChatListItemProps {
  chat: Chat;
  isActive?: boolean;
  onClick?: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const typingUsers = useSelector((state: RootState) => state.chat.typingUsers);
  const isTyping = !!typingUsers[chat.id];

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-accent group min-w-0",
        isActive && "bg-accent"
      )}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={chat.avatar} alt={chat.name} />
          <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {chat.online && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <h4 className={cn(
            "font-semibold text-sm truncate pr-2",
            isActive ? "text-accent-foreground" : "text-foreground",
            "group-hover:text-accent-foreground"
          )}>{chat.name}</h4>
          <span className={cn(
            "text-[11px] shrink-0",
            isActive ? "text-accent-foreground/70" : "text-muted-foreground",
            "group-hover:text-accent-foreground/70"
          )}>{chat.lastMessageTime}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className={cn(
            "text-xs truncate flex-1",
            isTyping ? "text-primary font-medium italic" : (isActive ? "text-accent-foreground/80" : "text-muted-foreground"),
            "group-hover:text-accent-foreground/80"
          )}>
            {isTyping ? (
              <span className="animate-pulse">typing...</span>
            ) : chat.lastMessage?.startsWith('http') ? (
              <span className="flex items-center gap-1">
                {chat.lastMessage.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? '📷 Photo' : 
                 chat.lastMessage.match(/\.(mp4|webm|ogg)$/i) ? '🎥 Video' : 
                 chat.lastMessage.match(/\.(mp3|wav|ogg)$/i) ? '🎵 Audio' : '📄 File'}
              </span>
            ) : (
              chat.lastMessage
            )}
          </p>
          {chat.unreadCount ? (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center shrink-0 animate-in zoom-in duration-300">
              {chat.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
