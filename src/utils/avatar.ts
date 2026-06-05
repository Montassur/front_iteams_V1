import { AVATAR_COLORS } from '../constants/auth';
import type { AuthApiUser } from '../types/auth';
import type { User } from '../types';

function hashSeed(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildDisplayUser(user: AuthApiUser): User {
  const name = user.name?.trim() || user.email.split('@')[0] || 'Utilisateur';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const color = AVATAR_COLORS[hashSeed(user.email || name) % AVATAR_COLORS.length];

  return {
    id: user.id,
    name,
    email: user.email,
    initials,
    color,
    globalRole: user.globalRole ?? null,
  };
}

