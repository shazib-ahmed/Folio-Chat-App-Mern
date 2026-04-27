import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Input } from "@/shared/ui/input";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisVertical, faSearch, faFaceSmile, faPaperclip, faMicrophone, faPaperPlane, faImage, faFile, faCamera, faUser } from '@fortawesome/free-solid-svg-icons';
import { MessageBubble } from "./MessageBubble";
import { Chat, Message } from "../types";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/shared/ui/dropdown-menu";

interface ChatWindowProps {
  chat?: Chat;
  messages: Message[];
}

export function ChatWindow({ chat, messages }: ChatWindowProps) {
  const [inputText, setInputText] = useState("");

  if (!chat) {
    return (
      <div className="flex-1 h-full bg-[hsl(var(--chat-bg))] flex flex-col items-center justify-center text-muted-foreground relative">
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none bg-repeat"
          style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
        />
        
        <div className="w-[460px] text-center space-y-6 relative z-10">
          <div className="bg-accent/20 h-48 w-48 rounded-full mx-auto flex items-center justify-center border border-border/10">
             <div className="relative">
                <FontAwesomeIcon icon={faPaperPlane} className="h-20 w-20 text-primary opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <FontAwesomeIcon icon={faSearch} className="h-8 w-8 text-primary" />
                </div>
             </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-light text-foreground">Select a user to start messaging</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-[hsl(var(--chat-bg))] text-foreground overflow-hidden">
      {/* Header */}
      <div className="h-[60px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center justify-between shrink-0 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={chat.avatar} />
            <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-sm font-semibold">{chat.name}</h4>
            <p className="text-[11px] text-muted-foreground">
              {chat.online ? "online" : "last seen today at 12:45"}
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-muted-foreground">
          <FontAwesomeIcon icon={faSearch} className="h-4 w-4 cursor-pointer hover:text-foreground" />
          <FontAwesomeIcon icon={faEllipsisVertical} className="h-4 w-4 cursor-pointer hover:text-foreground" />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat"
          style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
        />
        <ScrollArea className="h-full px-2 py-4">
          <div className="flex flex-col w-full gap-1">
            {messages.map(msg => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                isMe={msg.senderId === 'me'} 
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="h-[62px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center gap-4 shrink-0">
        <div className="flex gap-3 text-muted-foreground items-center">
          <FontAwesomeIcon icon={faFaceSmile} className="h-6 w-6 cursor-pointer hover:text-foreground transition-colors" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FontAwesomeIcon icon={faPaperclip} className="h-6 w-6 cursor-pointer hover:text-foreground transition-colors rotate-[45deg]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="mb-4 w-48 p-2 rounded-xl bg-popover border-border/40 shadow-xl">
              <DropdownMenuItem className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-accent transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  <FontAwesomeIcon icon={faFile} />
                </div>
                <span className="text-sm">Document</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-accent transition-colors">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                  <FontAwesomeIcon icon={faImage} />
                </div>
                <span className="text-sm">Photos & Videos</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-accent transition-colors">
                <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white">
                  <FontAwesomeIcon icon={faCamera} />
                </div>
                <span className="text-sm">Camera</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-accent transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white">
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <span className="text-sm">Contact</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Input 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message"
          className="flex-1 border-none bg-[hsl(var(--input-bg))] shadow-none focus-visible:ring-0 text-foreground h-10 placeholder:text-muted-foreground rounded-lg"
        />
        <div className="text-muted-foreground flex items-center justify-center w-10">
          {inputText ? (
             <FontAwesomeIcon icon={faPaperPlane} className="h-6 w-6 text-primary cursor-pointer hover:scale-110 transition-transform" />
          ) : (
            <FontAwesomeIcon icon={faMicrophone} className="h-6 w-6 cursor-pointer hover:text-foreground transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}
