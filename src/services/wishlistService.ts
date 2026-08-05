import { fetchApi } from './apiClient';

export async function syncWishlistRemote(
  items: number[],
  revision: number,
  operationId: string
): Promise<{ success: boolean; revision: number; items: number[] }> {
  return fetchApi<{ success: boolean; revision: number; items: number[] }>('/sync/wishlist', {
    method: 'POST',
    body: JSON.stringify({ items, revision, operationId }),
  });
}
