import { useState } from 'react';
import { SIcon } from '../../components/icons/SIcon';

interface FieldProps {
  label: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  type?: string;
  suffix?: React.ReactNode;
}

export function Field({ label, icon, value, onChange, placeholder, error, type = 'text', suffix }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', color: '#374151', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: `1.5px solid ${error ? '#fca5a5' : focused ? 'var(--ms-accent)' : '#e2e8f0'}`,
        borderRadius: 'var(--ms-radius-sm)', background: error ? '#fff5f5' : '#fff',
        padding: '0 12px', transition: 'all 0.15s',
        boxShadow: focused ? '0 0 0 3px var(--ms-accent-dim)' : 'none',
      }}>
        <SIcon name={icon} size={15} color={focused ? 'var(--ms-accent)' : '#94a3b8'} />
        <input
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} type={type}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '11px 0', fontSize: 14, color: '#0f172a', fontFamily: 'inherit' }}
        />
        {suffix}
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

