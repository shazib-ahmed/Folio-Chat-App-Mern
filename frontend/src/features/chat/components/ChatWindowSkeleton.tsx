import React from 'react';
import { Skeleton } from "@/shared/ui/skeleton";

export function ChatWindowSkeleton() {
  return (
    <div className="flex-1 h-full flex flex-col bg-[hsl(var(--chat-bg))] overflow-hidden">
      {/* Header Skeleton */}
      <div className="h-[60px] px-4 flex items-center justify-between shrink-0 border-b bg-[hsl(var(--chat-header-bg))]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>
      </div>

      {/* Messages Skeleton */}
      <div className="flex-1 p-4 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex items-end gap-2 max-w-[70%] ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
              <div className="space-y-1">
                <Skeleton className={`h-10 w-[200px] rounded-2xl ${i % 2 === 0 ? 'rounded-bl-none' : 'rounded-br-none'}`} />
                <div className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <Skeleton className="h-2 w-8" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area Skeleton */}
      <div className="h-[62px] px-4 flex items-center gap-4 border-t bg-[hsl(var(--chat-header-bg))]">
        <div className="flex gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="flex-1 h-10 rounded-lg" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  );
}
