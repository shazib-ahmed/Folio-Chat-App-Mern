import React from 'react';
import { cn } from "@/shared/lib/utils";
import { Message } from "../types";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble, faFilePdf, faFileLines, faDownload, faPlay } from '@fortawesome/free-solid-svg-icons';

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

        {/* Attachments */}
        {message.attachment && (
          <div className="mb-2 rounded overflow-hidden max-w-[320px]">
            {message.attachment.type === 'image' && (
              <div className="rounded overflow-hidden">
                <img 
                  src={message.attachment.url} 
                  alt={message.attachment.name} 
                  className="w-full h-auto max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                />
              </div>
            )}
            {message.attachment.type === 'video' && (
              <div className="relative group cursor-pointer rounded overflow-hidden">
                <img 
                  src={message.attachment.thumbnail || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=400"} 
                  alt="Video thumbnail" 
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40">
                    <FontAwesomeIcon icon={faPlay} className="text-white text-sm ml-0.5" />
                  </div>
                </div>
              </div>
            )}
            {message.attachment.type === 'file' && (
              <div className="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded border border-black/10 dark:border-white/10 group cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors min-w-[240px]">
                <div className="w-9 h-9 bg-primary/20 rounded flex items-center justify-center shrink-0">
                  <FontAwesomeIcon 
                    icon={message.attachment.name.toLowerCase().endsWith('.pdf') ? faFilePdf : faFileLines} 
                    className="text-primary text-lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate">{message.attachment.name}</p>
                  <p className="text-[9px] opacity-60">{message.attachment.size || '2.4 MB'}</p>
                </div>
                <FontAwesomeIcon icon={faDownload} className="text-[10px] opacity-40 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        )}

        {message.text && <p className="leading-relaxed break-words whitespace-pre-wrap">{message.text}</p>}
        <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
          <span className="text-[10px] opacity-60 font-medium">
            {message.timestamp}
          </span>
          {isMe && (
            <div className="flex items-center">
              {message.status === 'read' ? (
                <FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3 text-sky-400" />
              ) : message.status === 'delivered' ? (
                <FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3 opacity-40" />
              ) : (
                <FontAwesomeIcon icon={faCheck} className="h-3 w-3 opacity-40" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
