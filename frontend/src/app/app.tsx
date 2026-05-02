import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { cn } from '@/shared/lib/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { ProtectedRoute, PublicRoute } from '@/routes/ProtectedRoute';
import { RootState, AppDispatch } from '@/app/store';
import { initiateSocketConnection, disconnectSocket, subscribeToMessages, getSocket } from '@/shared/lib/socket';
import { fetchChatList, updateChatLastMessage, setTypingStatus, setUserStatus, updateChatStatus, updateChatPreview, setE2eeInitialized, fetchSelectedChat, setSelectedChat } from '@/features/chat/chatSlice';
import { setPublicKeyApi, getPublicKeyApi, sendMessageApi } from '@/features/chat/chatService';
import { generateE2EEKeys, saveKeys, exportPublicKey, getLocalKeys, encryptForBoth, exportPrivateKey, importPrivateKey, importPublicKey } from '@/shared/lib/cryptoUtils';
import { encryptData, decryptData } from '@/shared/utils/encryption';
import { useWebRTC } from '@/features/chat/hooks/useWebRTC';

/**
 * Lazy-loaded components for optimized bundle size and faster initial paint.
 */
const ChatSidebar = React.lazy(() => import('@/features/chat/components/ChatSidebar').then(m => ({ default: m.ChatSidebar })));
const ChatWindow = React.lazy(() => import('@/features/chat/components/ChatWindow').then(m => ({ default: m.ChatWindow })));
const AuthPage = React.lazy(() => import('@/features/auth/pages/AuthPage').then(m => ({ default: m.AuthPage })));
const ProfileSettings = React.lazy(() => import('@/features/settings/components/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const CredentialsSettings = React.lazy(() => import('@/features/settings/components/CredentialsSettings').then(m => ({ default: m.CredentialsSettings })));
const CallOverlay = React.lazy(() => import('@/features/chat/components/CallOverlay').then(m => ({ default: m.CallOverlay })));

const ChatSidebarSkeleton = React.lazy(() => import('@/features/chat/components/ChatSidebarSkeleton').then(m => ({ default: m.ChatSidebarSkeleton })));
const ChatWindowSkeleton = React.lazy(() => import('@/features/chat/components/ChatWindowSkeleton').then(m => ({ default: m.ChatWindowSkeleton })));

const LoadingScreen = () => (
  <div className="flex h-screen w-screen overflow-hidden bg-background">
    <div className="w-[350px] lg:w-[400px] border-r shrink-0">
      <ChatSidebarSkeleton />
    </div>
    <div className="flex-1">
      <ChatWindowSkeleton />
    </div>
  </div>
);

/**
 * Main application layout component.
 * Manages global states including Socket connections, E2EE initialization, and WebRTC signaling.
 */
function ChatLayout() {
  const { chatId } = useParams<{ chatId: string }>(); 
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { chats, selectedChat, isLoadingSelectedChat } = useSelector((state: RootState) => state.chat);

  /**
   * Global handler for logging audio/video calls as messages.
   * Ensures that call history is persisted with E2EE encryption just like regular messages.
   */
  const onLogCallGlobal = React.useCallback(async (
    type: 'MISSED' | 'REJECTED' | 'ENDED' | 'NO_ANSWER' | 'BUSY', 
    duration?: number, 
    providedLogId?: string, 
    isOwner?: boolean,
    partnerId?: string,
    partnerName?: string,
    partnerUsername?: string
  ) => {
    if (!user) return;
    const currentPartner = partnerId ? { id: partnerId, name: partnerName || 'User', username: partnerUsername } : partnerRef.current;
    if (!currentPartner) return;

    let plainText = '';
    if (type === 'MISSED') plainText = isOwner ? 'Missed call' : `Missed call from ${currentPartner.name}`;
    else if (type === 'BUSY') plainText = isOwner ? `Missed call` : `Missed call from ${currentPartner.name}`;
    else if (type === 'NO_ANSWER') plainText = isOwner ? 'No answer' : `Missed call from ${currentPartner.name}`;
    else if (type === 'REJECTED') plainText = isOwner ? `${currentPartner.name} declined` : 'You declined the call';
    else if (type === 'ENDED') {
      const mins = Math.floor((duration || 0) / 60);
      const secs = (duration || 0) % 60;
      plainText = `Audio call (${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')})`;
    }

    const clientMsgId = providedLogId || `log-${Date.now()}`;

    dispatch(updateChatLastMessage({
      chatId: String(currentPartner.id),
      message: type === 'BUSY' && isOwner ? `${currentPartner.name} was busy` : plainText,
      time: new Date().toISOString(),
      isMine: isOwner || false,
      sender: isOwner ? user : undefined,
      receiver: !isOwner ? user : undefined,
      isEncrypted: true,
      lastMessageSenderId: isOwner ? String(user.id) : String(currentPartner.id),
      lastMessageId: clientMsgId,
      lastMessageType: 'CALL',
      isForwarded: false
    }));

    try {
      const targetUsername = currentPartner.username || currentPartner.name;
      const rKey = await getPublicKeyApi(targetUsername); 
      const mKey = await getPublicKeyApi(user.username);
      let encryptedText = plainText;
      if (rKey && mKey) encryptedText = await encryptForBoth(plainText, rKey, mKey);

      await sendMessageApi(currentPartner.id, encryptedText, 'CALL', undefined, !!(rKey && mKey), clientMsgId);
    } catch (err) {
      // Error handling is handled silently in production
    }
  }, [user, dispatch]);

  const partnerRef = React.useRef<{ id: string; name: string; username: string; avatar?: string } | null>(null);

  /**
   * WebRTC Hook for managing P2P audio/video communication.
   */
  const {
    callState,
    localStream,
    remoteStream,
    callType,
    isMuted,
    partner: callPartner,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute
  } = useWebRTC({
    currentUserId: String(user?.id || ''),
    currentUserName: user?.name || user?.username || 'User',
    currentUserUsername: user?.username || '',
    currentUserAvatar: user?.avatar,
    onIncomingCall: (data) => {},
    onCallAccepted: () => {},
    onCallEnded: () => {},
    onLogCall: onLogCallGlobal
  });

  React.useEffect(() => {
    partnerRef.current = callPartner;
  }, [callPartner]);

  React.useEffect(() => {
    if (remoteStream) {
      const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
      if (audioEl) audioEl.srcObject = remoteStream;
    }
  }, [remoteStream]);
  
  /**
   * Core initialization logic:
   * 1. Establishes Socket connection.
   * 2. Orchestrates E2EE key management (local vs server synchronization).
   * 3. Handles automatic key upgrades and legacy migrations.
   */
  React.useEffect(() => {
    if (user?.id && token) {
      initiateSocketConnection(user.id, token);
      const initializeE2EE = async () => {
        try {
          const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;
          const serverKeyPayload = await getPublicKeyApi(user.username);
          const localKeys = await getLocalKeys(String(user.id));

          if (!localKeys) {
            // First-time setup or new device login
            const isBackup = (typeof serverKeyPayload === 'string' && serverKeyPayload.startsWith('{')) || 
                            (typeof serverKeyPayload === 'object' && serverKeyPayload !== null && (serverKeyPayload as any).pub && (serverKeyPayload as any).priv);
            if (serverKeyPayload && isBackup && APP_ENCRYPTION_KEY) {
              try {
                const parsed = typeof serverKeyPayload === 'string' ? JSON.parse(serverKeyPayload) : serverKeyPayload;
                if (parsed.priv) {
                  const decryptedPrivPem = decryptData(parsed.priv);
                  if (decryptedPrivPem) {
                    const privateKey = await importPrivateKey(decryptedPrivPem);
                    const publicKey = await importPublicKey(parsed.pub); 
                    await saveKeys(String(user.id), { privateKey, publicKey });
                    return;
                  }
                }
              } catch (e) {}
            }
            // Generate and persist new E2EE keys
            const keys = await generateE2EEKeys();
            await saveKeys(String(user.id), keys);
            const pubPem = await exportPublicKey(keys.publicKey);
            const privPem = await exportPrivateKey(keys.privateKey);
            if (APP_ENCRYPTION_KEY) {
               await setPublicKeyApi(JSON.stringify({ pub: pubPem, priv: encryptData(privPem) }));
            } else {
               await setPublicKeyApi(pubPem);
            }
          } else {
            // Validate existing keys and handle potential server mismatches or upgrades
            const isBackup = (typeof serverKeyPayload === 'string' && serverKeyPayload.startsWith('{')) || 
                            (typeof serverKeyPayload === 'object' && serverKeyPayload !== null && (serverKeyPayload as any).pub && (serverKeyPayload as any).priv);
            const needsUpgrade = serverKeyPayload && !isBackup;
            const missingOnServer = !serverKeyPayload;
            let isMismatch = false;
            if (isBackup) {
               try {
                 const parsed = typeof serverKeyPayload === 'string' ? JSON.parse(serverKeyPayload) : serverKeyPayload;
                 const localPubPem = (await exportPublicKey(localKeys!.publicKey)).trim();
                 if ((parsed.pub || "").trim() !== localPubPem) isMismatch = true;
               } catch (e) {}
            } else if (serverKeyPayload && typeof serverKeyPayload === 'string') {
               const localPubPem = (await exportPublicKey(localKeys!.publicKey)).trim();
               if (serverKeyPayload.trim() !== localPubPem) isMismatch = true;
            }
            if (isMismatch && isBackup && APP_ENCRYPTION_KEY) {
              try {
                const parsed = typeof serverKeyPayload === 'string' ? JSON.parse(serverKeyPayload) : serverKeyPayload;
                const decryptedPrivPem = decryptData(parsed.priv);
                if (decryptedPrivPem) {
                   const privateKey = await importPrivateKey(decryptedPrivPem);
                   const publicKey = await importPublicKey(parsed.pub);
                   await saveKeys(String(user.id), { privateKey, publicKey });
                   return;
                }
              } catch (e) {}
            }
            if ((needsUpgrade || missingOnServer || isMismatch) && APP_ENCRYPTION_KEY) {
              const pubPem = await exportPublicKey(localKeys!.publicKey);
              const privPem = await exportPrivateKey(localKeys!.privateKey);
              await setPublicKeyApi(JSON.stringify({ pub: pubPem, priv: encryptData(privPem) }));
            }
          }
        } catch (err) {
          // Failure handled gracefully
        } finally {
          dispatch(setE2eeInitialized(true));
        }
      };
      initializeE2EE();
    }
    const handleBeforeUnload = () => {
      if (user?.id) {
        const socket = getSocket();
        if (socket) socket.emit('userOffline', { userId: user.id });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnectSocket();
    };
  }, [user?.id, user?.username, token, dispatch]);

  React.useEffect(() => {
    dispatch(fetchChatList());
  }, [dispatch]);

  /**
   * Real-time Socket Event Handlers.
   * Subscribes to incoming messages, typing statuses, and user presence updates.
   */
  React.useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToMessages((err: Error | null, msg: any) => {
      if (err) return;
      if (msg.type === 'typing') { dispatch(setTypingStatus({ chatId: String(msg.senderId), isTyping: true })); return; }
      if (msg.type === 'stopTyping') { dispatch(setTypingStatus({ chatId: String(msg.senderId), isTyping: false })); return; }
			if (msg.type === 'newMessage') {
				const isMine = String(msg.senderId) === String(user.id);
				const sidebarChatId = isMine ? msg.receiverId : msg.senderId;
        if (!isMine && msg.messageType !== 'CALL') {
          const notificationSound = new Audio('/message_notification.mp3');
          notificationSound.volume = 0.5;
          notificationSound.play().catch(() => {});
        }
				if (sidebarChatId) {
					let displayMessage = (msg.isEncrypted && msg.text) ? msg.text : (msg.sidebarText || msg.text || '');
					if (msg.messageType === 'CALL') {
						const isReceiver = String(msg.receiverId) === String(user.id);
						const lowerText = msg.text?.toLowerCase() || '';
						if (lowerText.includes('missed') || lowerText === 'no answer') displayMessage = isReceiver ? `Missed call from ${msg.sender?.name || 'User'}` : (lowerText === 'no answer' ? 'No answer' : 'Missed call');
						else if (lowerText.includes('declined')) displayMessage = isReceiver ? 'You declined the call' : `${msg.receiver?.name || 'User'} declined`;
						else displayMessage = msg.text || 'Audio call';
					}
					dispatch(updateChatLastMessage({
						chatId: String(sidebarChatId), message: displayMessage, time: msg.timestamp, isMine: isMine, sender: msg.sender, receiver: msg.receiver, isEncrypted: msg.isEncrypted, lastMessageSenderId: String(msg.senderId), lastMessageId: String(msg.id), lastMessageType: msg.messageType, isForwarded: !!msg.isForwarded
					}));
				}
      } else if (msg.type === 'chatRequestAccepted') {
        dispatch(updateChatStatus({ chatRoomId: msg.chatRoomId, status: 'ACCEPTED' }));
      } else if (msg.type === 'messageUpdated' || msg.type === 'messageDeleted') {
        dispatch(updateChatPreview({ messageId: msg.id, senderId: msg.senderId, receiverId: msg.receiverId, sidebarText: msg.sidebarText, isMine: String(msg.senderId) === String(user?.id), isEncrypted: msg.type === 'messageDeleted' ? false : undefined }));
      }
    });
    const socket = getSocket();
    if (socket) {
      socket.on('userStatus', (data: { userId: number; isOnline: boolean; lastSeen?: string }) => {
        dispatch(setUserStatus({ userId: String(data.userId), isOnline: data.isOnline, lastSeen: data.lastSeen }));
      });
    }
    return () => { if (unsubscribe) unsubscribe(); if (socket) socket.off('userStatus'); };
  }, [user?.id, dispatch]);

  /**
   * Syncs the selected chat state based on URL parameters.
   */
  React.useEffect(() => {
    if (chatId) {
      dispatch(fetchSelectedChat(chatId));
    } else {
      dispatch(setSelectedChat(null));
    }
  }, [chatId, dispatch]);

  const isSettingsMenu = pathname === '/settings';
  const isSettingsContent = pathname === '/profile' || pathname === '/credentials';
  const isSettingsPage = isSettingsMenu || isSettingsContent;

  const pageTitle = React.useMemo(() => {
    if (selectedChat) return `${selectedChat.name || selectedChat.username} | Folio-Messenger`;
    if (pathname === '/profile') return `Profile | Folio-Messenger`;
    if (pathname === '/credentials') return `Account & Security | Folio-Messenger`;
    if (pathname === '/settings') return `Settings | Folio-Messenger`;
    return 'Folio-Messenger';
  }, [selectedChat, pathname]);
  usePageTitle(pageTitle);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Navigation Sidebar */}
      <div className={cn(
        "w-full lg:w-[400px] border-r flex flex-col shrink-0",
        (chatId || isSettingsContent) ? "hidden lg:flex" : "flex"
      )}>
        <React.Suspense fallback={<ChatSidebarSkeleton />}>
          <ChatSidebar chats={chats} activeChatId={chatId} />
        </React.Suspense>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 h-full relative overflow-hidden",
        !chatId && !isSettingsContent ? "hidden lg:flex" : "flex"
      )}>
        <React.Suspense fallback={<ChatWindowSkeleton />}>
          {isSettingsPage ? (
            <div className="flex-1 flex flex-col h-full bg-[hsl(var(--sidebar-bg))]">
              <div className="h-[60px] bg-[hsl(var(--sidebar-header-bg))] px-4 flex items-center lg:hidden shrink-0 border-b">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-2 h-9 w-9 rounded-full">
                  <FontAwesomeIcon icon={faArrowLeft} />
                </Button>
                <h3 className="text-lg font-bold">Settings</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 lg:p-10 bg-background">
                <div className="max-w-2xl mx-auto">
                  <Routes>
                    <Route path="/profile" element={<ProfileSettings />} />
                    <Route path="/credentials" element={<CredentialsSettings />} />
                    <Route path="/settings" element={
                      <div className="space-y-6">
                        <h2 className="text-2xl font-bold mb-4">Settings</h2>
                        <Card className="border-none shadow-none bg-black/5 dark:bg-white/5">
                          <CardContent className="p-6">
                            <p className="text-muted-foreground">Select a setting from the sidebar to manage your account.</p>
                          </CardContent>
                        </Card>
                      </div>
                    } />
                  </Routes>
                </div>
              </div>
            </div>
          ) : (chatId) ? (
             isLoadingSelectedChat || (selectedChat?.username !== chatId) ? (
               <ChatWindowSkeleton />
             ) : (
               <ChatWindow 
                chat={selectedChat!} 
                onStartAudioCall={(c) => startCall({ id: c.id, name: c.name, username: c.username, avatar: c.avatar }, 'audio')}
                onStartVideoCall={(c) => startCall({ id: c.id, name: c.name, username: c.username, avatar: c.avatar }, 'video')} 
              />
             )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[hsl(var(--chat-bg))] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -mr-64 -mt-64 transition-all duration-1000 group-hover:bg-primary/10" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -ml-64 -mb-64 transition-all duration-1000 group-hover:bg-primary/10" />
              <div className="relative flex flex-col items-center max-w-sm animate-in fade-in zoom-in duration-700">
                <div className="w-24 h-24 mb-8 relative">
                  <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping duration-[3000ms]" />
                  <img src="/logo.jpg" alt="Folio-Messenger" className="w-full h-full rounded-full object-cover border-4 border-background shadow-2xl relative z-10" />
                </div>
                <h2 className="text-3xl font-black mb-3 tracking-tight text-foreground">Folio-Messenger</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Select a contact to start messaging securely with <span className="text-primary font-bold">End-to-End Encryption</span>.
                </p>
                <div className="mt-8 flex gap-3">
                   <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">Secure</div>
                   <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">Private</div>
                </div>
              </div>
            </div>
          )}
        </React.Suspense>
      </div>

      {/* Global Call UI Overlay */}
      {callState !== 'IDLE' && (
        <CallOverlay
          state={callState as any} partner={callPartner} isMuted={isMuted} onAccept={acceptCall} onReject={rejectCall} onEnd={endCall} onToggleMute={toggleMute} callType={callType} localStream={localStream} remoteStream={remoteStream}
        />
      )}
    </div>
  );
}

/**
 * Root Application Component.
 * Defines the main routing structure and protected access layers.
 */
function App() {
  return (
    <Router>
      <React.Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<PublicRoute><AuthPage initialIsLogin={true} /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><AuthPage initialIsLogin={false} /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/messages/:chatId" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/credentials" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ChatLayout /></ProtectedRoute>} />
        </Routes>
      </React.Suspense>
    </Router>
  );
}

export default App;
