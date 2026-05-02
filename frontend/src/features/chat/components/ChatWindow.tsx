import React, { useState, useEffect, useRef } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPaperPlane, faChevronDown, faShare, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Chat, Message } from "../types";
import { cn } from "@/shared/lib/utils";

import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

import { getMessagesApi, sendMessageApi, markSeenApi, blockUserApi, unblockUserApi, acceptRequestApi, searchMessagesApi, getPublicKeyApi, uploadFileApi, updateMessageApi, deleteMessageApi, getChatListApi } from '../chatService';
import { encryptForBoth, decryptMessage, getLocalPrivateKey, encryptFileForBoth, isEncryptedPayload, rewrapFileMeta, saveCachedMessages, getCachedMessages, decryptMessageBatch } from '@/shared/lib/cryptoUtils';

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

export function ChatWindow({ 
  chat, 
  onStartAudioCall, 
  onStartVideoCall
}: ChatWindowProps) {
  const { user: me } = useSelector((state: RootState) => state.auth);

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

  // --- State Management ---

  useEffect(() => {
    if (localMessages.length > 0 && !isLoadingMessages && !isFetchingMore) {
      scrollToBottom('auto');
    }
  }, [localMessages.length, isLoadingMessages, isFetchingMore]);

  /**
   * Updates current chat reference and resets local UI states on chat switch.
   */
  useEffect(() => {
    currentChatRef.current = chat;
    setIsTyping(false); 
  }, [chat]);

  const { isE2eeInitialized, selectedChatMessages } = useSelector((state: RootState) => state.chat);
  // Fetch messages and public key when chat changes
  useEffect(() => {
    let isMounted = true;
    if (chat?.username && isE2eeInitialized) {
      // Use messages from Redux (cache) as initial state to avoid flicker
      const hasCache = selectedChatMessages.length > 0;
      setIsLoadingMessages(!hasCache);
      setLocalMessages(selectedChatMessages); 
      setRecipientPublicKey(null);
      setMyPublicKey(null);

      // Fetch public keys
      if (me?.username) {
        getPublicKeyApi(chat.username).then(key => setRecipientPublicKey(key)).catch(e => console.error(e));
        getPublicKeyApi(me.username).then(key => setMyPublicKey(key)).catch(e => console.error(e));
      }
      /**
       * Background synchronization effect:
       * 1. Hydrates UI with cached messages from Redux for instant rendering.
       * 2. Fetches fresh data from the server in the background.
       * 3. Performs batch E2EE decryption before updating the local view.
       */
      (getMessagesApi(chat.username) as Promise<any>).then(async data => {
        const privateKey = me?.id ? await getLocalPrivateKey(String(me.id)) : null;
        const decryptedMessages = await decryptMessageBatch(data.messages || [], privateKey, me?.id ? String(me.id) : undefined);
        if (isMounted) {
          setLocalMessages(decryptedMessages);
          saveCachedMessages(chat.username, data.messages || []); // Save RAW messages
        }
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

    return () => {
      isMounted = false;
    };
  }, [chat?.id, chat?.username, me?.id, me?.username, dispatch, isE2eeInitialized, selectedChatMessages]);

  /**
   * Optimized message search handler with debouncing and request cancellation.
   * Performs a hybrid search: locally through decrypted state and via backend for deep history.
   */
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
    }
  };
  /**
   * Real-time message subscription handler.
   * Manages incoming messages, call logs, typing indicators, and E2EE synchronization via Sockets.
   */
  useEffect(() => {
    return subscribeToMessages(async (err: Error | null, msg: any) => {
      if (err) return;
      if (!msg) return;

      // Handle events first
      if (msg.type === 'call:log_sync') {
        if (chat && (
          (String(msg.senderId) === String(chat.id) && String(msg.receiverId) === String(me?.id)) ||
          (String(msg.senderId) === String(me?.id) && String(msg.receiverId) === String(chat.id))
        )) {
          setLocalMessages(prev => {
            if (prev.some(m => String(m.id) === String(msg.id))) return prev;
            return [...prev, msg];
          });
        }
        return;
      }

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
            } catch (e) { }
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

        // Update cache
        getCachedMessages(chat.username).then(cached => {
          if (!cached.some(m => String(m.id) === String(msg.id))) {
            const updated = [...cached, msg].slice(-10);
            saveCachedMessages(chat.username, updated);
          }
        });
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



  return (
    <>
      <Dialog open={isBlockModalOpen} onOpenChange={setIsBlockModalOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Block {chat?.name}?</DialogTitle>
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

      <div className="flex-1 h-full min-h-0 flex flex-col bg-[hsl(var(--chat-bg))] text-foreground overflow-hidden">
        <ChatHeader
          chat={chat}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          searchMatchIndex={searchMatchIndex}
          navigateSearch={navigateSearch}
          setSearchResults={setSearchResults}
          isLoadingMessages={isLoadingMessages}
          isTyping={isTyping}
          isBlocked={isBlocked}
          blockedByMe={blockedByMe}
          chatStatus={chatStatus}
          onStartVideoCall={onStartVideoCall}
          onStartAudioCall={onStartAudioCall}
          setIsBlockModalOpen={setIsBlockModalOpen}
          setIsUnblockModalOpen={setIsUnblockModalOpen}
        />

        <MessageList
          localMessages={localMessages}
          isLoadingMessages={isLoadingMessages}
          isFetchingMore={isFetchingMore}
          isTyping={isTyping}
          isUploading={isUploading}
          me={me}
          chat={chat}
          searchResults={searchResults}
          searchMatchIndex={searchMatchIndex}
          highlightedMessageId={highlightedMessageId}
          deletingMessageId={deletingMessageId}
          messagesContainerRef={messagesContainerRef}
          scrollRef={scrollRef}
          handleScroll={handleScroll}
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
          onForward={(m) => {
            setForwardingMessage(m);
            setIsForwardModalOpen(true);
          }}
          onReply={(m) => setReplyingToMessage(m)}
          onScrollTo={scrollToMessage}
          onReact={handleReact}
        />

        <ChatInput
          chat={chat}
          me={me}
          inputText={inputText}
          setInputText={setInputText}
          handleSendMessage={handleSendMessage}
          isLoadingMessages={isLoadingMessages}
          isBlocked={isBlocked}
          blockedByMe={blockedByMe}
          chatStatus={chatStatus}
          requesterId={requesterId}
          localMessages={localMessages}
          selectedFile={selectedFile}
          filePreview={filePreview}
          removeSelectedFile={removeSelectedFile}
          handleFileClick={handleFileClick}
          isEmojiPickerOpen={isEmojiPickerOpen}
          setIsEmojiPickerOpen={setIsEmojiPickerOpen}
          handleEmojiClick={handleEmojiClick}
          pickerRef={pickerRef}
          editingMessage={editingMessage}
          setEditingMessage={setEditingMessage}
          replyingToMessage={replyingToMessage}
          setReplyingToMessage={setReplyingToMessage}
          isRecording={isRecording}
          recordingTime={recordingTime}
          startRecording={startRecording}
          stopRecording={stopRecording}
          cancelRecording={cancelRecording}
          setIsAcceptModalOpen={setIsAcceptModalOpen}
          setIsBlockModalOpen={setIsBlockModalOpen}
          setIsUnblockModalOpen={setIsUnblockModalOpen}
          typingTimeoutRef={typingTimeoutRef}
        />

        {showScrollButton && (
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scrollToBottom()}
            className="absolute bottom-[90px] right-8 h-11 w-11 rounded-full shadow-2xl border border-primary/20 bg-background/90 backdrop-blur-md text-primary animate-in zoom-in fade-in duration-300 z-[45]"
          >
            <FontAwesomeIcon icon={faChevronDown} className="h-5 w-5" />
          </Button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Global Call UI moved to app.tsx */}
      </div>
    </>
  );
}
