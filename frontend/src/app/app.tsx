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
import { Chat, Message } from '@/features/chat/types';
import { cn } from '@/shared/lib/utils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faGear } from '@fortawesome/free-solid-svg-icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { ProtectedRoute, PublicRoute } from '@/routes/ProtectedRoute';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/app/store';
import { fetchChatList } from '@/features/chat/chatSlice';
import { getUserByUsernameApi } from '@/features/chat/chatService';


const MOCK_MESSAGES: Message[] = [
  { id: '1', senderId: 'elon-musk', text: 'Hey, how is the project going?', timestamp: '12:30 PM', status: 'read' },
  { id: '2', senderId: 'me', text: 'It is going great! Just finished the WhatsApp UI.', timestamp: '12:31 PM', status: 'read' },
  { 
    id: '3', 
    senderId: 'elon-musk', 
    text: 'That is awesome! Can I see some of the designs?', 
    timestamp: '12:32 PM', 
    status: 'read',
    attachment: {
      type: 'image',
      url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=800',
      name: 'design_preview.png'
    }
  },
  { 
    id: '4', 
    senderId: 'me', 
    text: 'Check out this video demo of the animations.', 
    timestamp: '12:33 PM', 
    status: 'delivered',
    attachment: {
      type: 'video',
      url: '#',
      thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800',
      name: 'animation_demo.mp4'
    }
  },
  { 
    id: '5', 
    senderId: 'elon-musk', 
    text: 'Here is the project documentation.', 
    timestamp: '12:45 PM', 
    status: 'sent',
    attachment: {
      type: 'file',
      url: '#',
      name: 'project_spec.pdf',
      size: '1.2 MB'
    }
  },
];



function ChatLayout() {
  const { chatId } = useParams<{ chatId: string }>(); // This is now a username
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { chats } = useSelector((state: RootState) => state.chat);
  const [activeAudioCall, setActiveAudioCall] = React.useState<Chat | null>(null);
  const [activeVideoCall, setActiveVideoCall] = React.useState<Chat | null>(null);
  const [selectedUser, setSelectedUser] = React.useState<Chat | undefined>(undefined);
  
  React.useEffect(() => {
    dispatch(fetchChatList());
  }, [dispatch]);

  React.useEffect(() => {
    if (chatId) {
      const chatInList = chats.find(c => c.id === chatId || c.username === chatId);
      if (chatInList) {
        setSelectedUser(chatInList);
      } else {
        // Fetch user info if not in chat list (e.g. from search)
        getUserByUsernameApi(chatId).then(user => {
          if (user) {
            setSelectedUser({
              id: user.username,
              name: user.name || user.username,
              username: user.username,
              avatar: user.avatar,
              online: user.isOnline,
              lastMessage: '',
              lastMessageTime: '',
            });
          }
        }).catch(err => console.error('Failed to fetch user:', err));
      }
    } else {
      setSelectedUser(undefined);
    }
  }, [chatId, chats]);

  const activeChat = selectedUser;
  
  const isSettingsRoute = ['/profile', '/credentials', '/settings'].includes(pathname);
  const isSubSettingsRoute = ['/profile', '/credentials'].includes(pathname);

  const getPageTitle = () => {
    if (activeChat) return `${activeChat.name} | Folio Chat`;
    if (pathname === '/profile') return "Profile | Folio Chat";
    if (pathname === '/credentials') return "Credentials | Folio Chat";
    if (pathname === '/settings') return "Settings | Folio Chat";
    return "Folio | Chat Platform";
  };

  usePageTitle(getPageTitle());

  // For now, we still use mock messages or empty if no real ones
  const messages = chatId === 'elon-musk' ? MOCK_MESSAGES : [];

  const getHeaderTitle = () => {
    if (pathname === '/profile') return "Profile";
    if (pathname === '/credentials') return "Credentials";
    return "Settings";
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <div className={cn(
        "h-full border-r bg-[hsl(var(--sidebar-bg))] transition-all duration-300",
        (chatId || isSubSettingsRoute) ? "hidden lg:block lg:w-[400px]" : "w-full lg:w-[400px]"
      )}>
        <ChatSidebar 
          chats={chats} 
          activeChatId={chatId} 
        />
      </div>
      <div className={cn(
        "flex-1 h-full transition-all duration-300",
        (chatId || isSubSettingsRoute) ? "block w-full" : "hidden lg:block"
      )}>
        {isSettingsRoute ? (
           <div className="flex-1 h-full flex flex-col bg-[hsl(var(--chat-bg))] relative overflow-hidden">
              {/* Mobile/Tablet Header */}
              <div className="h-[60px] bg-[hsl(var(--chat-header-bg))] px-4 flex items-center gap-3 shrink-0 border-b lg:hidden relative z-20">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:text-foreground -ml-2"
                  onClick={() => {
                    if (isSubSettingsRoute) {
                      navigate('/settings');
                    } else {
                      navigate('/');
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5" />
                </Button>
                <h4 className="text-sm font-semibold capitalize">{getHeaderTitle()}</h4>
              </div>

              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none bg-repeat"
                style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
              />
              <ScrollArea className="flex-1 h-full w-full">
                <div className="flex flex-col items-center p-4 md:p-8 min-h-full">
                  {isSubSettingsRoute ? (
                    <Card className="w-full max-w-2xl border-border/40 shadow-xl bg-card/50 backdrop-blur-sm relative z-10 my-auto">
                      <CardHeader className="hidden lg:block">
                        <CardTitle className="text-2xl capitalize">{getHeaderTitle()}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 lg:pt-0">
                        {pathname === '/profile' && <ProfileSettings />}
                        {pathname === '/credentials' && <CredentialsSettings />}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-6 relative z-10">
                      <div className="bg-primary/10 h-32 w-32 rounded-full flex items-center justify-center text-primary">
                        <FontAwesomeIcon icon={faGear} className="h-16 w-16" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-3xl font-light text-foreground">Settings</h2>
                        <p className="text-muted-foreground max-w-xs mx-auto">Select an option from the menu to manage your account and preferences.</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
           </div>
        ) : (
          <ChatWindow 
            chat={activeChat} 
            messages={messages} 
            onStartAudioCall={(chat) => setActiveAudioCall(chat)}
            onStartVideoCall={(chat) => setActiveVideoCall(chat)}
          />
        )}
      </div>

      {activeAudioCall && (
        <AudioCallWindow 
          chat={activeAudioCall} 
          isMinimized={activeChat?.id !== activeAudioCall.id}
          onClose={() => setActiveAudioCall(null)} 
        />
      )}
      {activeVideoCall && (
        <VideoCallWindow 
          chat={activeVideoCall} 
          isMinimized={activeChat?.id !== activeVideoCall.id}
          onClose={() => setActiveVideoCall(null)} 
        />
      )}
    </div>
  );
}

function App() {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const root = window.document.documentElement;
    if (savedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route 
          path="/auth" 
          element={
            <PublicRoute>
              <AuthPage />
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
