import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChatSidebar } from '@/features/chat/components/ChatSidebar';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { AudioCallWindow } from '@/features/chat/components/AudioCallWindow';
import { VideoCallWindow } from '@/features/chat/components/VideoCallWindow';
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
import { fetchChatList, updateChatLastMessage, setTypingStatus, setUserStatus } from '@/features/chat/chatSlice';
import { getUserByUsernameApi } from '@/features/chat/chatService';

function ChatLayout() {
  const { chatId } = useParams<{ chatId: string }>(); // This is now a username
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { chats } = useSelector((state: RootState) => state.chat);
  const [activeAudioCall, setActiveAudioCall] = React.useState<Chat | null>(null);
  const [activeVideoCall, setActiveVideoCall] = React.useState<Chat | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<Chat | undefined>(undefined);
  
  React.useEffect(() => {
    if (user?.id) {
      initiateSocketConnection(user.id);
    }
    return () => {
      disconnectSocket();
    };
  }, [user?.id]);

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
          dispatch(updateChatLastMessage({
            chatId: String(sidebarChatId),
            message: msg.sidebarText || msg.text || '',
            time: msg.timestamp,
            isMine: isMine
          }));
        }
      }
    });

      // Handle User Status (Online/Offline)
      const socket = getSocket();
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
            avatar: user.avatar || '',
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
            onStartAudioCall={setActiveAudioCall}
            onStartVideoCall={setActiveVideoCall}
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

      {activeAudioCall && (
        <AudioCallWindow 
          chat={activeAudioCall} 
          onClose={() => setActiveAudioCall(null)} 
        />
      )}
      {activeVideoCall && (
        <VideoCallWindow 
          chat={activeVideoCall} 
          onClose={() => setActiveVideoCall(null)} 
        />
      )}
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
