import { useEffect, useState } from 'react';

export function Spinner() {
  const [r, setR] = useState(0);
  useEffect(() => { const id = setInterval(() => setR((x) => x + 15), 50); return () => clearInterval(id); }, []);
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" style={{ transform: `rotate(${r}deg)` }}>
      <circle cx={8} cy={8} r={6} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
      <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

