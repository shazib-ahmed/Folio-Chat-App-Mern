import React, { useState, useRef } from 'react';
import { cn } from "@/shared/lib/utils";
import { Message } from "../types";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faFileLines, faDownload, faClock, faPlay, faPause, faMicrophone, faXmark, faPen, faEllipsisVertical, faTrash, faShare } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { decryptFile, getLocalPrivateKey, decryptMessage, isEncryptedPayload } from '@/shared/lib/cryptoUtils';

import { Skeleton } from '@/shared/ui/skeleton';

interface MessageBubbleProps {
  message: Message;
  isMe?: boolean;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  otherName?: string;
  isDeleting?: boolean;
}

const VoiceMessage = React.memo(({ url, isMe }: { url: string; isMe?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          await audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (err) {
        console.error("Audio play error:", err);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      if (total) {
        setProgress((current / total) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[220px]">
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full shrink-0",
          isMe ? "text-primary-foreground hover:bg-white/10" : "text-primary hover:bg-primary/10"
        )}
      >
        <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} className="h-5 w-5" />
      </Button>
      
      <div className="flex-1 space-y-1.5">
        <div className="relative h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div 
            className={cn("absolute inset-0 rounded-full", isMe ? "bg-white" : "bg-primary")} 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] opacity-70">
          <span>{isPlaying ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}</span>
          <FontAwesomeIcon icon={faMicrophone} className="text-[11px]" />
        </div>
      </div>
    </div>
  );
});

// Helpers to hide raw encrypted JSON strings from UI
const sanitizeValue = (val?: string) => isEncryptedPayload(val) ? null : val;

