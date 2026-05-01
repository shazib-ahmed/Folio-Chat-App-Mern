import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChatSidebar } from '@/features/chat/components/ChatSidebar';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { AuthPage } from '@/features/auth/pages/AuthPage';
import { ProfileSettings } from '@/features/settings/components/ProfileSettings';
import { CredentialsSettings } from '@/features/settings/components/CredentialsSettings';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { Chat } from '@/features/chat/types';
import { cn } from '@/shared/lib/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { ProtectedRoute, PublicRoute } from '@/routes/ProtectedRoute';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/app/store';
import { initiateSocketConnection, disconnectSocket, subscribeToMessages, getSocket } from '@/shared/lib/socket';
import { fetchChatList, updateChatLastMessage, setTypingStatus, setUserStatus, updateChatStatus, updateChatPreview } from '@/features/chat/chatSlice';
import { getUserByUsernameApi, setPublicKeyApi, getPublicKeyApi, sendMessageApi } from '@/features/chat/chatService';
import { generateE2EEKeys, saveKeys, exportPublicKey, getLocalKeys, encryptForBoth } from '@/shared/lib/cryptoUtils';
import { useWebRTC } from '@/features/chat/hooks/useWebRTC';
import { CallOverlay } from '@/features/chat/components/CallOverlay';

