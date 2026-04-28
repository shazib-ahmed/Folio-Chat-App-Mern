import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faSearch, faFaceSmile, faPaperclip, faMicrophone, faPaperPlane, faImage, faFile, faCamera, faUser, faArrowLeft, faPhone, faVideo, faXmark, faTrash } from '@fortawesome/free-solid-svg-icons';
import { MessageBubble } from "./MessageBubble";
import { Chat, Message } from "../types";
import { useNavigate } from "react-router-dom";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface ChatWindowProps {
  chat?: Chat;
  messages: Message[];
  onStartAudioCall?: (chat: Chat) => void;
  onStartVideoCall?: (chat: Chat) => void;
}

export function ChatWindow({ chat, messages, onStartAudioCall, onStartVideoCall }: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleEmojiClick = (emojiData: any) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleFileClick = (type: string) => {
    if (fileInputRef.current) {
      if (type === 'image') fileInputRef.current.accept = "image/*";
      else if (type === 'video') fileInputRef.current.accept = "video/*";
      else fileInputRef.current.accept = "*/*";
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert(`Selected file: ${file.name}`);
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    alert(`Voice message sent! Duration: ${formatRecordingTime(recordingTime)}`);
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, chat?.id]);

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
      <div className="h-[60px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center justify-between shrink-0 border-b relative">
        {isSearching ? (
          <div className="flex-1 flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <FontAwesomeIcon 
              icon={faArrowLeft} 
              className="text-muted-foreground cursor-pointer hover:text-foreground h-4 w-4"
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
            />
            <div className="flex-1 relative">
              <Input 
                autoFocus
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none focus-visible:ring-0 h-10 px-0 text-sm"
              />
            </div>
            <FontAwesomeIcon 
              icon={faXmark} 
              className="text-muted-foreground cursor-pointer hover:text-foreground h-4 w-4"
              onClick={() => setSearchQuery("")}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden text-muted-foreground hover:text-foreground -ml-2"
                onClick={() => navigate('/')}
              >
                <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5" />
              </Button>
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
            <div className="flex gap-5 text-muted-foreground items-center">
              <FontAwesomeIcon 
                icon={faVideo} 
                className="h-4 w-4 cursor-pointer hover:text-foreground" 
                onClick={() => chat && onStartVideoCall?.(chat)}
              />
              <FontAwesomeIcon 
                icon={faPhone} 
                className="h-4 w-4 cursor-pointer hover:text-foreground" 
                onClick={() => chat && onStartAudioCall?.(chat)}
              />
              <FontAwesomeIcon 
                icon={faSearch} 
                className="h-4 w-4 cursor-pointer hover:text-foreground" 
                onClick={() => setIsSearching(true)}
              />
              <FontAwesomeIcon 
                icon={faBan} 
                className="h-4 w-4 cursor-pointer hover:text-destructive transition-colors" 
                title="Block User"
                onClick={() => setIsBlockModalOpen(true)}
              />
            </div>
          </>
        )}
      </div>

      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Block {chat.name}?</DialogTitle>
            <DialogDescription>
              Blocked contacts will no longer be able to call you or send you messages. This action can be undone later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsBlockModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                alert(`${chat.name} has been blocked.`);
                setIsBlockModalOpen(false);
              }}
              className="flex-1"
            >
              Block User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="h-[62px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center gap-4 shrink-0 relative">
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-background/50 rounded-lg h-10 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-foreground">Recording {formatRecordingTime(recordingTime)}</span>
            </div>
            <div className="flex items-center gap-4">
              <FontAwesomeIcon 
                icon={faTrash} 
                className="h-5 w-5 text-muted-foreground cursor-pointer hover:text-destructive transition-colors"
                onClick={cancelRecording}
              />
              <div 
                className="bg-primary h-8 w-8 rounded-full flex items-center justify-center text-primary-foreground cursor-pointer hover:scale-105 transition-transform"
                onClick={stopRecording}
              >
                <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3 text-muted-foreground items-center">
              <div className="relative" ref={pickerRef}>
                <FontAwesomeIcon 
                  icon={faFaceSmile} 
                  className={`h-6 w-6 cursor-pointer hover:text-foreground transition-colors ${isEmojiPickerOpen ? 'text-primary' : ''}`} 
                  onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                />
                {isEmojiPickerOpen && (
                  <div className="absolute bottom-12 left-0 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <EmojiPicker 
                      onEmojiClick={handleEmojiClick}
                      theme={Theme.DARK}
                      width={320}
                      height={400}
                      lazyLoadEmojis={true}
                    />
                  </div>
                )}
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect}
              />
              <FontAwesomeIcon 
                icon={faPaperclip} 
                className="h-6 w-6 cursor-pointer hover:text-foreground transition-colors rotate-[45deg]" 
                onClick={() => handleFileClick('all')}
              />
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
                <FontAwesomeIcon 
                  icon={faMicrophone} 
                  className="h-6 w-6 cursor-pointer hover:text-primary transition-colors" 
                  onClick={startRecording}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
