import React from 'react';
import { cn } from "@/shared/lib/utils";
import { Message } from "../types";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckDouble, faFileLines, faDownload, faClock } from '@fortawesome/free-solid-svg-icons';

interface MessageBubbleProps {
  message: Message;
  isMe?: boolean;
}

export function MessageBubble({ message, isMe }: MessageBubbleProps) {
  return (
    <div className={cn(
      "flex w-full mb-2",
      isMe ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[85%] px-3 py-2 rounded-lg text-sm relative shadow-sm",
        isMe 
          ? "bg-[hsl(var(--bubble-me))] text-primary-foreground rounded-tr-none ml-6" 
          : "bg-[hsl(var(--bubble-other))] text-foreground rounded-tl-none mr-6 border border-border/40"
      )}>
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

        {/* Media Attachments */}
        {message.messageType === 'IMAGE' && (
          <div className="mb-2 rounded overflow-hidden max-w-[320px]">
            <img 
              src={message.fileUrl || message.text} 
              alt="Sent" 
              className="w-full h-auto max-h-[400px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => window.open(message.fileUrl || message.text, '_blank')}
            />
          </div>
        )}

        {message.messageType === 'VIDEO' && (
          <div className="mb-2 rounded overflow-hidden max-w-[320px]">
            <video 
              src={message.fileUrl || message.text} 
              controls 
              className="w-full aspect-video rounded"
            />
          </div>
        )}

        {message.messageType === 'AUDIO' && (
          <div className="mb-2 min-w-[240px]">
            <audio 
              src={message.fileUrl || message.text} 
              controls 
              className="w-full h-8"
            />
          </div>
        )}

        {message.messageType === 'FILE' && (
          <div className="mb-2 min-w-[240px]">
            <a 
              href={message.fileUrl || message.text} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10 group hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <div className="w-9 h-9 bg-primary/20 rounded flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faFileLines} className="text-primary text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate">{message.fileName || 'Attachment'}</p>
                <p className="text-[9px] opacity-60">{message.fileSize || 'Click to view/download'}</p>
              </div>
              <FontAwesomeIcon icon={faDownload} className="text-[10px] opacity-40 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        )}

        {/* Message Text / Caption */}
        {((message.messageType === 'TEXT') || (message.fileUrl && message.text)) && (
          <p className="leading-relaxed break-words whitespace-pre-wrap">{message.text}</p>
        )}
        <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
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
      </div>
    </div>
  );
}
