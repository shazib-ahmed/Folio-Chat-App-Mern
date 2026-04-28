import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { searchUsersApi } from '../chatService';
import { Skeleton } from "@/shared/ui/skeleton";
import { selectChat } from '../chatSlice';

interface ChatSidebarProps {
  chats: Chat[];
  activeChatId?: string;
}


export function ChatSidebar({ chats, activeChatId }: ChatSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { isLoading: isInitialLoading } = useSelector((state: RootState) => state.chat);
  
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const isSettingsPath = ['/profile', '/credentials', '/settings'].includes(location.pathname);
  const [view, setView] = React.useState<'chats' | 'settings'>(isSettingsPath ? 'settings' : 'chats');

  React.useEffect(() => {
    if (isSettingsPath) {
      setView('settings');
    } else {
      setView('chats');
    }
  }, [location.pathname, isSettingsPath]);

  React.useEffect(() => {
    const controller = new AbortController();
    
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const results = await searchUsersApi(searchQuery, controller.signal);
          setSearchResults(results);
        } catch (err: any) {
          if (err.name === 'CanceledError' || err.name === 'AbortError') {
            // Ignore intentional cancellations
            return;
          }
          console.error('Search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [searchQuery]);

  const handleChatSelect = (id: string, chat?: Chat) => {
    if (chat) {
      dispatch(selectChat(chat));
    }
    navigate(`/messages/${id}`);
    setSearchQuery("");
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
  ];

  const renderSkeletons = () => (
    <div className="flex flex-col p-2 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[140px]" />
            <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col border-r bg-[hsl(var(--sidebar-bg))] text-foreground">
      {/* Header */}
      <div className="h-[60px] bg-[hsl(var(--sidebar-header-bg))] px-4 flex items-center justify-between shrink-0">
        <Avatar className="h-10 w-10 border border-primary/20">
          <AvatarImage src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`} />
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
                navigate('/settings');
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
                  <FontAwesomeIcon icon={faSearch} className={cn("h-3.5 w-3.5 text-muted-foreground transition-colors", isSearching ? "text-primary animate-pulse" : "group-focus-within:text-primary")} />
                </div>
                <Input 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground text-sm h-9"
                />
              </div>
            </div>
            
            {searchQuery.trim() ? (
              <div className="flex flex-col">
                <div className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isSearching ? 'Searching...' : 'Search Results'}
                </div>
                {isSearching ? (
                  renderSkeletons()
                ) : searchResults.length > 0 ? (
                  searchResults.map(result => (
                    <div
                      key={result.id}
                      onClick={() => handleChatSelect(result.username, {
                        id: result.username,
                        name: result.name || result.username,
                        username: result.username,
                        avatar: result.avatar,
                        online: result.isOnline,
                        lastMessage: '',
                        lastMessageTime: '',
                      })}
                      className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-accent group"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={result.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.username}`} />
                        <AvatarFallback>{result.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-semibold text-sm truncate">{result.name || result.username}</h4>
                        <p className="text-xs text-muted-foreground truncate">@{result.username}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found
                  </div>
                )}
              </div>
            ) : isInitialLoading ? (
              renderSkeletons()
            ) : (
              chats.map(chat => (
                <ChatListItem 
                  key={chat.id} 
                  chat={chat} 
                  isActive={activeChatId === chat.id}
                  onClick={() => handleChatSelect(chat.id)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col p-2 space-y-1">
            <h3 className="px-3 py-2 text-lg font-semibold mb-2">Settings</h3>
            {settingsOptions.map(option => {
              const isActive = location.pathname === option.path;
              return (
                <button
                  key={option.id}
                  onClick={() => navigate(option.path)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-lg transition-colors text-left group",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  )}>
                    <FontAwesomeIcon icon={option.icon} />
                  </div>
                  <span className="font-medium">{option.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
