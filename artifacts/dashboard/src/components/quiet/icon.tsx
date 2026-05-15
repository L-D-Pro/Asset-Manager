import type { SVGProps } from "react";

/**
 * Quiet Operations icon set.
 *
 * Adapted verbatim from `job-ops/project/components.jsx` (the Claude Design
 * bundle). Stroked 1.6 / 1em / currentColor. Use this instead of lucide-react
 * wherever the design specifies an icon by name — paths match the design 1:1.
 *
 * For ad-hoc icons not in this set, lucide-react is still acceptable, but pass
 * `strokeWidth={1.6}` to keep the visual weight consistent.
 */

export type IconName =
  | "home"
  | "briefcase"
  | "claim"
  | "resume"
  | "chat"
  | "spark"
  | "search"
  | "trend"
  | "trophy"
  | "flame"
  | "plus"
  | "chev-r"
  | "chev-l"
  | "chev-d"
  | "ext"
  | "check"
  | "x"
  | "settings"
  | "filter"
  | "sort"
  | "comment"
  | "dot"
  | "lock"
  | "diff"
  | "doc"
  | "calendar"
  | "arrow-r"
  | "send"
  | "command"
  | "compass"
  | "shield"
  | "users"
  | "graph"
  | "logout";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Pixel size. Defaults to 16. */
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  const baseProps: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...rest,
  };

  switch (name) {
    case "home":
      return (
        <svg {...baseProps}>
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...baseProps}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
        </svg>
      );
    case "claim":
      return (
        <svg {...baseProps}>
          <path d="M9 12l2 2 4-4" />
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
        </svg>
      );
    case "resume":
      return (
        <svg {...baseProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "chat":
      return (
        <svg {...baseProps}>
          <path d="M4 5h16v11H8l-4 4z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...baseProps}>
          <path d="M12 3v3M12 18v3M5.5 5.5l2 2M16.5 16.5l2 2M3 12h3M18 12h3M5.5 18.5l2-2M16.5 7.5l2-2" />
        </svg>
      );
    case "search":
      return (
        <svg {...baseProps}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "trend":
      return (
        <svg {...baseProps}>
          <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...baseProps}>
          <path d="M8 4h8v6a4 4 0 0 1-8 0z" />
          <path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3M10 16h4l1 4H9z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...baseProps}>
          <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4-1 4 2 4 2 2 0-2 0-4 0-7z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...baseProps}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "chev-r":
      return (
        <svg {...baseProps}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "chev-l":
      return (
        <svg {...baseProps}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case "chev-d":
      return (
        <svg {...baseProps}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "ext":
      return (
        <svg {...baseProps}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      );
    case "check":
      return (
        <svg {...baseProps}>
          <path d="M5 12l5 5 9-11" />
        </svg>
      );
    case "x":
      return (
        <svg {...baseProps}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "filter":
      return (
        <svg {...baseProps}>
          <path d="M4 5h16l-6 8v6l-4-2v-4z" />
        </svg>
      );
    case "sort":
      return (
        <svg {...baseProps}>
          <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
        </svg>
      );
    case "comment":
      return (
        <svg {...baseProps}>
          <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3z" />
        </svg>
      );
    case "dot":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      );
    case "lock":
      return (
        <svg {...baseProps}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "diff":
      return (
        <svg {...baseProps}>
          <path d="M6 3v14M6 17l-3-3 3-3M18 21V7M18 7l3 3-3 3" />
        </svg>
      );
    case "doc":
      return (
        <svg {...baseProps}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...baseProps}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "arrow-r":
      return (
        <svg {...baseProps}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "send":
      return (
        <svg {...baseProps}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      );
    case "command":
      return (
        <svg {...baseProps}>
          <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" />
        </svg>
      );
    case "compass":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-2 6-6 2 2-6z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...baseProps}>
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
        </svg>
      );
    case "users":
      return (
        <svg {...baseProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "graph":
      return (
        <svg {...baseProps}>
          <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
        </svg>
      );
    case "logout":
      return (
        <svg {...baseProps}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}
