import React from 'react';
import { cn } from "@/shared/lib/utils";
import { Message } from '../types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  localMessages: Message[];
  isLoadingMessages: boolean;
  isFetchingMore: boolean;
  isTyping: boolean;
  isUploading: boolean;
  me: any;
  chat: any;
  searchResults: any[];
  searchMatchIndex: number;
  highlightedMessageId: string | null;
  deletingMessageId: string | null;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onEdit: (m: Message) => void;
  onDelete: (id: string) => void;
  onForward: (m: Message) => void;
  onReply: (m: Message) => void;
  onScrollTo: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}


export const MessageList: React.FC<MessageListProps> = React.memo(({
  localMessages,
  isLoadingMessages,
  isFetchingMore,
  isTyping,
  isUploading,
  me,
  chat,
  searchResults,
  searchMatchIndex,
  highlightedMessageId,
  deletingMessageId,
  messagesContainerRef,
  scrollRef,
  handleScroll,
  onEdit,
  onDelete,
  onForward,
  onReply,
  onScrollTo,
  onReact,
}) => {
  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat"
        style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
      />
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col"
        onScroll={handleScroll}
      >
        {isFetchingMore && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-1 rounded-full border text-[10px] text-muted-foreground animate-in fade-in zoom-in duration-300">
              <div className="w-2 h-2 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading older messages...
            </div>
          </div>
        )}
        
        {isLoadingMessages && localMessages.length === 0 ? (
          null
        ) : (
          <div className="flex flex-col w-full gap-1">
            {localMessages.map(msg => {
              const isMe = String(msg.senderId) === String(me?.id);
              const isSearchingMatch = searchResults[searchMatchIndex] === msg.id;
              
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={cn(
                    "flex w-full mb-1 group transition-all duration-500 rounded-lg p-1",
                    isMe ? "justify-end" : "justify-start",
                    isSearchingMatch && "bg-primary/10 ring-1 ring-primary/20",
                    highlightedMessageId === msg.id && "bg-primary/20 ring-2 ring-primary/40 scale-[1.02] shadow-lg"
                  )}
                >
                  <MessageBubble
                    message={msg}
                    isMe={isMe}
                    otherName={chat?.username}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isDeleting={deletingMessageId === msg.id}
                    onForward={onForward}
                    onReply={onReply}
                    onScrollTo={onScrollTo}
                    onReact={onReact}
                  />
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start mb-4 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="bg-[hsl(var(--bubble-other))] px-5 py-4 rounded-2xl rounded-tl-none shadow-md flex items-center gap-1.5 border border-border/50">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-typing-dot" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-typing-dot" style={{ animationDelay: '200ms' }}></span>
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-typing-dot" style={{ animationDelay: '400ms' }}></span>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="flex justify-end mb-2">
                <div className="bg-primary/20 text-xs px-3 py-1 rounded-full animate-pulse">
                  Uploading file...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>
    </div>
  );
});
