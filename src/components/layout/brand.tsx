import { cn } from "@/lib/utils";
export function SignalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={cn("size-7", className)}>
      <path
        d="M3 18.5v-9M8.5 22v-16M14 25V3M19.5 22v-16M25 18.5v-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function SignalWordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <SignalMark className="text-signal" />
      <span className="text-[25px] font-semibold tracking-[-1.3px]">
        signal<span className="text-signal">.</span>
      </span>
    </span>
  );
}
