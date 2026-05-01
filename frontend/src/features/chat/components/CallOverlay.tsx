import React, { useState, useEffect } from 'react';
import { cn } from "@/shared/lib/utils";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faPhoneSlash, faMicrophone, faMicrophoneSlash, faVolumeHigh, faUser } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/shared/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';

interface CallOverlayProps {
  state: 'OFFERING' | 'RINGING' | 'CONNECTED' | 'BUSY';
  partner: { id: string; name: string; avatar?: string } | null;
  isMuted: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  state,
  partner,
  isMuted,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
}) => {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'CONNECTED') {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (state === 'OFFERING' || state === 'RINGING' || state === 'CONNECTED' || state === 'BUSY') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-sm p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          
          {/* Pulsing Avatar Area */}
          <div className="relative mb-8">
            {(state === 'OFFERING' || state === 'RINGING') && (
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            )}
            <Avatar className="h-32 w-32 border-4 border-background shadow-2xl relative z-10">
              <AvatarImage src={partner?.avatar} />
              <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                {partner?.name?.substring(0, 2).toUpperCase() || <FontAwesomeIcon icon={faUser} />}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{partner?.name || "User"}</h2>
          
          <p className="text-white/90 font-semibold text-lg mb-12 drop-shadow-sm">
            {state === 'OFFERING' && "Calling..."}
            {state === 'RINGING' && "Incoming Audio Call"}
            {state === 'BUSY' && (
               <span className="text-red-500 font-bold uppercase tracking-widest text-xl drop-shadow-md">
                 Busy in another call
               </span>
            )}
            {state === 'CONNECTED' && (
              <span className="flex flex-col gap-2">
                <span className="text-primary font-bold tracking-widest text-3xl drop-shadow-md">{formatTimer(timer)}</span>
                <span className="text-sm text-white/60 font-medium">Ongoing Call</span>
              </span>
            )}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-6">
            {state === 'RINGING' ? (
              <>
                <Button 
                  onClick={onReject}
                  variant="destructive"
                  size="icon"
                  className="h-16 w-16 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <FontAwesomeIcon icon={faPhoneSlash} className="h-6 w-6" />
                </Button>
                <Button 
                  onClick={onAccept}
                  className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:scale-110 transition-transform"
                >
                  <FontAwesomeIcon icon={faPhone} className="h-6 w-6" />
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={onToggleMute}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-14 w-14 rounded-full border border-white/20 text-white hover:bg-white/10 transition-all",
                    isMuted && "bg-white/20 border-white/40"
                  )}
                >
                  <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} className="h-5 w-5" />
                </Button>
                
                <Button 
                  onClick={onEnd}
                  variant="destructive"
                  size="icon"
                  className="h-16 w-16 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <FontAwesomeIcon icon={faPhoneSlash} className="h-6 w-6" />
                </Button>

                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 rounded-full border border-white/20 text-white hover:bg-white/10"
                >
                  <FontAwesomeIcon icon={faVolumeHigh} className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Audio Elements (Invisible) */}
        <audio id="remoteAudio" autoPlay playsInline />
      </div>
    );
  }

  return null;
};
