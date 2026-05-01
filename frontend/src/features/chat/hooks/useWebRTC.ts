import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/shared/lib/socket';

export type CallState = 'IDLE' | 'OFFERING' | 'RINGING' | 'CONNECTED' | 'REJECTED' | 'ENDED';

interface UseWebRTCProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onIncomingCall?: (data: { from: string; fromName: string; fromAvatar?: string }) => void;
  onCallAccepted?: () => void;
  onCallEnded?: () => void;
  onLogCall?: (type: 'MISSED' | 'REJECTED' | 'ENDED' | 'NO_ANSWER', duration?: number, logId?: string, isOwner?: boolean) => void;
}

export const useWebRTC = ({ currentUserId, currentUserName, currentUserAvatar, onIncomingCall, onCallAccepted, onCallEnded, onLogCall }: UseWebRTCProps) => {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const callStateRef = useRef<CallState>('IDLE');

  const updateCallState = (state: CallState) => {
    setCallState(state);
    callStateRef.current = state;
  };

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [partner, setPartner] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const isCallerRef = useRef(false);
  
  // Timers and Duration
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  // Audio Tones
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const callingToneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Calling tone (outgoing)
    const calling = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'); 
    calling.loop = true;
    callingToneRef.current = calling;

    // Ringtone (incoming)
    const ring = new Audio('https://assets.mixkit.co/active_storage/sfx/1350/1350-preview.mp3'); 
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

  const startCall = async (targetUser: { id: string; name: string; avatar?: string }) => {
    try {
      cleanup();
      isCallerRef.current = true;
      setPartner(targetUser);
      updateCallState('OFFERING');
      callingToneRef.current?.play().catch(e => console.log('Audio play failed:', e));

      // 45s timeout for missed call
      ringTimeoutRef.current = setTimeout(() => {
        if ((callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING') && isCallerRef.current) {
          const logId = `log-${Date.now()}`;
          getSocket()?.emit('call:end', {
            to: Number(targetUser.id),
            from: Number(currentUserId),
            logId,
            reason: 'timeout'
          });
          onLogCall?.('NO_ANSWER', undefined, logId, true);
          cleanup();
          onCallEnded?.();
        }
      }, 45000);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        fromAvatar: currentUserAvatar,
        offer,
        type: 'audio',
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
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      // BOTH parties now log the call locally for instant feedback
      if (isCallerRef.current) {
        if (callStateRef.current === 'CONNECTED' && duration !== undefined) {
          onLogCall?.('ENDED', duration, logId, true);
        } else if (callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING') {
          onLogCall?.('MISSED', undefined, logId, true);
        }
      } else {
        // If receiver ends a connected call
        if (callStateRef.current === 'CONNECTED' && duration !== undefined) {
          onLogCall?.('ENDED', duration, logId, false);
        }
      }
    }
    cleanup();
    onCallEnded?.();
  };

  const rejectCall = () => {
    if (partner) {
      const logId = `log-${Date.now()}`;
      getSocket()?.emit('call:reject', {
        to: Number(partner.id),
        from: Number(currentUserId),
        logId
      });
      // Receiver logs the rejection optimistically, but NOT as owner (caller notified via socket will own it)
      onLogCall?.('REJECTED', undefined, logId, false);
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
    const socket = getSocket();
    if (!socket) return;

    socket.on('call:request', (data) => {
      isCallerRef.current = false;
      setPartner({ id: data.from.toString(), name: data.fromName, avatar: data.fromAvatar });
      pendingOfferRef.current = data.offer;
      updateCallState('RINGING');
      ringtoneRef.current?.play().catch(e => console.log('Audio play failed:', e));
      onIncomingCall?.(data);

      // Recipient side timeout also (45s)
      ringTimeoutRef.current = setTimeout(() => {
        cleanup();
      }, 45000);
    });

    socket.on('call:answer', async (data) => {
      if (pcRef.current) {
        stopTones();
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        startTimeRef.current = Date.now();
        updateCallState('CONNECTED');
        onCallAccepted?.();
      }
    });

    socket.on('call:ice-candidate', async (data) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('call:reject', (data) => {
      // Caller logs the rejection when notified by receiver
      if (isCallerRef.current && (callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING')) {
        onLogCall?.('REJECTED', undefined, data.logId, true);
      }
      cleanup();
    });

    socket.on('call:end', (data) => {
      // If call was connected, both sides should have a duration
      const duration = data.duration || (startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0);
      
      // Fix: Both sides should log for instant feedback
      if (callStateRef.current === 'CONNECTED' || callStateRef.current === 'OFFERING' || callStateRef.current === 'RINGING') {
        const type = (callStateRef.current === 'CONNECTED') ? 'ENDED' : (data.reason === 'timeout' ? 'NO_ANSWER' : 'MISSED');
        onLogCall?.(type, duration, data.logId, isCallerRef.current);
      }
      
      cleanup();
      onCallEnded?.();
    });

    return () => {
      socket.off('call:request');
      socket.off('call:answer');
      socket.off('call:ice-candidate');
      socket.off('call:reject');
      socket.off('call:end');
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
  };
};
