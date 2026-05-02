import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/shared/lib/socket';

export type CallState = 'IDLE' | 'OFFERING' | 'RINGING' | 'CONNECTED' | 'REJECTED' | 'ENDED' | 'BUSY';

interface UseWebRTCProps {
  currentUserId: string;
  currentUserName: string;
  currentUserUsername: string;
  currentUserAvatar?: string;
  onIncomingCall?: (data: { from: string; fromName: string; fromUsername: string; fromAvatar?: string }) => void;
  onCallAccepted?: () => void;
  onCallEnded?: () => void;
  onLogCall?: (type: 'MISSED' | 'REJECTED' | 'ENDED' | 'NO_ANSWER' | 'BUSY', duration?: number, logId?: string, isOwner?: boolean, partnerId?: string, partnerName?: string, partnerUsername?: string) => void;
}

export const useWebRTC = ({ currentUserId, currentUserName, currentUserUsername, currentUserAvatar, onIncomingCall, onCallAccepted, onCallEnded, onLogCall }: UseWebRTCProps) => {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const callStateRef = useRef<CallState>('IDLE');

  const updateCallState = (state: CallState) => {
    setCallState(state);
    callStateRef.current = state;
  };

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [partner, setPartner] = useState<{ id: string; name: string; username: string; avatar?: string } | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const callTypeRef = useRef<'audio' | 'video'>('audio');
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const isCallerRef = useRef(false);
  const partnerRef = useRef<{ id: string; name: string; username: string; avatar?: string } | null>(null);
  
  // Timers and Duration
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  // Audio Tones
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const callingToneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Calling tone (outgoing)
    const calling = new Audio('https://assets.mixkit.co/active_storage/sfx/1351/1351-preview.mp3'); 
    calling.loop = true;
    callingToneRef.current = calling;

    // Ringtone (incoming)
    const ring = new Audio('/reciever_rington.mp3'); 
    ring.loop = true;
    ringtoneRef.current = ring;

    return () => {
      calling.pause();
      ring.pause();
    };
  }, []);

  const stopTones = useCallback(() => {
    callingToneRef.current?.pause();
    if (callingToneRef.current) callingToneRef.current.currentTime = 0;
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
  }, []);

  const cleanup = useCallback(() => {
    stopTones();
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    updateCallState('IDLE');
    setPartner(null);
    setIsMuted(false);
    pendingOfferRef.current = null;
    startTimeRef.current = null;
  }, [stopTones]);

  const createPeerConnection = useCallback((targetUserId: string) => {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('call:ice-candidate', {
          to: Number(targetUserId),
          from: Number(currentUserId),
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanup();
        onCallEnded?.();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [currentUserId, cleanup, onCallEnded]);

  const updateCallType = (type: 'audio' | 'video') => {
    setCallType(type);
    callTypeRef.current = type;
  };

  const startCall = async (targetUser: { id: string; name: string; username: string; avatar?: string }, type: 'audio' | 'video' = 'audio') => {
    try {
      cleanup();
      isCallerRef.current = true;
      setPartner(targetUser);
      partnerRef.current = targetUser;
      updateCallType(type);
      updateCallState('OFFERING');
      callingToneRef.current?.play().catch(e => {});

      // 45s timeout for missed call
      ringTimeoutRef.current = setTimeout(() => {
        if ((callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING') && isCallerRef.current) {
          const logId = `log-${Date.now()}`;
          const currentPartner = partnerRef.current || targetUser;
          getSocket()?.emit('call:end', {
            to: Number(currentPartner.id),
            from: Number(currentUserId),
            logId,
            reason: 'timeout'
          });
          onLogCall?.('NO_ANSWER', undefined, logId, true, currentPartner.id, currentPartner.name, currentPartner.username);
          cleanup();
          onCallEnded?.();
        }
      }, 45000);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: type === 'video' 
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      getSocket()?.emit('call:request', {
        to: Number(targetUser.id),
        from: Number(currentUserId),
        fromName: currentUserName, 
        fromUsername: currentUserUsername,
        fromAvatar: currentUserAvatar,
        offer,
        type: type,
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      cleanup();
    }
  };

  const acceptCall = async () => {
    if (!partner || !pendingOfferRef.current) return;
    try {
      stopTones();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: callTypeRef.current === 'video' 
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(partner.id);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      getSocket()?.emit('call:answer', {
        to: Number(partner.id),
        from: Number(currentUserId),
        answer,
      });

      startTimeRef.current = Date.now();
      updateCallState('CONNECTED');
      onCallAccepted?.();
    } catch (err) {
      console.error('Failed to accept call:', err);
      cleanup();
    }
  };

  const endCall = () => {
    if (partner) {
      const duration = (callStateRef.current === 'CONNECTED' && startTimeRef.current) 
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : undefined;
      
      const logId = `log-${Date.now()}`;

      getSocket()?.emit('call:end', {
        to: Number(partner.id),
        from: Number(currentUserId),
        duration,
        logId
      });

      const logCall = (type: 'MISSED' | 'REJECTED' | 'ENDED' | 'NO_ANSWER' | 'BUSY', duration?: number) => {
        const currentPartner = partnerRef.current;
        if (isCallerRef.current && currentPartner) {
          onLogCall?.(type, duration, logId, true, currentPartner.id, currentPartner.name, currentPartner.username);
        }
      };

      if (callStateRef.current === 'CONNECTED' || callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING' || callStateRef.current === 'BUSY') {
        const durationVal = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : undefined;
        
        if (callStateRef.current === 'CONNECTED' && durationVal !== undefined) {
          logCall('ENDED', durationVal);
        } else if (callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING') {
          logCall('MISSED');
        }
      }
    }
    cleanup();
    onCallEnded?.();
  };

  const rejectCall = () => {
    if (partnerRef.current) {
      const logId = `log-${Date.now()}`;
      getSocket()?.emit('call:reject', {
        to: Number(partnerRef.current.id),
        from: Number(currentUserId),
        logId
      });
      if (isCallerRef.current && partnerRef.current) {
        const p = partnerRef.current;
        onLogCall?.('REJECTED', undefined, logId, true, p.id, p.name, p.username);
      }
    }
    cleanup();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  useEffect(() => {
    let socket = getSocket();
    
    // If socket isn't ready yet, try again in a bit
    const checkInterval = setInterval(() => {
      if (!socket) {
        socket = getSocket();
        if (socket) {
          attachListeners(socket);
          clearInterval(checkInterval);
        }
      }
    }, 500);

    const attachListeners = (s: any) => {
      s.on('call:busy', (data: any) => {
        // Update state to BUSY so UI can show the message
        updateCallState('BUSY');
        // Stop tones
        stopTones();
        // Auto-close busy state after 3 seconds
        setTimeout(() => {
          if (callStateRef.current === 'BUSY') {
            cleanup();
          }
        }, 3000);
      });

      s.on('call:missed_busy', (data: any) => {
        // Fallback UI update - the backend handles the DB save, 
        // this ensures the sidebar updates even during a call.
        // No need to call onLogCall as backend already saved it, 
        // but we could trigger a local refresh if needed.
      });

      s.on('call:request', (data: any) => {
        isCallerRef.current = false;
        const p = { id: data.from.toString(), name: data.fromName, username: data.fromUsername, avatar: data.fromAvatar };
        setPartner(p);
        partnerRef.current = p;
        updateCallType(data.type || 'audio');
        pendingOfferRef.current = data.offer;
        updateCallState('RINGING');
      ringtoneRef.current?.play().catch(e => {});
        onIncomingCall?.(data);

        ringTimeoutRef.current = setTimeout(() => {
          cleanup();
        }, 45000);
      });

      s.on('call:answer', async (data: any) => {
        if (pcRef.current) {
          stopTones();
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          startTimeRef.current = Date.now();
          updateCallState('CONNECTED');
          onCallAccepted?.();
        }
      });

      s.on('call:ice-candidate', async (data: any) => {
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      });

      s.on('call:reject', (data: any) => {
        const p = partnerRef.current;
        if (isCallerRef.current && p && (callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING')) {
          onLogCall?.('REJECTED', undefined, data.logId, true, p.id, p.name, p.username);
        }
        cleanup();
      });

      s.on('call:end', (data: any) => {
        const duration = data.duration || (startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0);
        const p = partnerRef.current;
        if (isCallerRef.current && p && (callStateRef.current === 'CONNECTED' || callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING')) {
          const type = (callStateRef.current === 'CONNECTED') ? 'ENDED' : (data.reason === 'timeout' ? 'NO_ANSWER' : 'MISSED');
          onLogCall?.(type, duration, data.logId, true, p.id, p.name, p.username);
        }
        cleanup();
        onCallEnded?.();
      });
    };

    if (socket) {
      attachListeners(socket);
      clearInterval(checkInterval);
    }

    return () => {
      clearInterval(checkInterval);
      if (socket) {
        socket.off('call:busy');
        socket.off('call:missed_busy');
        socket.off('call:request');
        socket.off('call:answer');
        socket.off('call:ice-candidate');
        socket.off('call:reject');
        socket.off('call:end');
      }
    };
  }, [currentUserId, createPeerConnection, cleanup, stopTones, onIncomingCall, onCallAccepted, onCallEnded, onLogCall, callState]);

  return {
    callState,
    localStream,
    remoteStream,
    isMuted,
    partner,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    callType,
  };
};
