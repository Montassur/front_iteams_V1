import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;

interface SIconProps {
  name: string;
  size?: number;
  color?: string;
  sw?: number;
}

export function SIcon({ name, size = 16, color = 'currentColor', sw = 1.8 }: SIconProps) {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={sw} />;
}
