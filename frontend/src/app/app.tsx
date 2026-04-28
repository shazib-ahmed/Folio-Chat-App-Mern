import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useLocation } from 'react-router-dom';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

const MOCK_CHATS: Chat[] = [
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elon',
    lastMessage: 'Hey, did you see the new rocket launch?',
    lastMessageTime: '12:45 PM',
    unreadCount: 2,
    online: true,
  },
  {
    id: 'jeff-bezos',
    name: 'Jeff Bezos',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jeff',
    lastMessage: 'Amazon is going to the moon soon.',
    lastMessageTime: 'Yesterday',
    online: false,
  },
  {
    id: 'mark-zuckerberg',
    name: 'Mark Zuckerberg',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mark',
    lastMessage: 'Let\'s talk about the Metaverse.',
    lastMessageTime: 'Monday',
    unreadCount: 0,
    online: true,
  },
];

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
  const { chatId } = useParams<{ chatId: string }>();
  const { pathname } = useLocation();
  const [activeAudioCall, setActiveAudioCall] = React.useState<Chat | null>(null);
  const [activeVideoCall, setActiveVideoCall] = React.useState<Chat | null>(null);
  
  const activeChat = MOCK_CHATS.find(c => c.id === chatId);
  
  const isSettingsRoute = ['/profile', '/credentials', '/settings'].includes(pathname);

  const getPageTitle = () => {
    if (activeChat) return `${activeChat.name} | Folio Chat`;
    if (pathname === '/profile') return "Profile | Folio Chat";
    if (pathname === '/credentials') return "Credentials | Folio Chat";
    if (pathname === '/settings') return "Settings | Folio Chat";
    return "Folio | Chat Platform";
  };

  usePageTitle(getPageTitle());

  // For demo purposes, we only show messages for Elon
  const messages = chatId === 'elon-musk' ? MOCK_MESSAGES : [];

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <div className={cn(
        "h-full border-r bg-[hsl(var(--sidebar-bg))] transition-all duration-300",
        (chatId || isSettingsRoute) ? "hidden lg:block lg:w-[400px]" : "w-full lg:w-[400px]"
      )}>
        <ChatSidebar 
          chats={MOCK_CHATS} 
          activeChatId={chatId} 
        />
      </div>
      <div className={cn(
        "flex-1 h-full transition-all duration-300",
        (chatId || isSettingsRoute) ? "block w-full" : "hidden lg:block"
      )}>
        {isSettingsRoute ? (
           <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[hsl(var(--chat-bg))] relative overflow-hidden">
              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none bg-repeat"
                style={{ backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')` }}
              />
              <Card className="w-full max-w-2xl border-border/40 shadow-xl bg-card/50 backdrop-blur-sm relative z-10">
                <CardHeader>
                  <CardTitle className="text-2xl capitalize">{pathname.replace('/', '')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {pathname === '/profile' && <ProfileSettings />}
                  {pathname === '/credentials' && <CredentialsSettings />}
                  {pathname === '/settings' && (
                    <div className="py-12 text-center space-y-4">
                      <div className="text-4xl">🚀</div>
                      <h3 className="text-xl font-semibold">Coming Soon</h3>
                      <p className="text-muted-foreground max-w-xs mx-auto text-sm">We are working hard to bring you more advanced customization options. Stay tuned!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
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
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ChatLayout />} />
        <Route path="/messages/:chatId" element={<ChatLayout />} />
        <Route path="/profile" element={<ChatLayout />} />
        <Route path="/credentials" element={<ChatLayout />} />
        <Route path="/settings" element={<ChatLayout />} />
      </Routes>
    </Router>
  );
}

export default App;
