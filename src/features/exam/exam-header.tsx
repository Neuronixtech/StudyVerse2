import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand";
import { Avatar } from "@/components/ui/feedback";

export function ExamHeader({ title, candidate, right }: { title: string; candidate: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-800 text-white shadow-md">
      <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:px-5">
        <LogoMark className="size-8 shrink-0 sm:size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white sm:text-base">{title}</p>
          <p className="hidden truncate text-xs text-brand-100/80 sm:block">Candidate: {candidate}</p>
        </div>
        {right}
        <div className="hidden items-center gap-2 md:flex">
          <Avatar name={candidate} size="sm" className="ring-2 ring-white/30" />
        </div>
      </div>
    </header>
  );
}
