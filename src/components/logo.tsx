import { cn } from "@/lib/utils";

/**
 * Domiify mark: a rounded "file" tab shape holding a globe/meridian motif,
 * combining the domain (globe) + file (folder/document) concepts called for
 * in the spec.
 */
export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="url(#df-grad)" />
        <path
          d="M9 8.5C9 7.67157 9.67157 7 10.5 7H17L23 13V23.5C23 24.3284 22.3284 25 21.5 25H10.5C9.67157 25 9 24.3284 9 23.5V8.5Z"
          fill="white"
          fillOpacity="0.16"
        />
        <path d="M17 7L23 13H18.5C17.6716 13 17 12.3284 17 11.5V7Z" fill="white" fillOpacity="0.32" />
        <circle cx="16" cy="18" r="5.5" stroke="white" strokeWidth="1.4" />
        <path d="M10.5 18H21.5" stroke="white" strokeWidth="1.4" />
        <path d="M16 12.5C17.933 12.5 19.5 15 19.5 18C19.5 21 17.933 23.5 16 23.5C14.067 23.5 12.5 21 12.5 18C12.5 15 14.067 12.5 16 12.5Z" stroke="white" strokeWidth="1.2" />
        <defs>
          <linearGradient id="df-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#4338CA" />
          </linearGradient>
        </defs>
      </svg>
      {!iconOnly && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Domi<span className="text-brand">ify</span>
        </span>
      )}
    </div>
  );
}
