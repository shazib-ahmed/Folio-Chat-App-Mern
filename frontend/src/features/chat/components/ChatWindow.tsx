import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faSearch, faFaceSmile, faPaperclip, faMicrophone, faPaperPlane, faArrowLeft, faPhone, faVideo, faXmark, faChevronDown, faTrash } from '@fortawesome/free-solid-svg-icons';
import { MessageBubble } from "./MessageBubble";
import { Chat, Message } from "../types";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

import { getMessagesApi, sendMessageApi, markSeenApi } from '../chatService';
import { subscribeToMessages, getSocket } from '@/shared/lib/socket';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/app/store';
import { Skeleton } from "@/shared/ui/skeleton";
import { clearUnreadCount } from '../chatSlice';

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
  onStartAudioCall?: (chat: Chat) => void;
  onStartVideoCall?: (chat: Chat) => void;
}

export function ChatWindow({ chat, onStartAudioCall, onStartVideoCall }: ChatWindowProps) {
  const { user: me } = useSelector((state: RootState) => state.auth);
  const [inputText, setInputText] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const currentChatRef = useRef<Chat | undefined>(chat);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref when chat changes
  useEffect(() => {
    currentChatRef.current = chat;
    setIsTyping(false); // Reset typing status when switching chats
  }, [chat]);

  // Fetch messages when chat changes
  useEffect(() => {
    if (chat?.username) {
      setIsLoadingMessages(true);
      getMessagesApi(chat.username).then(msgs => {
        setLocalMessages(msgs);
        // Mark as seen when opening the chat
        markSeenApi(chat.id).then(() => {
          dispatch(clearUnreadCount(chat.id));
        }).catch(err => console.error('Failed to mark as seen:', err));
      }).catch(err => console.error('Failed to fetch messages:', err))
      .finally(() => setIsLoadingMessages(false));
    } else {
      setLocalMessages([]);
    }
  }, [chat?.username, chat?.id, dispatch]);

  // Subscribe to real-time messages
  useEffect(() => {
    return subscribeToMessages((err: Error | null, msg: any) => {
      if (err) return;
      
      // If it's a 'messagesSeen' event
      if (msg.type === 'messagesSeen') {
        if (chat && msg.chatId === chat.id) {
          setLocalMessages(prev => prev.map(m => ({ ...m, status: 'SEEN' as any })));
        }
        return;
      }

      // Handle typing status
      if (msg.type === 'typing') {
        const activeChatId = currentChatRef.current?.id;
        console.log(`Typing event from ${msg.senderId}. Active chat: ${activeChatId}`);
        if (String(msg.senderId) === String(activeChatId)) {
          setIsTyping(true);
        }
        return;
      } else if (msg.type === 'stopTyping') {
        const activeChatId = currentChatRef.current?.id;
        console.log(`Stop typing event from ${msg.senderId}. Active chat: ${activeChatId}`);
        if (String(msg.senderId) === String(activeChatId)) {
          setIsTyping(false);
        }
        return;
      }

      // Only append if the message belongs to the current active chat
      if (chat && (msg.senderId === chat.id || msg.receiverId === chat.id || msg.senderId === me?.id?.toString() || msg.receiverId === me?.id?.toString())) {
        setLocalMessages(prev => {
          // If this is my own message coming from socket, replace the pending one
          const isMine = String(msg.senderId) === String(me?.id);
          
          if (isMine) {
            // Find a temp message with the same text/type
            const tempIndex = prev.findIndex(m => 
              m.id.toString().startsWith('temp-') && 
              (m.text === msg.text || (m.messageType === msg.messageType && msg.messageType !== 'TEXT'))
            );
            
            if (tempIndex !== -1) {
              const newMsgs = [...prev];
              newMsgs[tempIndex] = msg;
              return newMsgs;
            }
          }

          // Check for duplicates by ID
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // If I received a message in the active chat, mark it as seen
        if (msg.receiverId === me?.id?.toString() && msg.senderId === chat.id) {
          markSeenApi(chat.id).then(() => {
            dispatch(clearUnreadCount(chat.id));
          }).catch(err => console.error('Failed to mark as seen:', err));
        }
      }
    });
  }, [chat, me?.id, dispatch]);

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
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null); // No preview for non-images for now, or use a generic icon
      }
    }
    // Clear the input value so the same file can be picked again
    e.target.value = '';
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedFile && !audioBlob) return;
    if (!chat || !me) return;

    const formData = new FormData();
    formData.append('receiverId', chat.id);
    formData.append('message', inputText);
    
    if (audioBlob) {
      formData.append('type', 'AUDIO');
      formData.append('file', audioBlob, 'voice-note.webm');
      setIsUploading(true);
    } else if (selectedFile) {
      const type = selectedFile.type.split('/')[0].toUpperCase();
      const mappedType = ['IMAGE', 'VIDEO', 'AUDIO'].includes(type) ? type : 'FILE';
      formData.append('type', mappedType);
      formData.append('file', selectedFile);
      setIsUploading(true);
    } else {
      formData.append('type', 'TEXT');
    }

    try {
      // Optimistic Update
      const optimisticMsg: Message = {
        id: 'temp-' + Date.now(),
        senderId: me.id.toString(),
        text: inputText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending' as any,
        messageType: audioBlob ? 'AUDIO' : (selectedFile ? (['IMAGE', 'VIDEO', 'AUDIO'].includes(selectedFile.type.split('/')[0].toUpperCase()) ? selectedFile.type.split('/')[0].toUpperCase() as any : 'FILE') : 'TEXT'),
        fileUrl: audioBlob ? URL.createObjectURL(audioBlob) : (filePreview || undefined),
        fileName: audioBlob ? 'Voice Note' : selectedFile?.name,
        fileSize: audioBlob ? `${(audioBlob.size / 1024).toFixed(1)} KB` : (selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : undefined),
      };

      setLocalMessages(prev => [...prev, optimisticMsg]);
      setInputText("");
      removeSelectedFile();

      const response = await sendMessageApi(formData);
      
      // Replace optimistic message with real one from server
      setLocalMessages(prev => prev.map(m => m.id === optimisticMsg.id ? response : m));
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic message on failure
      setLocalMessages(prev => prev.filter(m => !m.id.toString().startsWith('temp-')));
    } finally {
      setIsUploading(false);
    }
  };

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // We don't automatically send here, we send when handleSendMessage is called with the blob
        // But in WhatsApp, stop usually means send
        handleSendMessage(undefined, audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = null; // Prevent sending
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioChunksRef.current = [];
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setShowScrollButton(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, chat?.id, isTyping]);

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

  const ChatWindowSkeleton = () => (
    <div className="flex flex-col gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={cn("flex w-full", i % 2 === 0 ? "justify-end" : "justify-start")}>
          <Skeleton className={cn("h-16 w-64 rounded-lg", i % 2 === 0 ? "rounded-tr-none" : "rounded-tl-none")} />
        </div>
      ))}
    </div>
  );

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
                {isTyping ? (
                  <p className="text-[11px] text-sky-400 font-semibold animate-pulse">typing...</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {chat.online ? "online" : (chat.lastSeen ? `last seen ${chat.lastSeen}` : "offline")}
                  </p>
                )}
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
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div 
          className="absolute inset-0 opacity-[0.06] pointer-events-none bg-repeat"
          style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
        />
        <div 
          className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
          onScroll={handleScroll}
        >
          <div className="flex flex-col w-full gap-1">
            {isLoadingMessages ? (
              <ChatWindowSkeleton />
            ) : (
              <>
                {localMessages.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    isMe={String(msg.senderId) === String(me?.id)} 
                  />
                ))}
              </>
            )}
            
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
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollButton && (
          <Button
            variant="secondary"
            size="icon"
            onClick={scrollToBottom}
            className="absolute bottom-6 right-8 h-11 w-11 rounded-full shadow-2xl border border-primary/20 bg-background/90 backdrop-blur-md text-primary animate-in zoom-in fade-in duration-300 hover:bg-background z-50 transition-all active:scale-95"
          >
            <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-[hsl(var(--chat-header-bg))] border-t relative">
        {/* File Preview Card (WhatsApp style) */}
        {selectedFile && (
          <div className="px-4 py-3 bg-background/80 backdrop-blur-md border-b animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between p-2 bg-accent/30 rounded-lg">
              <div className="flex items-center gap-4 min-w-0">
                {filePreview ? (
                  <div className="h-16 w-16 rounded overflow-hidden border">
                    <img src={filePreview} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded bg-primary/20 flex items-center justify-center border text-primary">
                    <FontAwesomeIcon icon={faPaperclip} className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={removeSelectedFile} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <FontAwesomeIcon icon={faXmark} />
              </Button>
            </div>
          </div>
        )}

        <div className="p-3 flex items-center gap-2">
          {isRecording ? (
            <div className="flex-1 flex items-center gap-4 bg-primary/10 p-2 px-4 rounded-full border border-primary/20 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <span className="text-sm font-medium text-foreground min-w-[40px]">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 h-8 flex items-center justify-center overflow-hidden">
                  <div className="flex gap-0.5 items-center h-full">
                     {[...Array(20)].map((_, i) => (
                       <div key={i} className="w-0.5 bg-primary/40 rounded-full" style={{ height: `${Math.random() * 80 + 20}%`, animation: `pulse 1s infinite ${i * 0.05}s` }}></div>
                     ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={cancelRecording} className="text-destructive hover:bg-destructive/10 rounded-full h-10 w-10">
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
                <Button onClick={stopRecording} size="icon" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-11 w-11 shadow-lg shadow-primary/20">
                  <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => handleFileClick('file')}>
                  <FontAwesomeIcon icon={faPaperclip} className="h-5 w-5" />
                </Button>
                
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn("text-muted-foreground hover:text-primary transition-colors", isEmojiPickerOpen && "text-primary")}
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                  >
                    <FontAwesomeIcon icon={faFaceSmile} className="h-5 w-5" />
                  </Button>
                  
                  {isEmojiPickerOpen && (
                    <div className="absolute bottom-full left-0 mb-4 z-50" ref={pickerRef}>
                      <EmojiPicker 
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.AUTO}
                        width={320}
                        height={400}
                      />
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                <Input 
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (chat && me) {
                      const socket = getSocket();
                      if (socket) {
                        const sid = Number(me.id);
                        const rid = Number(chat.id);
                        socket.emit('typing', { senderId: sid, receiverId: rid });
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => {
                          socket.emit('stopTyping', { senderId: sid, receiverId: rid });
                        }, 3000);
                      }
                    }
                  }}
                  onFocus={() => {
                    if (chat) {
                      markSeenApi(chat.id).then(() => {
                        dispatch(clearUnreadCount(chat.id));
                      }).catch(err => console.error('Failed to mark as seen:', err));
                    }
                  }}
                  className="flex-1 bg-background border-none focus-visible:ring-1 focus-visible:ring-primary/20 h-10 px-4 rounded-full"
                />
                
                <Button 
                  type="submit" 
                  size="icon" 
                  disabled={!inputText.trim() && !selectedFile}
                  className={cn(
                    "rounded-full h-10 w-10 transition-all duration-300",
                    (inputText.trim() || selectedFile) ? "bg-primary text-primary-foreground scale-100" : "bg-muted text-muted-foreground scale-90 hidden"
                  )}
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
                </Button>
              </form>

              {!inputText.trim() && !selectedFile && (
                <Button variant="ghost" size="icon" onClick={startRecording} className="text-muted-foreground hover:text-primary transition-colors">
                  <FontAwesomeIcon icon={faMicrophone} className="h-5 w-5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileSelect}
      />
    </div>
  );
}
