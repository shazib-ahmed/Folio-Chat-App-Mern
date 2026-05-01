import React, { useState, useEffect } from 'react';
import { cn } from "@/shared/lib/utils";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPhone, faPhoneSlash, faMicrophone, faMicrophoneSlash, faVolumeHigh, faUser, faVideo } from '@fortawesome/free-solid-svg-icons';
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
  callType: 'audio' | 'video';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  state,
  partner,
  isMuted,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  callType,
  localStream,
  remoteStream,
}) => {
  const [timer, setTimer] = useState(0);
  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (state === 'OFFERING' || state === 'RINGING' || state === 'CONNECTED' || state === 'BUSY') {
    const isVideo = callType === 'video';
    const isConnected = state === 'CONNECTED';

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-hidden">
        
        {/* Video Container (Full Screen for Remote) */}
        {isVideo && isConnected && (
          <div className="absolute inset-0 w-full h-full bg-black">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            
            {/* Local Video Preview (Small Floating) */}
            <div className="absolute top-8 right-8 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/40 z-20 transition-all hover:scale-105">
               <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover -scale-x-100" 
              />
            </div>
          </div>
        )}

        <div className={cn(
          "w-full p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300 z-10",
          isVideo && isConnected ? "absolute bottom-12" : "max-w-sm"
        )}>
          
          {/* Pulsing Avatar Area (Only if not connected video) */}
          {(!isVideo || !isConnected) && (
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
          )}

          <h2 className={cn(
            "font-bold text-white mb-2 transition-all",
            isVideo && isConnected ? "text-xl drop-shadow-lg" : "text-2xl"
          )}>
            {partner?.name || "User"}
          </h2>
          
          <p className="text-white/90 font-semibold text-lg mb-8 drop-shadow-sm">
            {state === 'OFFERING' && "Calling..."}
            {state === 'RINGING' && `Incoming ${isVideo ? 'Video' : 'Audio'} Call`}
            {state === 'BUSY' && (
               <span className="text-red-500 font-bold uppercase tracking-widest text-xl drop-shadow-md">
                 Busy in another call
               </span>
            )}
            {state === 'CONNECTED' && (
              <span className={cn("flex flex-col gap-1", isVideo && "bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm border border-white/10")}>
                <span className={cn("text-primary font-bold tracking-widest drop-shadow-md", isVideo ? "text-xl" : "text-3xl")}>
                  {formatTimer(timer)}
                </span>
                {!isVideo && <span className="text-sm text-white/60 font-medium">Ongoing Call</span>}
              </span>
            )}
          </p>

          {/* Controls */}
          <div className={cn(
            "flex items-center gap-6 p-4 rounded-full transition-all",
            isVideo && isConnected && "bg-black/40 backdrop-blur-md border border-white/10"
          )}>
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
                  <FontAwesomeIcon icon={isVideo ? faVideo : faPhone} className="h-6 w-6" />
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

        {/* Audio Elements (Invisible for Audio calls, Video tags handle it for Video calls) */}
        {!isVideo && <audio id="remoteAudio" autoPlay playsInline />}
      </div>
    );
  }

  return null;
};
