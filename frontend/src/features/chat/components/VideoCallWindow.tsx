import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone, 
  faMicrophoneSlash, 
  faVideo, 
  faVideoSlash, 
  faPhoneSlash, 
  faCameraRotate,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import { Chat } from "../types";

interface VideoCallWindowProps {
  chat: Chat;
  isMinimized?: boolean;
  onClose: () => void;
}

export function VideoCallWindow({ chat, isMinimized = false, onClose }: VideoCallWindowProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
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
    if ((e.target as HTMLElement).closest('button')) return;
    
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
        className="fixed z-[100] right-6 bottom-6 w-48 aspect-video bg-black border border-border shadow-2xl rounded-xl overflow-hidden cursor-grab animate-in slide-in-from-bottom-5 fade-in duration-300 group"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Mock Remote Video */}
        <img 
          src={`https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400`}
          className="w-full h-full object-cover opacity-80"
          alt="Video stream"
        />
        
        {/* Overlay Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex flex-col justify-between pointer-events-none">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-medium text-white/90 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {formatTime(duration)}
             </span>
          </div>
          <span className="text-xs font-semibold text-white truncate">{chat.name}</span>
        </div>

        {/* Quick Controls on Hover */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[2px]">
          <Button 
            variant="destructive" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <FontAwesomeIcon icon={faPhoneSlash} className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Remote Video (Mock) */}
      <img 
        src={`https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=1200`}
        className="absolute inset-0 w-full h-full object-cover opacity-90"
        alt="Remote Video"
      />

      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-white/20">
            <AvatarImage src={chat.avatar} />
            <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold text-white">{chat.name}</h2>
            <p className="text-sm text-white/70">{formatTime(duration)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full">
           <FontAwesomeIcon icon={faExpand} className="h-5 w-5" />
        </Button>
      </div>

      {/* Local Video (PiP) */}
      <div className="absolute top-24 right-6 w-32 md:w-48 aspect-[3/4] bg-neutral-900 rounded-2xl border-2 border-white/10 shadow-2xl overflow-hidden z-20">
        {!isVideoOff ? (
          <img 
            src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=400"
            className="w-full h-full object-cover"
            alt="Local User"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
             <FontAwesomeIcon icon={faVideoSlash} className="h-8 w-8 text-neutral-600" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded text-[10px] text-white/80">
          You
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6 z-10">
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className={`h-14 w-14 rounded-full border-white/10 transition-all ${isMuted ? 'bg-destructive/20 text-destructive border-destructive/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={() => setIsMuted(!isMuted)}
            >
              <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Mute</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className={`h-14 w-14 rounded-full border-white/10 transition-all ${isVideoOff ? 'bg-destructive/20 text-destructive border-destructive/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              <FontAwesomeIcon icon={isVideoOff ? faVideoSlash : faVideo} className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Video</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="destructive" 
              size="icon" 
              className="h-16 w-16 rounded-full hover:scale-105 transition-transform shadow-xl shadow-destructive/20"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faPhoneSlash} className="h-6 w-6" />
            </Button>
            <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">End</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-14 w-14 rounded-full border-white/10 bg-white/10 text-white hover:bg-white/20 transition-all"
            >
              <FontAwesomeIcon icon={faCameraRotate} className="h-5 w-5" />
            </Button>
            <span className="text-[10px] text-white/60 font-medium tracking-wider uppercase">Flip</span>
          </div>
        </div>
      </div>
    </div>
  );
}
