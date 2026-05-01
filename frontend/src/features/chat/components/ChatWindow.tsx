import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faSearch, faFaceSmile, faPaperclip, faMicrophone, faPaperPlane, faArrowLeft, faPhone, faVideo, faXmark, faChevronDown, faTrash, faUnlock, faPen, faShare, faSpinner, faReply } from '@fortawesome/free-solid-svg-icons';
import { useWebRTC } from '../hooks/useWebRTC';
import { CallOverlay } from './CallOverlay';
import { MessageBubble } from "./MessageBubble";
import { Chat, Message } from "../types";
import { cn } from "@/shared/lib/utils";

import { getMessagesApi, sendMessageApi, markSeenApi, blockUserApi, unblockUserApi, acceptRequestApi, searchMessagesApi, getPublicKeyApi, uploadFileApi, updateMessageApi, deleteMessageApi, getChatListApi } from '../chatService';
import { encryptForBoth, decryptMessage, getLocalPrivateKey, encryptFileForBoth, isEncryptedPayload, rewrapFileMeta } from '@/shared/lib/cryptoUtils';

import { subscribeToMessages, getSocket } from '@/shared/lib/socket';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/app/store';
import { Skeleton } from "@/shared/ui/skeleton";
import { clearUnreadCount, updateChatPreview } from '../chatSlice';

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
  const navigate = useNavigate();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [fullChatList, setFullChatList] = useState<any[]>([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const [forwardSearchResults, setForwardSearchResults] = useState<any[]>([]);
  const [isSearchingForward, setIsSearchingForward] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [inputText, setInputText] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(-1);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentChatRef = useRef<Chat | undefined>(chat);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [isBlockingAction, setIsBlockingAction] = useState(false);
  const [chatStatus, setChatStatus] = useState<'PENDING' | 'ACCEPTED'>('ACCEPTED');
  const [requesterId, setRequesterId] = useState<string | null>(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    callState,
    remoteStream,
    isMuted,
    partner: callPartner,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useWebRTC({
    currentUserId: String(me?.id || ''),
    currentUserName: me?.name || me?.username || 'User',
    currentUserAvatar: me?.avatar,
    onIncomingCall: (data) => {
      console.log('Incoming call from:', data.fromName);
    },
    onCallAccepted: () => {
      console.log('Call accepted');
    },
    onCallEnded: () => {
      console.log('Call ended');
    },
    onLogCall: React.useCallback(async (type, duration, providedLogId, isOwner) => {
      if (!chat || !me) return;

      let plainText = '';
      if (type === 'MISSED') plainText = 'Missed audio call';
      else if (type === 'REJECTED') plainText = 'Declined audio call';
      else if (type === 'ENDED') {
        const mins = Math.floor((duration || 0) / 60);
        const secs = (duration || 0) % 60;
        plainText = `Audio call (${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')})`;
      }

      const clientMsgId = providedLogId || `log-${Date.now()}`;
      
      // Optimistic update for BOTH sides
      const optimisticLog: Message = {
        id: clientMsgId,
        senderId: String(me.id), 
        text: plainText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending' as any,
        messageType: 'CALL',
        isEncrypted: true
      };
      
      setLocalMessages(prev => {
        if (prev.some(m => m.id === clientMsgId)) return prev;
        return [...prev, optimisticLog];
      });

      // ONLY the owner (caller) saves to DB
      if (!isOwner) return;

      try {
        const rKey = recipientPublicKey || await getPublicKeyApi(chat.username);
        const mKey = myPublicKey || await getPublicKeyApi(me.username);

        let encryptedText = plainText;
        if (rKey && mKey) {
          encryptedText = await encryptForBoth(plainText, rKey, mKey);
        }

        await sendMessageApi(
          chat.id, 
          encryptedText, 
          'CALL', 
          undefined, 
          !!(rKey && mKey),
          clientMsgId
        );
      } catch (err) {
        console.error('Failed to log call:', err);
        // Only remove if it was our own optimistic message
        setLocalMessages(prev => prev.filter(m => m.id !== clientMsgId));
      }
    }, [chat, me, recipientPublicKey, myPublicKey])
  });

  // Attach remote stream to audio element
  useEffect(() => {
    if (remoteStream) {
      const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
      if (audioEl) {
        audioEl.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localMessages.length > 0 && !isLoadingMessages && !isFetchingMore) {
      scrollToBottom('auto');
    }
  }, [localMessages.length, isLoadingMessages, isFetchingMore]);

  // Update ref when chat changes
  useEffect(() => {
    currentChatRef.current = chat;
    setIsTyping(false); // Reset typing status when switching chats
  }, [chat]);

  // Fetch messages and public key when chat changes
  useEffect(() => {
    if (chat?.username) {
      setIsLoadingMessages(true);
      setLocalMessages([]); // Clear messages immediately when switching chats
      setRecipientPublicKey(null);
      setMyPublicKey(null);

      // Fetch public keys
      if (me?.username) {
        getPublicKeyApi(chat.username).then(key => setRecipientPublicKey(key)).catch(e => console.error(e));
        getPublicKeyApi(me.username).then(key => setMyPublicKey(key)).catch(e => console.error(e));
      }

      (getMessagesApi(chat.username) as Promise<any>).then(async data => {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        const decryptedMessages = await Promise.all((data.messages || []).map(async (msg: any) => {
          if (!msg.isEncrypted || !privateKey) return msg;

          let decryptedText = msg.text;
          let decryptedFileUrl = msg.fileUrl;
          let decryptedFileName = msg.fileName;
          let fileMeta = "";

          const isSender = String(msg.senderId) === String(me?.id);

          // 1. Extract fileMeta and potentially decrypt text
          if (msg.text && (isEncryptedPayload(msg.text) || msg.text.includes('"fileMeta"'))) {
            try {
              const parsed = JSON.parse(msg.text);
              if (parsed.fileMeta) {
                decryptedText = parsed.text ? await decryptMessage(parsed.text, privateKey, isSender) : "";
                fileMeta = parsed.fileMeta;
              } else if (parsed.iv) {
                // If it has iv/r/s but no fileMeta, it's either text or just fileMeta
                if (parsed.c || parsed.text) {
                  decryptedText = await decryptMessage(msg.text, privateKey, isSender);
                } else if (parsed.m) {
                  fileMeta = msg.text;
                  decryptedText = "";
                }
              }
            } catch (e) {
              console.error("History: Failed to parse message JSON:", e);
            }
          }


          // 2. Decrypt fileUrl if it's an encrypted payload
          if (msg.fileUrl && isEncryptedPayload(msg.fileUrl)) {
            decryptedFileUrl = await decryptMessage(msg.fileUrl, privateKey, isSender);
          }

          // 3. Decrypt fileName if it's an encrypted payload
          if (msg.fileName && isEncryptedPayload(msg.fileName)) {
            decryptedFileName = await decryptMessage(msg.fileName, privateKey, isSender);
          }

          // 4. Decrypt fileSize if it's an encrypted payload
          let decryptedFileSize = msg.fileSize;
          if (msg.fileSize && isEncryptedPayload(msg.fileSize)) {
            decryptedFileSize = await decryptMessage(msg.fileSize, privateKey, isSender);
          }

          let decryptedReply = msg.replyTo;
          if (msg.replyTo && privateKey) {
            try {
              const isReplySender = String(msg.replyTo.senderId) === String(me?.id);
              let text = msg.replyTo.text;
              
              if (msg.replyTo.text && isEncryptedPayload(msg.replyTo.text)) {
                text = await decryptMessage(msg.replyTo.text, privateKey, isReplySender);
              }

              // If it's a file without caption, use a friendly label
              if (!text && msg.replyTo.messageType !== 'TEXT') {
                const labels: any = { 'IMAGE': '📷 Photo', 'VIDEO': '🎥 Video', 'AUDIO': '🎵 Audio', 'FILE': '📄 File' };
                text = labels[msg.replyTo.messageType] || '📄 Attachment';
              }

              decryptedReply = { ...msg.replyTo, text };
            } catch (e) {}
          }

          return {
            ...msg,
            text: decryptedText,
            fileUrl: decryptedFileUrl,
            fileName: decryptedFileName,
            fileSize: decryptedFileSize,
            fileMeta,
            replyTo: decryptedReply
          };

        }));


        setLocalMessages(decryptedMessages);
        setIsBlocked(data.isBlocked);
        setBlockedByMe(data.blockedByMe);
        setChatStatus(data.chatStatus || 'ACCEPTED');
        setRequesterId(data.requesterId ? String(data.requesterId) : null);
        setHasMore(data.hasMore);

        // Mark as seen when opening the chat
        markSeenApi(chat.id).then(() => {
          dispatch(clearUnreadCount(chat.id));
        }).catch(err => console.error('Failed to mark as seen:', err));
      }).catch(err => console.error('Failed to fetch messages:', err))
        .finally(() => setIsLoadingMessages(false));
    } else {
      setLocalMessages([]);
    }
  }, [chat?.id, chat?.username, me?.id, me?.username, dispatch]);

  // Handle message search with debounce and cancellation
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const controller = new AbortController();

    if (searchQuery.trim().length >= 2 && chat?.username) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // 1. Search locally through decrypted messages (most accurate for E2EE)
          const localResults = localMessages
            .filter(m => !m.isDeleted && m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(m => m.id);

          // 2. Search backend (for old plain-text messages)
          const backendResults = await searchMessagesApi(chat.username, searchQuery, controller.signal);
          const backendResultIds = backendResults.map((r: any) => r.id);

          // 3. Combine and deduplicate
          const combinedIds = Array.from(new Set([...localResults, ...backendResultIds]));
          
          setSearchResults(combinedIds);
          setSearchMatchIndex(combinedIds.length > 0 ? 0 : -1);

          if (combinedIds.length > 0) {
            const firstId = combinedIds[0];
            if (localMessages.some(m => m.id === firstId)) {
              scrollToMessage(firstId);
            }
          }
        } catch (err: any) {
          if (err.name === 'CanceledError' || err.name === 'AbortError') return;
          console.error('Search error:', err);
        }
      }, 500);
    } else {
      setSearchResults([]);
      setSearchMatchIndex(-1);
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      controller.abort();
    };
  }, [searchQuery, chat?.username, localMessages]);

  const scrollToMessage = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(id);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex = searchMatchIndex;
    if (direction === 'next') {
      newIndex = (searchMatchIndex + 1) % searchResults.length;
    } else {
      newIndex = (searchMatchIndex - 1 + searchResults.length) % searchResults.length;
    }

    setSearchMatchIndex(newIndex);
    const targetId = searchResults[newIndex];

    if (localMessages.some(m => m.id === targetId)) {
      scrollToMessage(targetId);
    } else {
      // Message not loaded locally
      console.log('Message not in local view, would need to fetch context');
    }
  };
  // Subscribe to real-time messages
  useEffect(() => {
    return subscribeToMessages(async (err: Error | null, msg: any) => {
      if (err) return;
      if (!msg) return;

      // Handle events first
      if (msg.type === 'userBlockStatus') {
        if (chat && String(msg.blockerId) === String(chat.id)) {
          setIsBlocked(msg.isBlocked);
          setBlockedByMe(false); // If I received this, it means the OTHER person blocked/unblocked me
        }
        return;
      }

      if (msg.type === 'messageUpdated') {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        let decryptedText = msg.text;

        if (msg.isEncrypted && privateKey) {
          const isSender = String(msg.senderId) === String(me?.id);
          try {
            decryptedText = await decryptMessage(msg.text, privateKey, isSender);
          } catch (e) {
            console.error("Socket: Failed to decrypt updated message:", e);
          }
        }

        setLocalMessages(prev => prev.map(m =>
          String(m.id) === String(msg.id)
            ? { ...m, text: decryptedText, isEdited: true }
            : m
        ));

        dispatch(updateChatPreview({
          messageId: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          sidebarText: msg.sidebarText,
          isMine: String(msg.senderId) === String(me?.id)
        }));
        return;
      }

      if (msg.type === 'messageDeleted') {
        setLocalMessages(prev => prev.map(m =>
          String(m.id) === String(msg.id)
            ? { ...m, isDeleted: true, text: "", fileUrl: "", fileName: "", fileSize: "", messageType: 'TEXT' }
            : m
        ));
        dispatch(updateChatPreview({
          messageId: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          sidebarText: msg.sidebarText,
          isMine: String(msg.senderId) === String(me?.id),
          isEncrypted: false
        }));
        return;
      }

      if (msg.type === 'chatRequestAccepted') {
        const activeChat = currentChatRef.current;
        console.log('Chat request accepted event received:', msg, 'Active chat:', activeChat?.id);
        // If we are looking at the chat that was just accepted
        if (activeChat && (String(msg.acceptedBy) === String(activeChat.id))) {
          setChatStatus('ACCEPTED');
        }
        return;
      }


      if (msg.type === 'messagesSeen') {
        if (chat && msg.chatId === chat.id) {
          setLocalMessages(prev => prev.map(m => ({ ...m, status: 'SEEN' as any })));
        }
        return;
      }

      if (msg.type === 'typing') {
        const activeChatId = currentChatRef.current?.id;
        if (String(msg.senderId) === String(activeChatId)) {
          setIsTyping(true);
        }
        return;
      } else if (msg.type === 'stopTyping') {
        const activeChatId = currentChatRef.current?.id;
        if (String(msg.senderId) === String(activeChatId)) {
          setIsTyping(false);
        }
        return;
      }

      // Handle new messages with decryption
      if (chat && (
        (String(msg.senderId) === String(chat.id) && String(msg.receiverId) === String(me?.id)) ||
        (String(msg.senderId) === String(me?.id) && String(msg.receiverId) === String(chat.id))
      )) {

        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        let decryptedText = msg.text || msg.message || msg.content || "";
        let decryptedFileUrl = msg.fileUrl;
        let decryptedFileName = msg.fileName;
        let decryptedFileSize = msg.fileSize;
        let fileMeta = "";
        let decryptedReply = msg.replyTo;

        if (msg.isEncrypted && privateKey) {
          const isSender = String(msg.senderId) === String(me?.id);

          // 1. Text & fileMeta
          if (msg.text && (isEncryptedPayload(msg.text) || msg.text.includes('"fileMeta"'))) {
            try {
              const parsed = JSON.parse(msg.text);
              if (parsed.fileMeta) {
                decryptedText = parsed.text ? await decryptMessage(parsed.text, privateKey, isSender) : "";
                fileMeta = parsed.fileMeta;
              } else if (parsed.iv) {
                if (parsed.c) {
                  decryptedText = await decryptMessage(msg.text, privateKey, isSender);
                } else {
                  fileMeta = msg.text;
                  decryptedText = "";
                }
              }
            } catch (e) {
              console.error("Socket: Failed to parse message JSON:", e);
            }
          }


          // 2. fileUrl
          if (msg.fileUrl && isEncryptedPayload(msg.fileUrl)) {
            decryptedFileUrl = await decryptMessage(msg.fileUrl, privateKey, isSender);
          }

          // 3. fileName
          if (msg.fileName && isEncryptedPayload(msg.fileName)) {
            decryptedFileName = await decryptMessage(msg.fileName, privateKey, isSender);
          }

          // 4. fileSize
          if (msg.fileSize && isEncryptedPayload(msg.fileSize)) {
            decryptedFileSize = await decryptMessage(msg.fileSize, privateKey, isSender);
          }
          
          // 5. Decrypt replyTo if exists
          if (msg.replyTo) {
            try {
              const isReplySender = String(msg.replyTo.senderId) === String(me?.id);
              let text = msg.replyTo.text;

              if (msg.replyTo.text && isEncryptedPayload(msg.replyTo.text)) {
                text = await decryptMessage(msg.replyTo.text, privateKey, isReplySender);
              }

              if (!text && msg.replyTo.messageType !== 'TEXT') {
                const labels: any = { 'IMAGE': '📷 Photo', 'VIDEO': '🎥 Video', 'AUDIO': '🎵 Audio', 'FILE': '📄 File' };
                text = labels[msg.replyTo.messageType] || '📄 Attachment';
              }

              decryptedReply = { ...msg.replyTo, text };
            } catch (e) {}
          }
        }

        const decryptedMsg = {
          ...msg,
          text: decryptedText,
          fileUrl: decryptedFileUrl,
          fileName: decryptedFileName,
          fileSize: decryptedFileSize,
          fileMeta,
          replyTo: decryptedReply
        };



        setLocalMessages(prev => {
          const isMine = String(msg.senderId) === String(me?.id);

          if (msg.clientMsgId) {
            // Find the specific temp message using clientMsgId (regardless of who sent it)
            const tempIndex = prev.findIndex(m => m.id === msg.clientMsgId);

            if (tempIndex !== -1) {
              const newMsgs = [...prev];
              // Ensure we don't overwrite with empty text if decryption failed
              const finalMsg = {
                ...decryptedMsg,
                text: decryptedMsg.text || prev[tempIndex].text,
                fileUrl: prev[tempIndex].fileUrl && prev[tempIndex].fileUrl.startsWith('blob:') ? prev[tempIndex].fileUrl : decryptedMsg.fileUrl,
                fileName: prev[tempIndex].fileName && !isEncryptedPayload(prev[tempIndex].fileName) ? prev[tempIndex].fileName : decryptedMsg.fileName,
                fileSize: prev[tempIndex].fileSize && !isEncryptedPayload(prev[tempIndex].fileSize) ? prev[tempIndex].fileSize : decryptedMsg.fileSize,
                replyTo: decryptedMsg.replyTo
              };

              newMsgs[tempIndex] = finalMsg;
              return newMsgs;
            }
          }

          // Fallback to old matching logic if clientMsgId is missing
          if (isMine) {
            const tempIndex = [...prev].reverse().findIndex(m =>
              String(m.id).startsWith('temp-') || String(m.id).startsWith('cmsg-')
            );
            if (tempIndex !== -1) {
              const actualIndex = prev.length - 1 - tempIndex;
              const newMsgs = [...prev];
              newMsgs[actualIndex] = {
                ...decryptedMsg,
                text: decryptedMsg.text || prev[actualIndex].text,
                fileUrl: prev[actualIndex].fileUrl, // PRESERVE LOCAL URL
                fileName: prev[actualIndex].fileName,
                fileSize: prev[actualIndex].fileSize
              };
              return newMsgs;
            }
          }

          if (prev.some(m => String(m.id) === String(msg.id))) return prev;
          return [...prev, decryptedMsg];
        });

        // If I received a message in the active chat, mark it as seen
        if (String(msg.receiverId) === String(me?.id) && String(msg.senderId) === String(chat.id)) {
          markSeenApi(chat.id).then(() => {
            dispatch(clearUnreadCount(chat.id));
          }).catch(err => console.error('Failed to mark as seen:', err));
        }
      }

      if (msg.type === 'chatRequestAccepted' && chat) {
        const roomMatch = [String(me?.id), String(chat.id)].sort().join('_') === msg.chatRoomId;
        if (roomMatch) {
          setChatStatus('ACCEPTED');
        }
      }

      if (msg.type === 'messageReaction') {
        setLocalMessages(prev => prev.map(m => {
          if (String(m.id).trim() === String(msg.messageId).trim()) {
            const reactions = m.reactions || [];
            // Use robust comparison for userId
            const userIndex = reactions.findIndex(r => String(r.userId).trim() === String(msg.userId).trim());
            
            let newReactions = [...reactions];
            if (msg.reactionType === 'removed') {
              newReactions = newReactions.filter(r => String(r.userId).trim() !== String(msg.userId).trim());
            } else {
              // Both 'added' and 'updated' use the same idempotent logic
              const reactionData = { userId: String(msg.userId).trim(), emoji: msg.emoji };
              if (userIndex !== -1) {
                newReactions[userIndex] = reactionData;
              } else {
                newReactions.push(reactionData);
              }
            }
            return { ...m, reactions: newReactions };
          }
          return m;
        }));
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

    if (isBlocked) {
      alert(blockedByMe ? "You have blocked this contact. Unblock to send messages." : "You are blocked. You cannot send messages.");
      return;
    }

    if (editingMessage) {
      try {
        const messageToUpdate = editingMessage;
        const newText = inputText;
        setEditingMessage(null);
        setInputText("");

        let contentToSend = newText;
        if (messageToUpdate.isEncrypted) {
          const [recipientPubKey, myPubKey] = await Promise.all([
            getPublicKeyApi(chat.username),
            getPublicKeyApi(me.username)
          ]);
          if (recipientPubKey && myPubKey) {
            contentToSend = await encryptForBoth(newText, recipientPubKey, myPubKey);
          }
        }

        await updateMessageApi(messageToUpdate.id, contentToSend);
        return;
      } catch (err: any) {
        console.error('Failed to update message:', err);
        return;
      }
    }

    // If this is the first message, set me as requester to avoid seeing the banner
    if (!requesterId) {
      setRequesterId(String(me.id));
    }

    const fileToUpload = selectedFile || (audioBlob ? new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' }) : undefined);
    const mappedType = audioBlob ? 'AUDIO' : (selectedFile ? (['IMAGE', 'VIDEO', 'AUDIO'].includes(selectedFile.type.split('/')[0].toUpperCase()) ? selectedFile.type.split('/')[0].toUpperCase() as any : 'FILE') : 'TEXT');
    const clientMsgId = `cmsg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const originalName = fileToUpload?.name || "";
    const originalSize = audioBlob ? `${(audioBlob.size / 1024).toFixed(1)} KB` : (selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : "Unknown");
    const currentPreview = audioBlob ? URL.createObjectURL(audioBlob) : (filePreview || undefined);

    // 1. OPTIMISTIC UPDATE
    const optimisticMsg: Message = {
      id: clientMsgId,
      senderId: me.id.toString(),
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'pending' as any,
      messageType: mappedType,
      fileUrl: currentPreview,
      fileName: audioBlob ? 'Voice Note' : selectedFile?.name,
      fileSize: originalSize,
      isEncrypted: !!(recipientPublicKey && myPublicKey)
    };
    setLocalMessages(prev => [...prev, optimisticMsg]);

    // 2. CLEAR INPUTS
    const lastInput = inputText;
    const lastFile = fileToUpload;
    const currentReplyingTo = replyingToMessage;
    setInputText("");
    removeSelectedFile();
    setReplyingToMessage(null);
    if (fileToUpload) setIsUploading(true);

    // 3. SENDING LOGIC
    try {
      if (recipientPublicKey && myPublicKey) {
        // --- ENCRYPTED FLOW ---
        let finalMessage = "";
        let fileMetadata = "";

        if (lastInput.trim()) {
          finalMessage = await encryptForBoth(lastInput, recipientPublicKey, myPublicKey);
        }

        if (lastFile) {
          const { encryptedBlob, encryptedMetadata } = await encryptFileForBoth(
            lastFile, originalName, originalSize, recipientPublicKey, myPublicKey
          );
          const uploadRes = await uploadFileApi(new File([encryptedBlob], "encrypted-file", { type: lastFile.type }));
          const encryptedFileUrl = await encryptForBoth(uploadRes.fileUrl, recipientPublicKey, myPublicKey);
          const encryptedFileName = await encryptForBoth(originalName, recipientPublicKey, myPublicKey);
          const encryptedFileSize = await encryptForBoth(originalSize, recipientPublicKey, myPublicKey);

          fileMetadata = encryptedMetadata;
          const payload = lastInput.trim() ? JSON.stringify({ text: finalMessage, fileMeta: fileMetadata }) : fileMetadata;

          const response = await sendMessageApi(chat.id, payload, mappedType, undefined, true, clientMsgId, encryptedFileUrl, encryptedFileName, encryptedFileSize, false, undefined, currentReplyingTo?.id);
          setLocalMessages(prev => prev.map(m => m.id === clientMsgId ? { ...response, text: lastInput, fileUrl: currentPreview, fileName: originalName, fileSize: originalSize } : m));
        } else {
          // Text only
          const response = await sendMessageApi(chat.id, finalMessage, 'TEXT', undefined, true, clientMsgId, undefined, undefined, undefined, false, undefined, currentReplyingTo?.id);
          setLocalMessages(prev => prev.map(m => m.id === clientMsgId ? { ...response, text: lastInput } : m));
        }

      } else {
        // --- PLAIN FLOW ---
        const response = await sendMessageApi(chat.id, lastInput, mappedType, lastFile, false, clientMsgId, undefined, undefined, undefined, false, undefined, currentReplyingTo?.id);
        setLocalMessages(prev => prev.map(m => m.id === clientMsgId ? { ...response, fileUrl: currentPreview, fileName: originalName, fileSize: originalSize } : m));
      }
    } catch (err: any) {
      console.error('Send failed:', err);
      setLocalMessages(prev => prev.filter(m => m.id !== clientMsgId));
      alert(err.response?.data?.message || err.message || "Failed to send message.");
    } finally {
      setIsUploading(false);
    }
  };

  // Audio Recording Functions
  const startRecording = async () => {
    if (isBlocked) {
      alert("You cannot send voice notes while blocked.");
      return;
    }
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

  const handleBlock = async () => {
    if (!chat) return;
    setIsBlockingAction(true);
    try {
      await blockUserApi(chat.id);
      setIsBlocked(true);
      setBlockedByMe(true);
      setIsBlockModalOpen(false);
    } catch (err) {
      console.error('Failed to block user:', err);
    } finally {
      setIsBlockingAction(false);
    }
  };

  const handleUnblock = async () => {
    if (!chat) return;
    setIsBlockingAction(true);
    try {
      await unblockUserApi(chat.id);
      setIsBlocked(false);
      setBlockedByMe(false);
      setIsUnblockModalOpen(false);
    } catch (err) {
      console.error('Failed to unblock user:', err);
    } finally {
      setIsBlockingAction(false);
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

  // Fetch chat list for forwarding
  useEffect(() => {
    if (isForwardModalOpen) {
      setIsSearchingForward(true);
      getChatListApi()
        .then((list: Chat[]) => {
          const filtered = list.filter(c => String(c.id) !== String(chat?.id));
          setFullChatList(filtered);
          setForwardSearchResults(filtered);
        })
        .catch((err: any) => console.error('Failed to fetch chat list for forwarding:', err))
        .finally(() => setIsSearchingForward(false));
    } else {
      setFullChatList([]);
      setForwardSearchResults([]);
      setForwardSearchQuery("");
    }
  }, [isForwardModalOpen, chat?.id]);

  // Filter local chat list
  useEffect(() => {
    if (!forwardSearchQuery.trim()) {
      setForwardSearchResults(fullChatList);
      return;
    }

    const filtered = fullChatList.filter(chat =>
      chat.name?.toLowerCase().includes(forwardSearchQuery.toLowerCase()) ||
      chat.username?.toLowerCase().includes(forwardSearchQuery.toLowerCase())
    );
    setForwardSearchResults(filtered);
  }, [forwardSearchQuery, fullChatList]);
  
  const handleReact = (messageId: string, emoji: string) => {
    if (!me) return;
    const socket = getSocket();
    if (!socket) return;

    const uId = Number(me.id);
    const mId = Number(messageId);
    
    // Optimistic update
    setLocalMessages(prev => prev.map(m => {
      if (String(m.id).trim() === String(messageId).trim()) {
        const reactions = m.reactions || [];
        const existingIndex = reactions.findIndex(r => String(r.userId).trim() === String(me.id).trim());
        
        let newReactions = [...reactions];
        if (existingIndex !== -1) {
          if (reactions[existingIndex].emoji === emoji) {
            // Remove if same emoji clicked (toggle off)
            newReactions = newReactions.filter(r => String(r.userId).trim() !== String(me.id).trim());
          } else {
            // Update to new emoji
            newReactions[existingIndex] = { userId: String(me.id).trim(), emoji };
          }
        } else {
          // Add new reaction
          newReactions.push({ userId: String(me.id).trim(), emoji });
        }
        return { ...m, reactions: newReactions };
      }
      return m;
    }));

    socket.emit('react', { userId: uId, messageId: mId, emoji });
  };

  const handleForward = async (targetUser: any) => {
    if (!forwardingMessage) return;
    setIsForwarding(true);
    try {
      const msg = forwardingMessage;
      let content = msg.text || "";
      let fileUrl = msg.fileUrl;
      let fileName = msg.fileName;
      let fileSize = msg.fileSize;
      let isEncrypted = !!msg.isEncrypted;

      if (isEncrypted) {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        const [recipientPubKeyPem, myPubKeyPem] = await Promise.all([
          getPublicKeyApi(targetUser.username),
          getPublicKeyApi(me!.username)
        ]);

        if (recipientPubKeyPem && myPubKeyPem && privateKey) {
          const isOriginalSender = String(msg.senderId) === String(me?.id);

          if (msg.messageType === 'TEXT') {
            if (content) content = await encryptForBoth(content, recipientPubKeyPem, myPubKeyPem);
          } else if (msg.fileMeta) {
            // Re-wrap file metadata (re-encrypts the AES key)
            const newFileMeta = await rewrapFileMeta(msg.fileMeta, privateKey, isOriginalSender, recipientPubKeyPem, myPubKeyPem);
            // Re-encrypt caption if present
            const reEncryptedText = content ? await encryptForBoth(content, recipientPubKeyPem, myPubKeyPem) : "";
            content = JSON.stringify({
              fileMeta: newFileMeta,
              text: reEncryptedText
            });
          }

          // 2. Decrypt existing metadata before re-encrypting (to avoid double-encryption)
          let plainFileName = fileName;
          let plainFileSize = fileSize;
          let plainFileUrl = fileUrl;

          if (fileName && isEncryptedPayload(fileName)) {
            plainFileName = await decryptMessage(fileName, privateKey, isOriginalSender);
          }
          if (fileSize && isEncryptedPayload(fileSize)) {
            plainFileSize = await decryptMessage(fileSize, privateKey, isOriginalSender);
          }
          if (fileUrl && isEncryptedPayload(fileUrl)) {
            plainFileUrl = await decryptMessage(fileUrl, privateKey, isOriginalSender);
          }

          // 3. Re-encrypt for the new recipient
          if (plainFileUrl) fileUrl = await encryptForBoth(plainFileUrl, recipientPubKeyPem, myPubKeyPem);
          if (plainFileName) fileName = await encryptForBoth(plainFileName, recipientPubKeyPem, myPubKeyPem);
          if (plainFileSize) fileSize = await encryptForBoth(plainFileSize, recipientPubKeyPem, myPubKeyPem);
        }
      }

      await sendMessageApi(
        targetUser.id.toString(),
        content,
        msg.messageType as any,
        undefined,
        isEncrypted,
        undefined,
        fileUrl,
        fileName,
        fileSize,
        true, // isForwarded
        msg.id.toString()
      );

      setIsForwardModalOpen(false);
      setForwardingMessage(null);
      setForwardSearchQuery("");

      // Optionally navigate to the chat or just show success
      // navigate(`/chat/${targetUser.username}`);
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!chat || !me) return;
    try {
      await acceptRequestApi(chat.id);
      setChatStatus('ACCEPTED');
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };


  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    // Using requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior, block: 'end' });
        setShowScrollButton(false);
      }
    });
  };

  const loadMoreMessages = async () => {
    if (!chat?.username || !hasMore || isFetchingMore || isLoadingMessages) return;

    setIsFetchingMore(true);
    const oldestMessageId = localMessages[0]?.id;
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    try {
      const data = await getMessagesApi(chat.username, oldestMessageId);
      if (data.messages && data.messages.length > 0) {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        const decryptedMessages = await Promise.all(data.messages.map(async (msg: any) => {
          let decryptedText = msg.text || msg.message || msg.content || "";
          let fileMeta = "";

          if (msg.isEncrypted && privateKey && msg.text) {
            try {
              let cipherText = msg.text;
              try {
                const parsed = JSON.parse(msg.text);
                if (parsed.fileMeta) {
                  cipherText = parsed.text || "";
                  fileMeta = parsed.fileMeta;
                } else if (parsed.iv && (parsed.r || parsed.s)) {
                  cipherText = "";
                  fileMeta = msg.text;
                }
              } catch (e) {
                if (msg.messageType !== 'TEXT') {
                  fileMeta = msg.text;
                  cipherText = "";
                }
              }

              const isSender = String(msg.senderId) === String(me?.id);
              if (cipherText && cipherText !== "[Unable to decrypt message]") {
                decryptedText = await decryptMessage(cipherText, privateKey, isSender);
              } else {
                decryptedText = "";
              }
            } catch (err) {
              console.error('Load more decryption failed:', err);
            }
          }
          return { ...msg, text: decryptedText, fileMeta };
        }));

        setLocalMessages(prev => [...decryptedMessages, ...prev]);
        setHasMore(data.hasMore);

        // Preserve scroll position after DOM update
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - previousScrollHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to fetch more messages:', err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    setShowScrollButton(!isAtBottom);

    // Trigger load more when reaching the top
    if (target.scrollTop <= 50 && hasMore && !isFetchingMore && !isLoadingMessages) {
      loadMoreMessages();
    }
  };

  const prevMessagesLengthRef = useRef(0);
  const lastChatIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Reset length tracking when switching chats
    if (chat?.id !== lastChatIdRef.current) {
      prevMessagesLengthRef.current = 0;
      lastChatIdRef.current = chat?.id;
    }

    const isInitialLoad = localMessages.length > 0 && prevMessagesLengthRef.current === 0;
    const isNewMessage = localMessages.length > prevMessagesLengthRef.current && !isFetchingMore;
    const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 600;

    if (isInitialLoad) {
      // Use a slight timeout for initial load to ensure skeleton is gone and content is rendered
      setTimeout(() => scrollToBottom('auto'), 100);
    } else if (isNewMessage && isNearBottom) {
      scrollToBottom('smooth');
    }

    prevMessagesLengthRef.current = localMessages.length;
  }, [localMessages, chat?.id, isFetchingMore]);

  // Auto-scroll for typing indicator
  useEffect(() => {
    if (isTyping) {
      const container = messagesContainerRef.current;
      if (container) {
        // If user is near bottom, scroll to show the indicator
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 300;
        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [isTyping]);

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
                      startCall({
                        id: chat.id.toString(),
                        name: chat.name,
                        avatar: chat.avatar
                      });
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

      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Block {chat.name}?</DialogTitle>
            <DialogDescription>
              Blocked contacts will no longer be able to call you or send you messages. This action can be undone later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsBlockModalOpen(false)} disabled={isBlockingAction} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={isBlockingAction}
              className="flex-1"
            >
              {isBlockingAction ? "Blocking..." : "Block User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUnblockModalOpen} onOpenChange={setIsUnblockModalOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Unblock {chat?.name || chat?.username}?</DialogTitle>
            <DialogDescription>
              Unblocking this contact will allow them to send you messages and call you again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsUnblockModalOpen(false)} disabled={isBlockingAction} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleUnblock}
              disabled={isBlockingAction}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isBlockingAction ? "Unblocking..." : "Unblock User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAcceptModalOpen} onOpenChange={setIsAcceptModalOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Accept message request?</DialogTitle>
            <DialogDescription>
              Once you accept, you can message each other and see each other's status. They will also see that you've read their messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsAcceptModalOpen(false)} disabled={isBlockingAction} className="flex-1">
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                handleAcceptRequest();
                setIsAcceptModalOpen(false);
              }}
              disabled={isBlockingAction}
            >
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isForwardModalOpen} onOpenChange={setIsForwardModalOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faShare} className="text-primary text-sm" />
              Forward Message
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-4 space-y-4">
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
              <Input
                placeholder="Search people to forward..."
                value={forwardSearchQuery}
                onChange={(e) => setForwardSearchQuery(e.target.value)}
                className="pl-9 bg-black/5 border-none focus-visible:ring-1 focus-visible:ring-primary/20 h-10"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {isSearchingForward ? (
                <div className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : forwardSearchResults.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {forwardSearchResults.map(user => (
                    <div
                      key={user.id}
                      onClick={() => !isForwarding && handleForward(user)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-xl hover:bg-primary/10 cursor-pointer transition-all group",
                        isForwarding && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Avatar className="h-10 w-10 border border-border/50 group-hover:border-primary/30 transition-colors">
                        <AvatarImage src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} />
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{user.name || user.username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                        {isForwarding ? (
                          <FontAwesomeIcon icon={faSpinner} className="text-xs animate-spin" />
                        ) : (
                          <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : forwardSearchQuery ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-xs">Search for contacts to forward this message</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages Area */}
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
          {isLoadingMessages ? (
            <ChatWindowSkeleton />
          ) : (
            <div className="flex flex-col w-full gap-1">
              {localMessages.map(msg => {
                const isMe = String(msg.senderId) === String(me?.id);
                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={cn(
                      "flex w-full mb-1 group transition-all duration-500 rounded-lg p-1",
                      isMe ? "justify-end" : "justify-start",
                      searchResults[searchMatchIndex] === msg.id && "bg-primary/10 ring-1 ring-primary/20",
                      highlightedMessageId === msg.id && "bg-primary/20 ring-2 ring-primary/40 scale-[1.02] shadow-lg"
                    )}
                  >
                    <MessageBubble
                      message={msg}
                      isMe={isMe}
                      otherName={chat?.username}
                      onEdit={(m) => {
                        setEditingMessage(m);
                        setInputText(m.text || "");
                      }}
                      onDelete={async (id) => {
                        setDeletingMessageId(id);
                        try {
                          await deleteMessageApi(id);
                        } catch (err) {
                          console.error('Failed to delete message:', err);
                        } finally {
                          setDeletingMessageId(null);
                        }
                      }}
                      isDeleting={deletingMessageId === msg.id}
                      onForward={(m) => {
                        setForwardingMessage(m);
                        setIsForwardModalOpen(true);
                      }}
                      onReply={(m) => setReplyingToMessage(m)}
                      onScrollTo={scrollToMessage}
                      onReact={handleReact}
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

          {isBlocked && !isLoadingMessages && (
            <div className="sticky bottom-0 left-0 right-0 flex justify-center pb-2 z-10">
              <div className="bg-background/90 backdrop-blur-md border border-destructive/20 px-6 py-2 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-500">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {blockedByMe ? "You have blocked this contact" : "This contact has blocked you"}
                </span>
                {blockedByMe && (
                  <Button variant="link" size="sm" onClick={() => setIsUnblockModalOpen(true)} className="h-auto p-0 text-primary font-bold hover:no-underline">
                    UNBLOCK
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        {showScrollButton && (
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scrollToBottom()}
            className="absolute bottom-6 right-8 h-11 w-11 rounded-full shadow-2xl border border-primary/20 bg-background/90 backdrop-blur-md text-primary animate-in zoom-in fade-in duration-300 z-50"
          >
            <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Input Area */}
      {!isLoadingMessages && (
        <div className="bg-[hsl(var(--chat-header-bg))] border-t relative">
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
      )}

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Call UI */}
      <CallOverlay
        state={callState as any}
        partner={callPartner}
        isMuted={isMuted}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
      />
    </div>
  );
}
