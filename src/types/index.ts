export interface User {
  id?: number;
  name: string;
  email: string;
  initials: string;
  color: string;
  globalRole?: string | null;
}

export type PageId =
  | 'dashboard'
  | 'meetings'
  | 'active'
  | 'tasks'
  | 'users'
  | 'organizations'
  | 'organization-detail'
  | 'org-home'
  | 'files'
  | 'chat'
  | 'settings'
  | 'help'
  | 'invoices'
  | 'profile'
  | 'admin-billing';

export interface Meeting {
  id: number;
  title: string;
  date: string;
  time: string;
  duration: number;
  participants: number;
  status: 'upcoming' | 'completed';
  type: string;
  color: string;
}

export interface Task {
  id: number;
  text: string;
  due: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface Kpi {
  label: string;
  value: string | number;
  delta: string;
  positive: boolean;
  icon: string;
  color: string;
}
