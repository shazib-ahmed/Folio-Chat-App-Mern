import React from 'react';
import { cn } from "@/shared/lib/utils";
import { Button } from '@/shared/ui/button';
import { Input } from "@/shared/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/shared/ui/avatar";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, 
  faPaperclip, 
  faFaceSmile, 
  faXmark, 
  faTrash, 
  faPen, 
  faReply,
  faMicrophone
} from '@fortawesome/free-solid-svg-icons';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { getSocket } from '@/shared/lib/socket';
import { markSeenApi } from '../chatService';
import { clearUnreadCount } from '../chatSlice';
import { useDispatch } from 'react-redux';
import { Chat, Message } from '../types';

interface ChatInputProps {
  chat: Chat;
  me: any;
  inputText: string;
  setInputText: (val: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  isLoadingMessages: boolean;
  isBlocked: boolean;
  blockedByMe: boolean;
  chatStatus: string;
  requesterId: string | null;
  localMessages: Message[];
  selectedFile: File | null;
  filePreview: string | null;
  removeSelectedFile: () => void;
  handleFileClick: (type: string) => void;
  isEmojiPickerOpen: boolean;
  setIsEmojiPickerOpen: (val: boolean) => void;
  handleEmojiClick: (emojiData: any) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  editingMessage: Message | null;
  setEditingMessage: (val: Message | null) => void;
  replyingToMessage: Message | null;
  setReplyingToMessage: (val: Message | null) => void;
  isRecording: boolean;
  recordingTime: number;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  setIsAcceptModalOpen: (val: boolean) => void;
  setIsBlockModalOpen: (val: boolean) => void;
  setIsUnblockModalOpen: (val: boolean) => void;
  typingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
  chat,
  me,
  inputText,
  setInputText,
  handleSendMessage,
  isLoadingMessages,
  isBlocked,
  blockedByMe,
  chatStatus,
  requesterId,
  localMessages,
  selectedFile,
  filePreview,
  removeSelectedFile,
  handleFileClick,
  isEmojiPickerOpen,
  setIsEmojiPickerOpen,
  handleEmojiClick,
  pickerRef,
  editingMessage,
  setEditingMessage,
  replyingToMessage,
  setReplyingToMessage,
  isRecording,
  recordingTime,
  startRecording,
  stopRecording,
  cancelRecording,
  setIsAcceptModalOpen,
  setIsBlockModalOpen,
  setIsUnblockModalOpen,
  typingTimeoutRef,
}) => {
  const dispatch = useDispatch();

  if (isLoadingMessages) return null;

  return (
    <div className="bg-[hsl(var(--chat-header-bg))] border-t relative shrink-0">
      {isBlocked ? (
        <div className="p-4 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm h-[80px]">
          <p className="text-sm text-muted-foreground mb-1">
            {blockedByMe ? "You have blocked this contact." : "This contact has blocked you."}
          </p>
          {blockedByMe && (
            <Button variant="link" size="sm" onClick={() => setIsUnblockModalOpen(true)} className="text-primary h-auto p-0">
              Tap to unblock
            </Button>
          )}
        </div>
      ) : chatStatus === 'PENDING' && requesterId && requesterId !== String(me?.id) && localMessages.length > 0 ? (
        <div className="p-8 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-500 border-t">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={chat?.avatar} />
              <AvatarFallback>{chat?.name?.charAt(0) || chat?.username?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          <h3 className="text-lg font-bold mb-1">{chat?.name || chat?.username}</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-[280px]">
            Wants to connect with you. They won't know you've seen their message until you accept.
          </p>
          <div className="flex gap-3 w-full max-w-[320px]">
            <Button variant="outline" className="flex-1 rounded-full border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => setIsBlockModalOpen(true)}>
              Block
            </Button>
            <Button className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" onClick={() => setIsAcceptModalOpen(true)}>
              Accept
            </Button>
          </div>
        </div>
      ) : (
        <>
          {chatStatus === 'PENDING' && requesterId === String(me?.id) && (
            <div className="bg-primary/5 px-4 py-2 text-center border-b">
              <p className="text-[10px] uppercase tracking-wider font-bold text-primary/70">
                Message request sent. Waiting for response.
              </p>
            </div>
          )}
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
                {editingMessage && (
                  <div className="absolute bottom-full left-0 right-0 bg-background/80 backdrop-blur-md border-t px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 z-10">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FontAwesomeIcon icon={faPen} className="text-primary text-xs shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Editing Message</p>
                        <p className="text-xs truncate text-muted-foreground">{editingMessage.text}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => {
                      setEditingMessage(null);
                      setInputText("");
                    }}>
                      <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {replyingToMessage && (
                  <div className="absolute bottom-full left-0 right-0 bg-background/80 backdrop-blur-md border-t px-4 py-2 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 z-10">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FontAwesomeIcon icon={faReply} className="text-primary text-xs shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Replying to</p>
                        <p className="text-xs truncate text-muted-foreground">
                          {replyingToMessage.isDeleted ? "🚫 deleted a message" : (replyingToMessage.text || (replyingToMessage.fileUrl ? "Attachment" : ""))}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyingToMessage(null)}>
                      <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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

                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2" aria-label="message-form">
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
                    className="flex-1 bg-background border border-primary/20 focus-visible:ring-1 focus-visible:ring-primary/30 h-10 px-4 rounded-full transition-all"
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
        </>
      )}
    </div>
  );
});