function ChatLayout() {
  const { chatId } = useParams<{ chatId: string }>(); // This is now a username
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const { chats } = useSelector((state: RootState) => state.chat);
  const [selectedUser, setSelectedUser] = React.useState<Chat | undefined>(undefined);

  // Global Call Logging Handler
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
    
    // Determine which chat this log belongs to
    // Priority: explicitly passed partner info > currently active call partner
    const currentPartner = partnerId ? { id: partnerId, name: partnerName || 'User', username: partnerUsername } : partnerRef.current;
    if (!currentPartner) return;

    let plainText = '';
    if (type === 'MISSED') {
      plainText = isOwner ? 'Missed call' : `Missed call from ${currentPartner.name}`;
    }
    else if (type === 'BUSY') {
      // The caller saves "Missed call" to the DB so the receiver sees it as a missed call,
      // but we will show "User was busy" locally for the caller.
      plainText = isOwner ? `Missed call` : `Missed call from ${currentPartner.name}`;
    }
    else if (type === 'NO_ANSWER') {
      plainText = isOwner ? 'No answer' : `Missed call from ${currentPartner.name}`;
    }
    else if (type === 'REJECTED') {
      plainText = isOwner ? `${currentPartner.name} declined` : 'You declined the call';
    }
    else if (type === 'ENDED') {
      const mins = Math.floor((duration || 0) / 60);
      const secs = (duration || 0) % 60;
      plainText = `Audio call (${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')})`;
    }

    const clientMsgId = providedLogId || `log-${Date.now()}`;

    // Update Redux sidebar (optimistic for both sides)
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

    // Save to DB
    // We allow both sides to save if it's a missed/rejected call to ensure it persists for the person who didn't trigger it
    // But for simplicity, let's stick to: Sender saves their outgoing, Receiver saves their incoming missed.
    try {
      // Use the partner's username if available, fallback to name (historical/search name)
      const targetUsername = currentPartner.username || currentPartner.name;
      const rKey = await getPublicKeyApi(targetUsername); 
      const mKey = await getPublicKeyApi(user.username);

      let encryptedText = plainText;
      if (rKey && mKey) {
        encryptedText = await encryptForBoth(plainText, rKey, mKey);
      }

      await sendMessageApi(
        currentPartner.id,
        encryptedText,
        'CALL',
        undefined,
        !!(rKey && mKey),
        clientMsgId
      );
    } catch (err) {
      console.error('Failed to log call globally:', err);
    }
  }, [user, dispatch]);

  const partnerRef = React.useRef<{ id: string; name: string; username: string; avatar?: string } | null>(null);

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
    currentUserId: String(user?.id || ''),
    currentUserName: user?.name || user?.username || 'User',
    currentUserUsername: user?.username || '',
    currentUserAvatar: user?.avatar,
    onIncomingCall: (data) => {
      console.log('Incoming call from:', data.fromName);
    },
    onCallAccepted: () => {
      console.log('Call accepted');
    },
    onCallEnded: () => {
      console.log('Call ended');
    },
    onLogCall: onLogCallGlobal
  });

  React.useEffect(() => {
    partnerRef.current = callPartner;
  }, [callPartner]);

  // Attach remote stream to audio element
  React.useEffect(() => {
    if (remoteStream) {
      const audioEl = document.getElementById('remoteAudio') as HTMLAudioElement;
      if (audioEl) {
        audioEl.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);
  
  React.useEffect(() => {
    if (user?.id && token) {
      initiateSocketConnection(user.id, token);

      const initializeE2EE = async () => {
        try {
          // Check if user has a public key on the server
          const serverPubKey = await getPublicKeyApi(user.username);
          const localKeys = await getLocalKeys(String(user.id));

          if (!localKeys) {
            console.log("Generating new E2EE keys...");
            const keys = await generateE2EEKeys();
            await saveKeys(String(user.id), keys);
            const pubPem = await exportPublicKey(keys.publicKey);
            await setPublicKeyApi(pubPem);
            console.log("E2EE keys generated and registered.");
          } else if (!serverPubKey) {
            console.log("Local key exists but missing on server. Re-syncing existing key...");
            // Re-register the existing public key
            const pubPem = await exportPublicKey(localKeys.publicKey);
            await setPublicKeyApi(pubPem);
            console.log("E2EE public key re-registered with server.");
          }
        } catch (err) {
          console.error("Failed to initialize E2EE:", err);
        }
      };
      initializeE2EE();
    }

    const handleBeforeUnload = () => {
      if (user?.id) {
        const socket = getSocket();
        if (socket) {
          socket.emit('userOffline', { userId: user.id });
        }
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

  // Subscribe to real-time messages for sidebar updates
  React.useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = subscribeToMessages((err: Error | null, msg: any) => {
      if (err) return;
      
      // Handle Typing Events
      if (msg.type === 'typing') {
        dispatch(setTypingStatus({ chatId: String(msg.senderId), isTyping: true }));
        return;
      }
      if (msg.type === 'stopTyping') {
        dispatch(setTypingStatus({ chatId: String(msg.senderId), isTyping: false }));
        return;
      }

      // Handle New Messages
			if (msg.type === 'newMessage') {
				const isMine = String(msg.senderId) === String(user.id);
				const sidebarChatId = isMine ? msg.receiverId : msg.senderId;

				if (sidebarChatId) {
					let displayMessage = (msg.isEncrypted && msg.text) ? msg.text : (msg.sidebarText || msg.text || '');
					
					// Special handling for CALL messages to show friendly sidebar text
					if (msg.messageType === 'CALL') {
						const isReceiver = String(msg.receiverId) === String(user.id);
						const lowerText = msg.text?.toLowerCase() || '';
						
						if (lowerText.includes('missed') || lowerText === 'no answer') {
							displayMessage = isReceiver 
								? `Missed call from ${msg.sender?.name || 'User'}` 
								: (lowerText === 'no answer' ? 'No answer' : 'Missed call');
						} else if (lowerText.includes('declined')) {
							displayMessage = isReceiver ? 'You declined the call' : `${msg.receiver?.name || 'User'} declined`;
						} else {
							displayMessage = msg.text || 'Audio call';
						}
					}
					
					dispatch(updateChatLastMessage({
						chatId: String(sidebarChatId),
						message: displayMessage,
						time: msg.timestamp,
						isMine: isMine,
						sender: msg.sender,
						receiver: msg.receiver,
						isEncrypted: msg.isEncrypted,
						lastMessageSenderId: String(msg.senderId),
						lastMessageId: String(msg.id),
						lastMessageType: msg.messageType,
						isForwarded: !!msg.isForwarded
					}));
				}
      } else if (msg.type === 'chatRequestAccepted') {
        dispatch(updateChatStatus({
          chatRoomId: msg.chatRoomId,
          status: 'ACCEPTED'
        }));
      } else if (msg.type === 'messageUpdated' || msg.type === 'messageDeleted') {
        dispatch(updateChatPreview({
          messageId: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          sidebarText: msg.sidebarText,
          isMine: String(msg.senderId) === String(user?.id),
          isEncrypted: msg.type === 'messageDeleted' ? false : undefined
        }));
      }
    });

      // Handle high-priority call log synchronization
      const socket = getSocket();
      if (socket) {
        socket.on('call:log_sync', (msg: any) => {
          console.log('Syncing call log from server:', msg);
          // We only update the sidebar here. The ChatWindow handles its own message history via local socket listener.
          dispatch(updateChatLastMessage({
            chatId: msg.senderId === String(user?.id) ? msg.receiverId : msg.senderId,
            message: msg.sidebarText || msg.text,
            time: msg.createdAt,
            isMine: msg.senderId === String(user?.id),
            sender: msg.sender,
            lastMessageId: msg.id,
            lastMessageSenderId: msg.senderId,
            lastMessageType: msg.messageType
          }));
        });
      }

      // Handle User Status (Online/Offline)
      if (socket) {
        socket.on('userStatus', (data: { userId: number; isOnline: boolean; lastSeen?: string }) => {
          dispatch(setUserStatus({ 
            userId: String(data.userId), 
            isOnline: data.isOnline,
            lastSeen: data.lastSeen 
          }));
        });
      }

      return () => {
        if (unsubscribe) unsubscribe();
        if (socket) socket.off('userStatus');
      };
  }, [user?.id, dispatch]);

  // Find selected user based on chatId (username) from URL
  React.useEffect(() => {
    if (chatId) {
      const chat = chats.find(c => c.username === chatId);
      if (chat) {
        setSelectedUser(chat);
      } else {
        // If not in chat list, try fetching user info
        getUserByUsernameApi(chatId).then(user => {
          setSelectedUser({
            id: user.id.toString(),
            name: user.name || user.username,
            username: user.username,
            avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
            online: user.isOnline,
            unreadCount: 0
          });
        }).catch(() => {
          setSelectedUser(undefined);
        });
      }
    } else {
      setSelectedUser(undefined);
    }
  }, [chatId, chats]);

  const isSettingsMenu = pathname === '/settings';
  const isSettingsContent = pathname === '/profile' || pathname === '/credentials';
  const isSettingsPage = isSettingsMenu || isSettingsContent;

  // Dynamic Browser Title
  const pageTitle = React.useMemo(() => {
    if (selectedUser) return `${selectedUser.name || selectedUser.username} | Folio Messenger`;
    if (pathname === '/profile') return `Profile | Folio Messenger`;
    if (pathname === '/credentials') return `Account & Security | Folio Messenger`;
    if (pathname === '/settings') return `Settings | Folio Messenger`;
    return 'Folio Messenger';
  }, [selectedUser, pathname]);

  usePageTitle(pageTitle);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - hidden on mobile when a chat or settings content is selected */}
      <div className={cn(
        "w-full lg:w-[400px] border-r flex flex-col shrink-0",
        chatId || isSettingsContent ? "hidden lg:flex" : "flex"
      )}>
        <ChatSidebar chats={chats} activeChatId={chatId} />
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 h-full relative",
        !chatId && !isSettingsContent ? "hidden lg:flex" : "flex"
      )}>
        {isSettingsPage ? (
          <div className="flex-1 overflow-y-auto p-4 lg:p-10 bg-background">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (isSettingsContent) {
                      navigate('/settings');
                    } else {
                      navigate('/');
                    }
                  }} 
                  className="lg:hidden"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">
                  {pathname === '/profile' ? 'Profile' : 
                   pathname === '/credentials' ? 'Account & Security' : 'Settings'}
                </h1>
              </div>
              
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border border-border/50 shadow-md bg-card overflow-hidden">
                  <CardContent className="p-6 lg:p-10">
                    {pathname === '/credentials' ? <CredentialsSettings /> : <ProfileSettings />}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : selectedUser ? (
          <ChatWindow 
            chat={selectedUser} 
            onStartAudioCall={(c) => startCall({ id: c.id, name: c.name, username: c.username, avatar: c.avatar })}
            onStartVideoCall={() => {}} 
            callState={callState}
            callPartner={callPartner}
            isMuted={isMuted}
            acceptCall={acceptCall}
            rejectCall={rejectCall}
            endCall={endCall}
            toggleMute={toggleMute}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-accent/5">
            <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mb-6">
               <svg viewBox="0 0 24 24" className="w-12 h-12 text-primary opacity-20" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.527 3.657 1.442 5.16L2 22l4.84-1.442A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.63 0-3.146-.483-4.42-1.313l-3.125.933.933-3.125A7.957 7.957 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z" />
               </svg>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Folio Messenger</h2>
            <p className="max-w-md">Select a conversation or start a new one to begin messaging. Your messages are end-to-end encrypted.</p>
          </div>
        )}
      </div>

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

function App() {
  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <AuthPage initialIsLogin={true} />
            </PublicRoute>
          } 
        />
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <AuthPage initialIsLogin={false} />
            </PublicRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/messages/:chatId" 
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/credentials" 
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <ChatLayout />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
