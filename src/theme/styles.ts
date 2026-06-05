export const STYLES = {
  moderne: {
    '--ms-radius':       '14px',
    '--ms-radius-sm':    '8px',
    '--ms-radius-lg':    '20px',
    '--ms-shadow':       '0 1px 3px rgba(0,0,0,0.07)',
    '--ms-shadow-md':    '0 4px 12px rgba(0,0,0,0.1)',
    '--ms-shadow-top':   'none',
    '--ms-border-width': '1px',
  },
  epure: {
    '--ms-radius':       '4px',
    '--ms-radius-sm':    '2px',
    '--ms-radius-lg':    '6px',
    '--ms-shadow':       'none',
    '--ms-shadow-md':    'none',
    '--ms-shadow-top':   '0 1px 0 #e2e8f0',
    '--ms-border-width': '1.5px',
  },
  chaleureux: {
    '--ms-radius':       '20px',
    '--ms-radius-sm':    '12px',
    '--ms-radius-lg':    '28px',
    '--ms-shadow':       '0 4px 20px rgba(0,0,0,0.08)',
    '--ms-shadow-md':    '0 8px 32px rgba(0,0,0,0.12)',
    '--ms-shadow-top':   '0 2px 12px rgba(0,0,0,0.06)',
    '--ms-border-width': '0px',
  },
} as const;

export type StyleKey = keyof typeof STYLES;
