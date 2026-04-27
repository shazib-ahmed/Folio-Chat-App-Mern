import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { ChatSidebar } from '@/features/chat/components/ChatSidebar';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { AuthPage } from '@/features/auth/pages/AuthPage';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import { Chat, Message } from '@/features/chat/types';

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
  const activeChat = MOCK_CHATS.find(c => c.id === chatId);
  
  usePageTitle(activeChat ? `${activeChat.name} | Folio Chat` : "Folio | Chat Platform");

  // For demo purposes, we only show messages for Elon
  const messages = chatId === 'elon-musk' ? MOCK_MESSAGES : [];

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      <ChatSidebar 
        chats={MOCK_CHATS} 
        activeChatId={chatId} 
      />
      <ChatWindow 
        chat={activeChat} 
        messages={messages} 
      />
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
      </Routes>
    </Router>
  );
}

export default App;
