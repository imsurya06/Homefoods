import { fetchApi } from './apiClient';
import type { Address } from '../store/useSyncStore';

export async function syncProfileRemote(
  firstName: string,
  lastName: string,
  phone: string,
  revision: number,
  operationId: string,
  updatedAt: string
): Promise<{ success: boolean; revision: number; firstName: string; lastName: string; phone: string }> {
  return fetchApi<{ success: boolean; revision: number; firstName: string; lastName: string; phone: string }>('/sync/profile', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, phone, revision, operationId, updatedAt }),
  });
}

export async function syncAddressesRemote(
  addresses: Address[],
  revision: number,
  operationId: string
): Promise<{ success: boolean; revision: number; addresses: Address[] }> {
  return fetchApi<{ success: boolean; revision: number; addresses: Address[] }>('/sync/address', {
    method: 'POST',
    body: JSON.stringify({ addresses, revision, operationId }),
  });
}