export const MessageBubble = React.memo(({ message, isMe, onEdit, onDelete, onForward, otherName, isDeleting }: MessageBubbleProps) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decryptedMeta, setDecryptedMeta] = useState<{ fileName?: string; fileSize?: string }>({});
  const [lastBlobUrl, setLastBlobUrl] = useState<string | null>(null);
  
  const activeUrl = decryptedUrl || sanitizeValue(message.fileUrl) || lastBlobUrl;
  const activeFileName = decryptedMeta.fileName || sanitizeValue(message.fileName);
  const activeFileSize = decryptedMeta.fileSize || sanitizeValue(message.fileSize);
  const activeText = decryptedText || (isEncryptedPayload(message.text) ? 'Decrypting...' : message.text);

  React.useEffect(() => {
    // Preserve blob URLs for optimistic updates
    if (message.fileUrl?.startsWith('blob:')) {
      setLastBlobUrl(message.fileUrl);
    }

    let isMounted = true;
    let currentBlobUrl: string | null = null;

    const handleDecrypt = async () => {
      if (message.isEncrypted) {
        setIsDecrypting(true);
        console.log(`DEBUG: Decrypting message ${message.id}, type=${message.messageType}, isMe=${isMe}, hasFileMeta=${!!message.fileMeta}`);
        try {
          const privateKey = await getLocalPrivateKey();
          if (!privateKey || !isMounted) return;

          const isSender = isMe || false;
          let cipherText = message.text || "";
          let fileMeta = message.fileMeta;

          // 0. Handle wrapped JSON (often for files with captions or re-wrapped forwarded files)
          if (cipherText.startsWith('{')) {
            try {
              const parsed = JSON.parse(cipherText);
              if (parsed.fileMeta) {
                fileMeta = parsed.fileMeta;
                cipherText = parsed.text || "";
              }
            } catch (e) {
              // Not wrapped JSON
            }
          }

          // 1. Decrypt text if it's an encrypted payload
          if (cipherText && isEncryptedPayload(cipherText)) {
            console.log("DEBUG: Decrypting text...");
            const decrypted = await decryptMessage(cipherText, privateKey, isSender);
            console.log("DEBUG: Decrypted text:", decrypted);
            if (isMounted) setDecryptedText(decrypted);
          } else if (cipherText && isMounted) {
            setDecryptedText(cipherText);
          }

          // 2. Decrypt file if exists
          if ((message.fileUrl || fileMeta) && !message.fileUrl?.startsWith('blob:')) {
            let realFileUrl = message.fileUrl;
            let realFileName = message.fileName || "";

            console.log("DEBUG: File found, url encrypted?", isEncryptedPayload(message.fileUrl));

            // Decrypt fileUrl if it's an encrypted payload
            if (isEncryptedPayload(message.fileUrl)) {
              realFileUrl = await decryptMessage(message.fileUrl || "", privateKey, isSender);
              console.log("DEBUG: Decrypted fileUrl:", realFileUrl);
            }

            // Decrypt fileName if it's an encrypted payload
            if (message.fileName && isEncryptedPayload(message.fileName)) {
              realFileName = await decryptMessage(message.fileName, privateKey, isSender);
            }

            if (realFileUrl && !realFileUrl.startsWith('[Unable') && fileMeta && isMounted) {
              console.log("DEBUG: Fetching blob from", realFileUrl);
              const response = await fetch(realFileUrl);
              const encryptedBlob = await response.blob();
              console.log("DEBUG: Blob fetched, size:", encryptedBlob.size);
              const decrypted = await decryptFile(encryptedBlob, fileMeta, privateKey, isSender);
              console.log("DEBUG: Blob decrypted, filename:", decrypted.fileName);
              
              if (isMounted) {
                const url = window.URL.createObjectURL(decrypted.decryptedBlob);
                currentBlobUrl = url;
                setDecryptedUrl(url);
                setDecryptedMeta({ 
                  fileName: decrypted.fileName || realFileName, 
                  fileSize: decrypted.fileSize 
                });
              }
            }
          }
        } catch (err) {
          console.error("DEBUG: Decryption error:", err);
        } finally {
          if (isMounted) setIsDecrypting(false);
        }
      }
    };

    handleDecrypt();
    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        window.URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [message.id, message.fileUrl, message.fileMeta, message.text, message.fileName, message.fileSize, message.isEncrypted, message.messageType, isMe]);


  const handleDownload = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cloudinary force download trick: insert 'fl_attachment' after 'upload/'
    let downloadUrl = url;
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      // Fallback: Open modified Cloudinary URL in new tab (which forces download)
      window.open(downloadUrl, '_blank');
    }
  };
  const isWaiting = message.isEncrypted && !decryptedUrl && (!!sanitizeValue(message.fileUrl) === false || !!sanitizeValue(message.fileName) === false) && message.messageType !== 'TEXT';
  const isPending = message.status === 'pending';
  const showLoading = isDecrypting || isWaiting || isPending;

  return (
    <div className={cn(
      "flex w-full mb-2 group items-center gap-1",
      isMe ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "max-w-[85%] px-3 py-2 rounded-lg text-sm relative shadow-sm",
        isDeleting && "opacity-70 grayscale",
        message.isDeleted 
          ? (isMe ? "bg-muted/30 text-muted-foreground italic border border-muted" : "bg-muted/30 text-muted-foreground italic border border-muted")
          : (isMe 
              ? "bg-[hsl(var(--bubble-me))] text-primary-foreground rounded-tr-none" 
              : "bg-[hsl(var(--bubble-other))] text-foreground rounded-tl-none border border-border/40")
      )}>
        {/* Deleted Message Placeholder */}
        {message.isDeleted ? (
          <div className="flex items-center gap-2 py-1 min-w-[200px]">
            <FontAwesomeIcon icon={faTrash} className="h-3 w-3 opacity-40" />
            <span className="text-[11px]">
              {message.isForwarded 
                ? "Content unavailable" 
                : (isMe ? "You deleted a message" : `${otherName || 'User'} deleted a message`)}
            </span>
            {isDeleting && (
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin ml-auto" />
            )}
          </div>
        ) : (
          <>
            {isDeleting && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-[60] flex items-center justify-center rounded-lg">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {/* Triangle Tail */}
        <div className={cn(
          "absolute top-0 w-3 h-3",
          isMe 
            ? "right-[-8px] text-[hsl(var(--bubble-me))]" 
            : "left-[-8px] text-[hsl(var(--bubble-other))]"
        )}>
           <svg viewBox="0 0 8 13" preserveAspectRatio="none" className="w-full h-full fill-current">
              <path d={isMe ? "M0 0 L8 0 L0 13 Z" : "M8 0 L0 0 L8 13 Z"} />
           </svg>
        </div>

        {/* Forwarded Label */}
        {message.isForwarded && (
          <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
            <FontAwesomeIcon icon={faShare} className="text-[10px]" />
            <span className="text-[10px] italic font-medium">Forwarded</span>
          </div>
        )}

        {/* Media Attachments */}
        {message.messageType === 'IMAGE' && (
          <div className="mb-2 rounded overflow-hidden max-w-[320px] relative min-h-[100px] w-full">
            {activeUrl ? (
              <img 
                src={activeUrl} 
                alt="Sent" 
                className="w-full h-auto max-h-[400px] object-cover cursor-pointer hover:opacity-95 transition-opacity min-w-[200px]"
                onClick={() => setIsImageModalOpen(true)}
              />
            ) : showLoading ? (
              <div className="w-[240px] h-[200px] bg-black/5 dark:bg-white/5 flex flex-col items-center justify-center gap-2 relative">
                <Skeleton className="w-full h-full absolute inset-0" />
                <div className="relative z-10">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {isImageModalOpen && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={(e) => {
              e.stopPropagation();
              setIsImageModalOpen(false);
            }}
          >
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
              <img 
                src={activeUrl || undefined} 
                alt="Full view" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
              />
              <button 
                className="absolute top-[-50px] right-0 md:right-[-50px] md:top-0 text-white hover:text-primary transition-colors text-2xl p-2 h-12 w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full"
                onClick={() => setIsImageModalOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>
        )}

        {message.messageType === 'VIDEO' && (
          <div className="mb-2 rounded overflow-hidden max-w-[320px] relative">
            {activeUrl ? (
              <video 
                src={activeUrl} 
                controls 
                className="w-full aspect-video rounded"
              />
            ) : showLoading ? (
              <Skeleton className="w-full aspect-video" />
            ) : null}
          </div>
        )}

        {message.messageType === 'AUDIO' && (
          <div className="relative">
            {activeUrl ? (
              <VoiceMessage url={activeUrl} isMe={isMe} />
            ) : showLoading ? (
              <div className="flex items-center gap-3 py-1 min-w-[220px]">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-2 w-20 rounded-full" />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {message.messageType === 'FILE' && (
          <div className="mb-2 min-w-[240px]">
            <div 
              onClick={(e) => !showLoading && activeUrl && handleDownload(e, activeUrl, activeFileName || 'file')}
              className={cn(
                "flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10 group transition-colors cursor-pointer",
                (!showLoading && activeUrl) && "hover:bg-black/10 dark:hover:bg-white/10"
              )}
            >
              <div className="w-9 h-9 bg-primary/20 rounded flex items-center justify-center shrink-0">
                {showLoading && !activeUrl ? (
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <FontAwesomeIcon icon={faFileLines} className="text-primary text-lg" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate">{activeFileName || 'Attachment'}</p>
                <p className="text-[9px] opacity-60">
                  {activeFileSize || 'Click to view/download'}
                </p>
              </div>
              {!showLoading && activeUrl && (
                <FontAwesomeIcon icon={faDownload} className="text-[10px] opacity-40 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        )}

        {/* Message Text / Caption */}
        {((message.messageType === 'TEXT') || (message.fileUrl && activeText)) && (
          <p className="leading-relaxed break-words whitespace-pre-wrap">{activeText}</p>
        )}
        <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
          {message.isEdited && <span className="text-[9px] opacity-40 font-medium italic">Edited</span>}
          <span className="text-[10px] opacity-60 font-medium">
            {message.timestamp}
          </span>
          {isMe && (
            <div className="flex items-center">
              {message.status === 'pending' ? (
                <FontAwesomeIcon icon={faClock} className="h-2.5 w-2.5 opacity-40" />
              ) : message.status === 'SEEN' ? (
                <FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3 text-sky-400" />
              ) : (
                <FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3 opacity-40" />
              )}
            </div>
          )}
        </div>
      </>
    )}
      </div>

      {!message.isDeleted && onEdit && (
        <div className="flex flex-col justify-center px-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <FontAwesomeIcon icon={faEllipsisVertical} className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isMe ? "end" : "start"} className="w-32 bg-background/95 backdrop-blur-md border-border/50">
              {isMe && message.messageType === 'TEXT' && (message.createdAt && (new Date().getTime() - new Date(message.createdAt).getTime()) < 15000) && (
                <DropdownMenuItem onClick={() => onEdit(message)} className="gap-2 cursor-pointer">
                  <FontAwesomeIcon icon={faPen} className="h-3 w-3 text-primary" />
                  <span className="text-xs">Edit</span>
                </DropdownMenuItem>
              )}
              {isMe && (
                <DropdownMenuItem 
                  onClick={() => onDelete?.(message.id)} 
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                  <span className="text-xs">Delete</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onForward?.(message)} className="gap-2 cursor-pointer text-sky-500 focus:text-sky-500">
                <FontAwesomeIcon icon={faShare} className="h-3 w-3" />
                <span className="text-xs">Forward</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});
