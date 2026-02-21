import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
  className?: string;
  labelClassName?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export function Logo({ to = "/dashboard", className = "", labelClassName = "", size = "md" }: LogoProps) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 ${className}`} aria-label="Neurax AI">
      <span className={`relative grid place-items-center rounded-2xl ${sizeMap[size]}`}>
        <span className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/25" />
        <span className="pointer-events-none absolute -inset-1 rounded-[18px] bg-primary/10 blur-sm" />
        <svg
          viewBox="0 0 120 120"
          className="relative z-10 h-8 w-8 md:h-9 md:w-9"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="neurax-surface-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--card))" />
              <stop offset="100%" stopColor="hsl(var(--muted))" />
            </linearGradient>
            <linearGradient id="neurax-n-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" />
            </linearGradient>
          </defs>
          <rect x="12" y="12" width="96" height="96" rx="22" fill="url(#neurax-surface-grad)" />
          <rect x="12.5" y="12.5" width="95" height="95" rx="21.5" fill="none" stroke="hsl(var(--border))" />
          <path d="M33 92V28h14l26 39V28h14v64H73L47 53v39H33Z" fill="url(#neurax-n-fill)" />
        </svg>
      </span>
      <span className={`text-lg md:text-xl font-semibold font-display ${labelClassName}`}>
        <span className="gradient-text">Neurax</span>{" "}
        <span className="text-foreground/90">AI</span>
      </span>
    </Link>
  );
}
