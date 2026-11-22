import type { Repository } from './db/repository';
import type { User, MutateRequest, MutateResult, ProductInput, Product, SetStatusInput } from './types';
import { mutateRequestSchema, productUpdateInputSchema } from './validation';
import { isApprovedAdmin, isSuperadmin } from './auth/session';
import { MIN_IMAGES, MAX_IMAGES } from './products/config';

export interface MutateContext {
  repo: Repository;
  user: User | null;
}

export async function handleMutate(ctx: MutateContext, body: unknown): Promise<MutateResult> {
  const { repo, user } = ctx;

  if (!isApprovedAdmin(user)) {
    return { success: false, error: 'Forbidden: admin access required' };
  }

  const parsed = mutateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const request = parsed.data as MutateRequest;

  if (!isSuperadmin(user)) {
    if (request.action !== 'SET_STATUS' || !request.setStatus?.stock_status || request.setStatus.active !== undefined || request.setStatus.sale_mode !== undefined) {
      return { success: false, error: 'Forbidden: superadmin access required' };
    }
  }

  try {
    let product: Product | undefined;

    if (request.action === 'ADD' && request.product) {
      product = await repo.addProduct(request.product as ProductInput);
    } else if (request.action === 'UPDATE' && request.product) {
      const existing = await repo.getProductById(request.product.id!);
      if (!existing) {
        return { success: false, error: 'Product not found' };
      }
      // For UPDATE: images required only when the image list was changed.
      // An unchanged legacy list (even with < MIN_IMAGES) is accepted as-is.
      const newUrls = (request.product.imageUrls ?? []).map((u) => u.trim()).filter((u) => u.length > 0);
      const oldUrls = (existing.imageUrls ?? []).map((u) => u.trim()).filter((u) => u.length > 0);
      const imagesChanged = JSON.stringify(newUrls) !== JSON.stringify(oldUrls);

      if (imagesChanged) {
        // Validate the new list with the strict image schema
        const strictCheck = productUpdateInputSchema.safeParse(request.product);
        if (!strictCheck.success) {
          const imageErrors = strictCheck.error.issues
            .filter((i) => i.path.some((p) => p === 'imageUrls'))
            .map((i) => i.message);
          if (imageErrors.length > 0) {
            return { success: false, error: imageErrors.join('; ') };
          }
          // Other validation errors
          return { success: false, error: strictCheck.error.issues.map((i) => i.message).join('; ') };
        }
      }

      // Build the input, preserving old image list if unchanged
      const input: ProductInput = {
        ...request.product,
        imageUrls: imagesChanged ? newUrls : oldUrls,
        image_url: imagesChanged ? (newUrls[0] ?? request.product.image_url) : (oldUrls[0] ?? existing.image_url),
      };
      product = await repo.updateProduct(input);
    } else if (request.action === 'DELETE' && request.productId) {
      const existing = await repo.getProductById(request.productId);
      if (!existing) {
        return { success: false, error: 'Product not found' };
      }
      await repo.deleteProduct(request.productId);
    } else if (request.action === 'SET_STATUS' && request.setStatus) {
      const existing = await repo.getProductById(request.setStatus.productId);
      if (!existing) {
        return { success: false, error: 'Product not found' };
      }
      const patch: SetStatusInput = request.setStatus;
      product = await repo.setProductStatus(patch.productId, {
        stock_status: patch.stock_status,
        active: patch.active,
        sale_mode: patch.sale_mode,
      });
    } else {
      return { success: false, error: 'Invalid action or missing data' };
    }

    const kvSuccess = await repo.rebuildKVCacheWithRetry();
    if (!kvSuccess) {
      console.error('KV cache rebuild failed after retry, but D1 write succeeded');
    }

    return { success: true, product };
  } catch (err) {
    console.error('Mutation error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Internal error' };
  }
}
