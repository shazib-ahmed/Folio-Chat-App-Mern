import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faMicrophoneSlash, faVolumeHigh, faVolumeXmark, faPhoneSlash } from '@fortawesome/free-solid-svg-icons';
import { Chat } from "../types";

interface AudioCallWindowProps {
  chat: Chat;
  isMinimized?: boolean;
  onClose: () => void;
}

export function AudioCallWindow({ chat, isMinimized = false, onClose }: AudioCallWindowProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isDragging || !dragRef.current) return;
      e.preventDefault();
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy
      });
    };
    const handleUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [isDragging]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMinimized) return;
    if ((e.target as HTMLElement).closest('button')) return; // Ignore buttons
    
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed z-[100] right-6 bottom-6 bg-card border border-border shadow-2xl rounded-full flex items-center p-2 gap-3 cursor-grab animate-in slide-in-from-bottom-5 fade-in duration-300"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={handlePointerDown}
      >
        <div className="relative pointer-events-none">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={chat.avatar} />
            <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-20" />
        </div>
        
        <div className="flex flex-col min-w-[80px] pointer-events-none">
          <span className="text-sm font-semibold truncate max-w-[120px] text-foreground">{chat.name}</span>
          <span className="text-xs text-primary animate-pulse">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-1 pr-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 rounded-full ${isMuted ? 'text-destructive bg-destructive/10 hover:bg-destructive/20' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          >
            <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} className="h-4 w-4" />
          </Button>
          <Button 
            variant="destructive" 
            size="icon" 
            className="h-10 w-10 rounded-full hover:scale-105 transition-transform"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <FontAwesomeIcon icon={faPhoneSlash} className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-between py-12 animate-in fade-in duration-300">
      {/* Top area */}
      <div className="flex flex-col items-center space-y-6 mt-10">
        <div className="relative">
          <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-2xl">
            <AvatarImage src={chat.avatar} />
            <AvatarFallback className="text-4xl">{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {/* Ripples effect */}
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" style={{ animationDuration: '2s' }} />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-semibold text-foreground">{chat.name}</h2>
          <p className="text-lg text-primary animate-pulse">{formatTime(duration)}</p>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center gap-8 mb-10">
        <div className="flex flex-col items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-14 w-14 rounded-full transition-all ${isSpeaker ? 'bg-primary/20 text-primary border-primary/30' : 'bg-secondary text-secondary-foreground border-border/50 hover:bg-secondary/80'}`}
            onClick={() => setIsSpeaker(!isSpeaker)}
          >
            <FontAwesomeIcon icon={isSpeaker ? faVolumeHigh : faVolumeXmark} className="h-5 w-5" />
          </Button>
          <span className="text-xs text-muted-foreground">{isSpeaker ? 'Speaker' : 'Earpiece'}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button 
            variant="destructive" 
            size="icon" 
            className="h-16 w-16 rounded-full hover:scale-105 transition-transform shadow-lg shadow-destructive/20"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faPhoneSlash} className="h-6 w-6" />
          </Button>
          <span className="text-xs text-muted-foreground">End Call</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className={`h-14 w-14 rounded-full transition-all ${isMuted ? 'bg-secondary text-secondary-foreground border-border/50' : 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30'}`}
            onClick={() => setIsMuted(!isMuted)}
          >
            <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} className="h-5 w-5" />
          </Button>
          <span className="text-xs text-muted-foreground">{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>
      </div>
    </div>
  );
}
