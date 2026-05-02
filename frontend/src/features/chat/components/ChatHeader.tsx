import React from 'react';
import { cn } from "@/shared/lib/utils";
import { Button } from '@/shared/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, 
  faSearch, 
  faVideo, 
  faPhone, 
  faBan, 
  faUnlock, 
  faChevronDown, 
  faXmark 
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { Chat } from '../types';

interface ChatHeaderProps {
  chat: Chat;
  isSearching: boolean;
  setIsSearching: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchResults: any[];
  searchMatchIndex: number;
  navigateSearch: (direction: 'next' | 'prev') => void;
  setSearchResults: (val: any[]) => void;
  isLoadingMessages: boolean;
  isTyping: boolean;
  isBlocked: boolean;
  blockedByMe: boolean;
  chatStatus: string;
  onStartVideoCall?: (chat: Chat) => void;
  onStartAudioCall?: (chat: Chat) => void;
  setIsBlockModalOpen: (val: boolean) => void;
  setIsUnblockModalOpen: (val: boolean) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  chat,
  isSearching,
  setIsSearching,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchMatchIndex,
  navigateSearch,
  setSearchResults,
  isLoadingMessages,
  isTyping,
  isBlocked,
  blockedByMe,
  chatStatus,
  onStartVideoCall,
  onStartAudioCall,
  setIsBlockModalOpen,
  setIsUnblockModalOpen,
}) => {
  const navigate = useNavigate();

  return (
    <div className="h-[60px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center justify-between shrink-0 border-b relative z-[40]">
      {isSearching ? (
        <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => {
              setIsSearching(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-muted-foreground h-4 w-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              autoFocus
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus-visible:ring-0 h-10 px-0 text-sm"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <span>{searchMatchIndex + 1} of {searchResults.length}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigateSearch('prev')}
                >
                  <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigateSearch('next')}
                >
                  <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setSearchQuery("")}
          >
            <FontAwesomeIcon icon={faXmark} className="text-muted-foreground h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all mr-1"
              onClick={() => navigate('/')}
            >
              <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={chat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.username}`} />
              <AvatarFallback>{chat.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>

            <div>
              <h4 className="text-sm font-semibold">{chat.name}</h4>
              {isTyping ? (
                <p className="text-[11px] text-sky-400 font-semibold animate-pulse">typing...</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {chat.online ? "online" : (chat.lastSeen ? `last seen ${chat.lastSeen}` : "offline")}
                </p>
              )}
            </div>
          </div>
          {!isLoadingMessages && (
            <div className="flex gap-5 text-muted-foreground items-center">
              <FontAwesomeIcon
                icon={faVideo}
                className={cn(
                  "h-4 w-4 cursor-pointer hover:text-foreground transition-all",
                  (isBlocked || chatStatus === 'PENDING') && "opacity-20 cursor-not-allowed hover:text-muted-foreground"
                )}
                onClick={() => !isBlocked && chatStatus === 'ACCEPTED' && chat && onStartVideoCall?.(chat)}
                title={chatStatus === 'PENDING' ? "Accept request to start video call" : "Start Video Call"}
              />
              <FontAwesomeIcon
                icon={faPhone}
                className={cn(
                  "h-4 w-4 cursor-pointer hover:text-foreground transition-all",
                  (isBlocked || chatStatus === 'PENDING') && "opacity-20 cursor-not-allowed hover:text-muted-foreground"
                )}
                onClick={() => {
                  if (!isBlocked && chatStatus === 'ACCEPTED' && chat) {
                    onStartAudioCall?.(chat);
                  }
                }}
                title={chatStatus === 'PENDING' ? "Accept request to start audio call" : "Start Audio Call"}
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="h-4 w-4 cursor-pointer hover:text-foreground"
                onClick={() => setIsSearching(true)}
              />
              {!blockedByMe ? (
                <FontAwesomeIcon
                  icon={faBan}
                  className="h-4 w-4 cursor-pointer hover:text-destructive transition-colors"
                  title="Block User"
                  onClick={() => setIsBlockModalOpen(true)}
                />
              ) : (
                <FontAwesomeIcon
                  icon={faUnlock}
                  className="h-4 w-4 cursor-pointer text-primary hover:text-primary/80 transition-colors"
                  title="Unblock User"
                  onClick={() => setIsUnblockModalOpen(true)}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});
