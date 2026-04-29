import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { cn } from "@/shared/lib/utils";
import { Chat } from "../types";
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { decryptMessage, getLocalPrivateKey } from '@/shared/lib/cryptoUtils';

interface ChatListItemProps {
  chat: Chat;
  isActive?: boolean;
  onClick?: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const typingUsers = useSelector((state: RootState) => state.chat.typingUsers);
  const { user: me } = useSelector((state: RootState) => state.auth);
  const isTyping = !!typingUsers[chat.id];
  const [displayText, setDisplayText] = useState<string | undefined>(chat.lastMessage);

  useEffect(() => {
    const handleDecryption = async () => {
      // 1. Basic checks
      if (!chat.lastMessage) return;
      
      const isSender = String(chat.lastMessageSenderId) === String(me?.id);
      const forwardPrefix = chat.isForwarded ? '↗️ Forwarded: ' : '';

      // 2. If not encrypted, just format and show
      if (!chat.isEncrypted) {
        let msg = chat.lastMessage;
        // Handle deleted placeholders
        if (msg.includes('🚫') || msg.toLowerCase().includes('deleted a message')) {
          msg = chat.isForwarded ? "Content unavailable" : (isSender ? "You deleted a message" : `${chat.name} deleted a message`);
        } else if (chat.isForwarded && !msg.includes('Forwarded')) {
          msg = forwardPrefix + msg;
        }
        setDisplayText(isSender && !msg.startsWith('You:') ? `You: ${msg}` : msg);
        return;
      }

      // 3. Encrypted - Need identity and keys
      if (!me?.id) return; // Wait for session

      const privateKey = await getLocalPrivateKey(String(me.id));
      if (!privateKey) {
        setDisplayText("🔒 Decrypting...");
        return;
      }

      try {
        let cipherText = chat.lastMessage;

        // A. Handle non-standard placeholders already in the field
        if (cipherText.includes('📷') || cipherText.includes('🎥') || cipherText.includes('🎵') || cipherText.includes('📄') || cipherText.includes('🚫')) {
          let final = cipherText;
          if (chat.isForwarded && !final.includes('Forwarded')) final = forwardPrefix + final;
          if (isSender && !final.startsWith('You:')) final = `You: ${final}`;
          setDisplayText(final);
          return;
        }

        // B. Handle File Wrappers (JSON but not standard E2EE payload)
        if (cipherText.startsWith('{')) {
          try {
            const parsed = JSON.parse(cipherText);
            if (parsed.m || parsed.fileMeta) {
              const labels: any = { 'IMAGE': '📷 Photo', 'VIDEO': '🎥 Video', 'AUDIO': '🎵 Audio', 'FILE': '📄 File' };
              const label = labels[chat.lastMessageType || ''] || '📄 Attachment';
              setDisplayText(forwardPrefix + (isSender ? "You: " : "") + label);
              return;
            }
          } catch (e) {}
        }

        // C. Standard Decryption
        const decrypted = await decryptMessage(cipherText, privateKey, isSender);
        let final = decrypted;

        if (final.startsWith('[Unable') || final.startsWith('[Decryption')) {
          final = "🔒 Encrypted Message";
        }

        setDisplayText(forwardPrefix + (isSender && !final.startsWith('You:') ? "You: " : "") + final);
      } catch (err) {
        setDisplayText(forwardPrefix + (isSender ? "You: " : "") + "🔒 Encrypted Message");
      }
    };
    handleDecryption();
  }, [chat.lastMessage, chat.isEncrypted, chat.isForwarded, chat.lastMessageSenderId, chat.lastMessageType, chat.name, me?.id]);

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
          <AvatarImage src={chat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.username}`} alt={chat.name} />
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
            ) : displayText?.startsWith('http') ? (
              <span className="flex items-center gap-1">
                {displayText.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? '📷 Photo' :
                  displayText.match(/\.(mp4|webm|ogg)$/i) ? '🎥 Video' :
                    displayText.match(/\.(mp3|wav|ogg)$/i) ? '🎵 Audio' : '📄 File'}
              </span>
            ) : (
              displayText
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
