import React from 'react';

type P = { size?: number; className?: string; strokeWidth?: number };

function I({ size = 22, className, strokeWidth = 1.8, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconToday = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.6 2.6L16 9.6" /></I>;
export const IconWeek = (p: P) => <I {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></I>;
export const IconChart = (p: P) => <I {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></I>;
export const IconTarget = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>;
export const IconMore = (p: P) => <I {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></I>;
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconMinus = (p: P) => <I {...p}><path d="M5 12h14" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const IconClose = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconLeft = (p: P) => <I {...p}><path d="m15 5-7 7 7 7" /></I>;
export const IconRight = (p: P) => <I {...p}><path d="m9 5 7 7-7 7" /></I>;
export const IconUp = (p: P) => <I {...p}><path d="m6 15 6-6 6 6" /></I>;
export const IconDown = (p: P) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const IconFlame = (p: P) => <I {...p}><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.7-8.3.4 1.9 1.4 3 2.6 3.6-.2-2.6.6-5 2.7-7.1.3 3.1 1.6 4.7 2.8 6.3 1 1.3 1.7 2.8 1.7 5 0 4-2.9 6.7-7 6.7Z" /></I>;
export const IconBolt = (p: P) => <I {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></I>;
export const IconRun = (p: P) => <I {...p}><circle cx="15" cy="4.5" r="1.8" /><path d="m7 21 3-6 3 2v4M6 11l3-3 4 .5 2 3.5 3 1M10 15l1.8-5" /></I>;
export const IconDumbbell = (p: P) => <I {...p}><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></I>;
export const IconWalk = (p: P) => <I {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="m9 21 2.5-6.5L14 17v4M8 12l2.5-4 3 .5 1.5 3.5 2.5 1M11.5 14.5 13 8.5" /></I>;
export const IconStretch = (p: P) => <I {...p}><circle cx="12" cy="4.5" r="1.8" /><path d="M4 9l8 1 8-1M12 10v5l-3 6M12 15l3 6" /></I>;
export const IconSpark = (p: P) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></I>;
export const IconWallet = (p: P) => <I {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2M6 6l10-3 1 3" /></I>;
export const IconNote = (p: P) => <I {...p}><path d="M5 3.5h10l4 4V20.5H5z" /><path d="M14.5 3.5V8H19M8.5 12.5h7M8.5 16h5" /></I>;
export const IconList = (p: P) => <I {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></I>;
export const IconSettings = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></I>;
export const IconDatabase = (p: P) => <I {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></I>;
export const IconAlert = (p: P) => <I {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.2v.1" /></I>;
export const IconMoon = (p: P) => <I {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></I>;
export const IconShare = (p: P) => <I {...p}><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" /></I>;
export const IconTrash = (p: P) => <I {...p}><path d="M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13" /></I>;
export const IconEdit = (p: P) => <I {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></I>;
export const IconCopy = (p: P) => <I {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></I>;
export const IconSearch = (p: P) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></I>;
