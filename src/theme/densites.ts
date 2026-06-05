export const DENSITES = {
  compact: {
    '--ms-topbar':  '44px',
    '--ms-pad':     '16px',
    '--ms-gap':     '12px',
    '--ms-nav-pad': '6px',
  },
  standard: {
    '--ms-topbar':  '56px',
    '--ms-pad':     '24px',
    '--ms-gap':     '20px',
    '--ms-nav-pad': '9px',
  },
  aere: {
    '--ms-topbar':  '68px',
    '--ms-pad':     '36px',
    '--ms-gap':     '28px',
    '--ms-nav-pad': '13px',
  },
} as const;

export type DensiteKey = keyof typeof DENSITES;
