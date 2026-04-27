import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMessage } from '@fortawesome/free-regular-svg-icons';
import { faEllipsisVertical, faFilter, faSearch, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ChatListItem } from "./ChatListItem";
import { Chat } from "../types";
import { ThemeSwitcher } from "@/shared/components/ThemeSwitcher";

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId?: string;
}

export function ChatSidebar({ chats, activeChatId }: ChatSidebarProps) {
  const navigate = useNavigate();

  const handleChatSelect = (id: string) => {
    navigate(`/messages/${id}`);
  };

  return (
    <div className="w-full h-full flex flex-col border-r bg-[hsl(var(--sidebar-bg))] text-foreground">
      {/* Header */}
      <div className="h-[60px] bg-[hsl(var(--sidebar-header-bg))] px-4 flex items-center justify-between shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div className="flex gap-2 items-center text-muted-foreground">
          <ThemeSwitcher />
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
             <FontAwesomeIcon icon={faMessage} className="h-5 w-5 cursor-pointer" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive transition-colors">
            <FontAwesomeIcon icon={faRightFromBracket} className="h-5 w-5 cursor-pointer" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 shrink-0">
        <div className="relative flex items-center bg-[hsl(var(--sidebar-header-bg))] rounded-lg overflow-hidden group border">
          <div className="pl-3 pointer-events-none">
            <FontAwesomeIcon icon={faSearch} className="h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary" />
          </div>
          <Input 
            placeholder="Search or start new chat" 
            className="border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground text-sm h-9"
          />
          <div className="pr-3">
            <FontAwesomeIcon icon={faFilter} className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {chats.map(chat => (
            <ChatListItem 
              key={chat.id} 
              chat={chat} 
              isActive={activeChatId === chat.id}
              onClick={() => handleChatSelect(chat.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
