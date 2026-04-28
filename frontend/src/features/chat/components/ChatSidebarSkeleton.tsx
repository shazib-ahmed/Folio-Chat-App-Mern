import React from 'react';
import { Skeleton } from "@/shared/ui/skeleton";

export function ChatSidebarSkeleton() {
  return (
    <div className="w-full h-full flex flex-col border-r bg-[hsl(var(--sidebar-bg))]">
      {/* Header Skeleton */}
      <div className="h-[60px] px-4 flex items-center justify-between shrink-0 border-b">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Search Skeleton */}
      <div className="p-2">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      {/* Chat List Skeletons */}
      <div className="flex-1 px-2 space-y-4 py-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-3 w-full max-w-[180px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
