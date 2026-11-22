import { useState, useMemo, useCallback } from 'react';
import type { Product, MutateRequest, ProductInput, User, Preorder, StockStatus, SaleMode } from '@/lib/types';
import { AdminLayout } from '@/components/AdminLayout';
import { ProductForm } from '@/components/ProductForm';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import { useToasts, ToastContainer } from '@/components/Toast';
import { formatINR, classNames } from '@/lib/utils';
import { Plus, Package, Search, Pencil, Trash2, CircleCheck as CheckCircle2, Circle as XCircle, Eye, EyeOff, TriangleAlert as AlertTriangle } from 'lucide-react';
import { MIN_IMAGES } from '@/lib/products/config';

interface AdminCatalogPageProps {
  currentUser: User;
  products: Product[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type FilterChip = 'all' | 'in_stock' | 'out_of_stock' | 'hidden';

export function AdminCatalogPage({ currentUser, products, loading, error, onRefresh }: AdminCatalogPageProps) {
  const { toasts, addToast, dismissToast } = useToasts();
  const isSuperadmin = currentUser.role === 'superadmin';
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [registrationProduct, setRegistrationProduct] = useState<Product | null>(null);
  const [registrations, setRegistrations] = useState<Preorder[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [optimisticProducts, setOptimisticProducts] = useState<Record<string, Product>>({});

  const callMutate = async (request: MutateRequest) => {
    const res = await fetch('/api/admin/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    if (!res.ok) {
      throw data;
    }
    return data;
  };

  const mergedProducts = useMemo(() => {
    return products.map((p) => optimisticProducts[p.id] ?? p);
  }, [products, optimisticProducts]);

  const filteredProducts = useMemo(() => {
    let result = mergedProducts;
    if (filter === 'in_stock') result = result.filter((p) => p.stock_status === 'in_stock' && p.active);
    else if (filter === 'out_of_stock') result = result.filter((p) => p.stock_status === 'out_of_stock' && p.active);
    else if (filter === 'hidden') result = result.filter((p) => !p.active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return result;
  }, [mergedProducts, filter, search]);

  const handleSubmit = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
    setMutationLoading(true);
    setFieldErrors({});
    try {
      const input: ProductInput = {
        id: data.id,
        name: data.name,
        description: data.description,
        price_paise: data.price_paise,
        stock_status: data.stock_status,
        image_url: data.image_url,
        imageUrls: data.imageUrls,
        active: data.active,
        saleMode: data.saleMode,
        preorderLimit: data.preorderLimit,
        mrpPaise: data.mrpPaise,
        variantLabel: data.variantLabel,
        variants: data.variants,
      };
      const action = data.id ? 'UPDATE' : 'ADD';
      await callMutate({ action, product: input });
      addToast(data.id ? 'Product updated successfully' : 'Product added successfully');
      setShowForm(false);
      setEditingProduct(null);
      onRefresh();
    } catch (err) {
      const errorObj = err as { error?: string };
      const message = errorObj?.error || 'An error occurred';
      // Try to parse per-field errors from the message
      const fieldMap: Record<string, string> = {};
      const parts = message.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        const match = trimmed.match(/^(.+?) is required$/);
        if (match) {
          const field = match[1].toLowerCase().replace(/\s+/g, '_');
          fieldMap[field] = trimmed;
        }
      }
      if (Object.keys(fieldMap).length > 0) {
        setFieldErrors(fieldMap);
      }
      addToast(message, 'error');
    } finally {
      setMutationLoading(false);
    }
  };

  const handleSetStatus = useCallback(async (
    product: Product,
    patch: { stock_status?: StockStatus; active?: boolean; sale_mode?: SaleMode },
    field: 'stock_status' | 'active' | 'sale_mode',
  ) => {
    const prev = product;
    const optimistic: Product = {
      ...prev,
      stock_status: patch.stock_status ?? prev.stock_status,
      active: patch.active ?? prev.active,
      saleMode: patch.sale_mode ?? prev.saleMode,
    };
    setOptimisticProducts((prevMap) => ({ ...prevMap, [product.id]: optimistic }));

    try {
      const result = await callMutate({
        action: 'SET_STATUS',
        setStatus: { productId: product.id, ...patch },
      });
      if (result.product) {
        setOptimisticProducts((prevMap) => ({ ...prevMap, [product.id]: result.product }));
      }
      addToast(`${product.name} updated`);
    } catch (err) {
      const errorObj = err as { error?: string };
      const message = errorObj?.error || 'Update failed';
      // Revert
      setOptimisticProducts((prevMap) => {
        const next = { ...prevMap };
        next[product.id] = prev;
        return next;
      });
      addToast(message, 'error');
    }
  }, [addToast]);

  const openRegistrations = async (product: Product) => {
    setRegistrationProduct(product);
    setRegistrationsLoading(true);
    try {
      const response = await fetch(`/api/admin/preorders?productId=${encodeURIComponent(product.id)}`);
      if (!response.ok) throw new Error('Could not load registrations');
      const data = await response.json() as { preorders?: Preorder[] };
      setRegistrations(data.preorders ?? []);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not load registrations', 'error');
      setRegistrations([]);
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setMutationLoading(true);
    try {
      await callMutate({ action: 'DELETE', productId: deleteTarget.id });
      addToast('Product deleted successfully');
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      const errorObj = err as { error?: string };
      addToast(errorObj?.error || 'An error occurred', 'error');
    } finally {
      setMutationLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout currentUser={currentUser}>
        <LoadingSpinner label="Loading products..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout currentUser={currentUser}>
        <ErrorState message={error}>
          <Button onClick={onRefresh}>Try again</Button>
        </ErrorState>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentUser={currentUser}>
      {/* Toolbar */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">Catalog Management</h1>
            <p className="mt-1 text-sm text-text-muted">{products.length} products total</p>
          </div>
          {isSuperadmin && (
            <Button onClick={() => { setEditingProduct(null); setFieldErrors({}); setShowForm(true); }}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>

        {/* Search + filter chips */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-ink-border bg-ink-surface py-2.5 pl-10 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-flame-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'in_stock', 'out_of_stock', 'hidden'] as FilterChip[]).map((chip) => (
              <button
                key={chip}
                onClick={() => setFilter(chip)}
                className={classNames(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === chip
                    ? 'bg-flame-500 text-[#141416]'
                    : 'bg-ink-raised text-text-muted border border-ink-border hover:border-flame-500',
                )}
              >
                {chip === 'all' ? 'All' : chip === 'in_stock' ? 'In stock' : chip === 'out_of_stock' ? 'Out of stock' : 'Hidden'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 && !showForm ? (
        <EmptyState message={search || filter !== 'all' ? 'No products match your filters.' : "No products yet. Click 'Add Product' to create your first one."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
            const inStock = p.stock_status === 'in_stock';
            const lowImages = (p.imageUrls ?? []).filter((u) => u.trim().length > 0).length < MIN_IMAGES;
            return (
              <div key={p.id} className="surface-card flex flex-col overflow-hidden p-4">
                {/* Cover thumbnail */}
                <div className="mb-3 flex gap-3">
                  <img
                    src={p.image_url || p.imageUrls?.[0] || ''}
                    alt={p.name}
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover border border-ink-border"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-text">{p.name}</h3>
                    <p className="text-sm font-medium text-flame-400">{formatINR(p.price_paise)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge inStock={inStock} />
                      <VisibilityBadge active={p.active} />
                    </div>
                  </div>
                </div>

                {lowImages && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-700/40 bg-amber-900/20 px-2.5 py-1.5 text-xs text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    This product has fewer than {MIN_IMAGES} images. Add more when you can.
                  </div>
                )}

                {/* Switches */}
                <div className="space-y-2.5">
                  <ToggleRow
                    label="In stock"
                    checked={inStock}
                    onLabel="In stock"
                    offLabel="Out of stock"
                    onChange={(val) => handleSetStatus(p, { stock_status: val ? 'in_stock' : 'out_of_stock' }, 'stock_status')}
                  />
                  {isSuperadmin && (
                    <>
                      <ToggleRow
                        label="Visible"
                        checked={p.active}
                        onLabel="Visible"
                        offLabel="Hidden"
                        onChange={(val) => handleSetStatus(p, { active: val }, 'active')}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-text-muted">Sale mode</span>
                        <select
                          value={p.saleMode}
                          onChange={(e) => handleSetStatus(p, { sale_mode: e.target.value as SaleMode }, 'sale_mode')}
                          className="rounded-lg border border-ink-border bg-ink-surface px-2 py-1 text-xs text-text focus:outline-none focus:ring-2 focus:ring-flame-500"
                        >
                          <option value="buy">Buy now</option>
                          <option value="preorder">Registrations open</option>
                          <option value="preorder_closed">Registrations closed</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2 border-t border-ink-border pt-3">
                  {isSuperadmin && (
                    <Button
                      variant="secondary"
                      onClick={() => { setEditingProduct(p); setFieldErrors({}); setShowForm(true); }}
                      className="px-3 py-1.5 text-xs"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit details
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => openRegistrations(p)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Registrations
                  </Button>
                  {isSuperadmin && (
                    <Button
                      variant="danger"
                      onClick={() => setDeleteTarget(p)}
                      className="px-3 py-1.5 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowForm(false); setEditingProduct(null); setFieldErrors({}); }} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-ink-raised border border-ink-border p-6 shadow-xl">
            <ProductForm
              initial={editingProduct}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); setEditingProduct(null); setFieldErrors({}); }}
              loading={mutationLoading}
              fieldErrors={fieldErrors}
            />
          </div>
        </div>
      )}

      {registrationProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRegistrationProduct(null)} />
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-ink-raised border border-ink-border p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-text">Registrations</h2>
                <p className="text-sm text-text-muted">{registrationProduct.name} · {registrations.length} total</p>
              </div>
              <Button variant="secondary" onClick={() => setRegistrationProduct(null)}>Close</Button>
            </div>
            {registrationsLoading ? <LoadingSpinner label="Loading registrations..." /> : registrations.length === 0 ? <EmptyState message="No registrations yet." /> : (
              <div className="overflow-x-auto rounded-xl border border-ink-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-ink-surface text-xs uppercase text-text-muted"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Alternate</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Note</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody>{registrations.map((r) => <tr key={r.id} className="border-t border-ink-border"><td className="px-3 py-2 text-text">{r.name}</td><td className="px-3 py-2 text-text-muted">{r.email ?? '—'}</td><td className="px-3 py-2 text-text-muted">{r.phone}</td><td className="px-3 py-2 text-text-muted">{r.alt_phone ?? '—'}</td><td className="px-3 py-2 text-text-muted">{r.quantity}</td><td className="max-w-48 px-3 py-2 text-text-muted">{r.note ?? '—'}</td><td className="whitespace-nowrap px-3 py-2 text-text-muted">{new Date(r.created_at).toLocaleDateString()}</td><td className="px-3 py-2 text-text-muted">{r.status}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}

function StatusBadge({ inStock }: { inStock: boolean }) {
  return (
    <span className={classNames(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      inStock ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400',
    )}>
      {inStock ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {inStock ? 'In stock' : 'Out of stock'}
    </span>
  );
}

function VisibilityBadge({ active }: { active: boolean }) {
  return (
    <span className={classNames(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      active ? 'bg-blue-900/40 text-blue-300' : 'bg-zinc-800 text-text-muted',
    )}>
      {active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {active ? 'Visible' : 'Hidden'}
    </span>
  );
}

function ToggleRow({ label, checked, onLabel, offLabel, onChange }: {
  label: string;
  checked: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={classNames(
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-flame-500' : 'bg-ink-border',
        )}
      >
        <span className={classNames(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-1',
        )} style={checked ? { transform: 'translateX(20px)' } : { transform: 'translateX(4px)' }} />
        <span className="sr-only">{checked ? onLabel : offLabel}</span>
      </button>
    </div>
  );
}
