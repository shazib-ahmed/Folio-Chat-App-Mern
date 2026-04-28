import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '@/features/auth/authSlice';
import { logoutApi } from '@/features/auth/authService';
import { RootState } from '@/app/store';
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faRightFromBracket, faGear, faUser, faShieldHalved, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { ChatListItem } from "./ChatListItem";
import { Chat } from "../types";
import { ThemeSwitcher } from "@/shared/components/ThemeSwitcher";

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId?: string;
}

export function ChatSidebar({ chats, activeChatId }: ChatSidebarProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [view, setView] = React.useState<'chats' | 'settings'>('chats');

  const handleChatSelect = (id: string) => {
    navigate(`/messages/${id}`);
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      dispatch(logout());
      navigate('/auth');
    }
  };

  const settingsOptions = [
    { id: 'profile', name: 'Profile', icon: faUser, path: '/profile' },
    { id: 'credentials', name: 'Credentials', icon: faShieldHalved, path: '/credentials' },
    { id: 'settings', name: 'Settings', icon: faGear, path: '/settings' },
  ];

  return (
    <div className="w-full h-full flex flex-col border-r bg-[hsl(var(--sidebar-bg))] text-foreground">
      {/* Header */}
      <div className="h-[60px] bg-[hsl(var(--sidebar-header-bg))] px-4 flex items-center justify-between shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`} />
          <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || 'US'}</AvatarFallback>
        </Avatar>
        <div className="flex gap-2 items-center text-muted-foreground">
          <ThemeSwitcher />
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("text-muted-foreground hover:text-foreground transition-colors", view === 'settings' && "text-primary")}
            onClick={() => {
              if (view === 'settings') {
                setView('chats');
                navigate('/');
              } else {
                setView('settings');
              }
            }}
          >
             <FontAwesomeIcon icon={view === 'chats' ? faGear : faArrowLeft} className="h-5 w-5 cursor-pointer" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="h-5 w-5 cursor-pointer" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1">
        {view === 'chats' ? (
          <div className="flex flex-col">
            {/* Search */}
            <div className="p-2 shrink-0">
              <div className="relative flex items-center bg-[hsl(var(--sidebar-header-bg))] rounded-lg overflow-hidden group border">
                <div className="pl-3 pointer-events-none">
                  <FontAwesomeIcon icon={faSearch} className="h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary" />
                </div>
                <Input 
                  placeholder="Search or start new chat" 
                  className="border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground text-sm h-9"
                />
              </div>
            </div>
            
            {chats.map(chat => (
              <ChatListItem 
                key={chat.id} 
                chat={chat} 
                isActive={activeChatId === chat.id}
                onClick={() => handleChatSelect(chat.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col p-2 space-y-1">
            <h3 className="px-3 py-2 text-lg font-semibold mb-2">Settings</h3>
            {settingsOptions.map(option => (
              <button
                key={option.id}
                onClick={() => navigate(option.path)}
                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <FontAwesomeIcon icon={option.icon} />
                </div>
                <span className="font-medium">{option.name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
