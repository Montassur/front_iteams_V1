import { api } from '../services/api';

export interface CompanyDto {
  id: number;
  name: string;
  registryNumber: string;
  ownerId?: number | null;
}

export async function listCompanies(): Promise<CompanyDto[]> {
  const result = await api.get<CompanyDto[] | { companies?: CompanyDto[] }>('/companies');
  if (Array.isArray(result)) return result;
  return (result as any)?.companies ?? [];
}
