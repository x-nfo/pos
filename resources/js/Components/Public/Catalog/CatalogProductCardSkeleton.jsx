import React from "react";

export default function CatalogProductCardSkeleton() {
    return (
        <div className="flex flex-col h-full animate-pulse select-none" aria-hidden="true">
            {/* Image Skeleton with Editorial 2:3 Aspect Ratio */}
            <div className="w-full aspect-[2/3] bg-stone-200/80 dark:bg-slate-800/80 mb-3.5 rounded-none" />

            {/* Content Skeleton */}
            <div className="space-y-2 mt-1">
                {/* Category hint */}
                <div className="h-2.5 w-1/4 bg-stone-200/90 dark:bg-slate-800 rounded-xs" />
                {/* Title */}
                <div className="h-4 w-5/6 bg-stone-200/90 dark:bg-slate-800 rounded-xs" />
                {/* Price */}
                <div className="h-3.5 w-1/2 bg-stone-200/90 dark:bg-slate-800 rounded-xs pt-1" />
            </div>
        </div>
    );
}

