import { forwardRef, useMemo, useState, useEffect } from 'react';
import type { Product, StockStatus, Variant } from '@/lib/types';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { PriceTag } from '@/components/PriceTag';
import { X, Star, ImageOff, TriangleAlert as AlertTriangle, Plus, Check } from 'lucide-react';
import { MIN_IMAGES, MAX_IMAGES, PLACEHOLDER_IMAGE } from '@/lib/products/config';
import { MRP_BELOW_PRICE_MESSAGE } from '@/lib/pricing';
import { slugify } from '@/lib/validation';
import { classNames } from '@/lib/utils';

const VARIANT_PRESETS: { label: string; values: string[] }[] = [
  { label: 'Apparel sizes', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'Waist sizes', values: ['28', '30', '32', '34', '36', '38'] },
  { label: 'Free size', values: ['Free size'] },
];

interface ProductFormProps {
  initial?: Product | null;
  onSubmit: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => void;
  onCancel: () => void;
  loading?: boolean;
  fieldErrors?: Record<string, string>;
}

function buildInitialImageUrls(initial?: Product | null): string[] {
  if (initial?.imageUrls && initial.imageUrls.length > 0) {
    const padded = [...initial.imageUrls];
    while (padded.length < MAX_IMAGES) padded.push('');
    return padded.slice(0, MAX_IMAGES);
  }
  if (initial?.image_url) {
    const padded = [initial.image_url];
    while (padded.length < MAX_IMAGES) padded.push('');
    return padded.slice(0, MAX_IMAGES);
  }
  return Array.from({ length: MAX_IMAGES }, () => '');
}

function rupeesToPaise(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return Math.round(Number(trimmed) * 100);
}

function validatePricing(pricePaise: number | null, mrpPaise: number | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (pricePaise === null) errors.price_paise = 'Sale price is required';
  else if (!(pricePaise > 0)) errors.price_paise = 'Sale price must be greater than 0';
  if (mrpPaise !== null && !Number.isFinite(mrpPaise)) {
    errors.mrpPaise = 'MRP must be a number';
  } else if (mrpPaise !== null && pricePaise !== null && mrpPaise < pricePaise) {
    errors.mrpPaise = MRP_BELOW_PRICE_MESSAGE;
  }
  return errors;
}

export const ProductForm = forwardRef<HTMLFormElement, ProductFormProps>(
  ({ initial, onSubmit, onCancel, loading, fieldErrors = {} }, ref) => {
    const initialImageUrls = useMemo(() => buildInitialImageUrls(initial), [initial]);
    const isEdit = !!initial;
    const existingImageCount = (initial?.imageUrls ?? []).filter((u) => u.trim().length > 0).length;
    const showLowImageWarning = isEdit && existingImageCount < MIN_IMAGES;

    const [priceInput, setPriceInput] = useState(initial ? String(initial.price_paise / 100) : '');
    const [mrpInput, setMrpInput] = useState(initial?.mrpPaise ? String(initial.mrpPaise / 100) : '');
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
    const [variantLabel, setVariantLabel] = useState(initial?.variantLabel ?? 'Size');
    const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? []);
    const [variantInput, setVariantInput] = useState('');

    const pricePaise = rupeesToPaise(priceInput);
    const mrpPaise = rupeesToPaise(mrpInput);
    const previewPrice = pricePaise !== null && pricePaise > 0 ? pricePaise : null;
    const previewMrp = mrpPaise !== null && Number.isFinite(mrpPaise) ? mrpPaise : null;
    const errors = { ...fieldErrors, ...localErrors };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const name = (formData.get('name') as string).trim();
      const description = (formData.get('description') as string).trim();

      const nextErrors = validatePricing(pricePaise, mrpPaise);
      if (!name) nextErrors.name = 'Name is required';
      if (!description) nextErrors.description = 'Description is required';
      if (Object.keys(nextErrors).length > 0) {
        setLocalErrors(nextErrors);
        return;
      }
      setLocalErrors({});

      const rawImageUrls: string[] = [];
      for (let i = 0; i < MAX_IMAGES; i++) {
        const val = (formData.get(`image_url_${i}`) as string | null)?.trim() ?? '';
        rawImageUrls.push(val);
      }
      const imageUrls = rawImageUrls.filter((u) => u.length > 0);

      onSubmit({
        id: initial?.id,
        name,
        description,
        price_paise: pricePaise as number,
        mrpPaise,
        stock_status: formData.get('stock_status') as StockStatus,
        image_url: imageUrls[0] ?? '',
        imageUrls,
        active: formData.get('active') === 'on',
        saleMode: formData.get('saleMode') as 'buy' | 'preorder' | 'preorder_closed',
        preorderLimit: formData.get('preorderLimit') ? Number(formData.get('preorderLimit')) : null,
        variantLabel: variantLabel.trim() || 'Size',
        variants,
      });
    };

    return (
      <form ref={ref} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h3>
          <button type="button" onClick={onCancel} className="text-text-muted hover:text-text transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Field label="Product Name" name="name" required placeholder="e.g. Wireless Earbuds Pro" defaultValue={initial?.name ?? ''} error={errors.name ?? fieldErrors.name} />
        <Field label="Description" name="description" type="textarea" required placeholder="Product description" defaultValue={initial?.description ?? ''} error={errors.description ?? fieldErrors.description} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sale price (INR)" name="price_paise" type="number" required placeholder="e.g. 4999" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} min={0} step={0.01} error={errors.price_paise ?? fieldErrors.price_paise} />
          <Field label="MRP (INR, optional)" name="mrpPaise" type="number" placeholder="e.g. 5999" value={mrpInput} onChange={(e) => setMrpInput(e.target.value)} min={0} step={0.01} error={errors.mrpPaise ?? fieldErrors.mrpPaise} />
        </div>
        <div className="rounded-xl border border-ink-border bg-ink-surface p-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Storefront preview</p>
          {previewPrice !== null ? (
            <PriceTag pricePaise={previewPrice} mrpPaise={previewMrp} />
          ) : (
            <p className="text-sm text-text-muted">Enter a sale price to see how it will look.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Stock Status"
            name="stock_status"
            type="select"
            required
            defaultValue={initial?.stock_status ?? 'in_stock'}
            options={[
              { value: 'in_stock', label: 'In Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
            ]}
          />
          <Field label="Sale mode" name="saleMode" type="select" required defaultValue={initial?.saleMode ?? 'buy'} options={[{ value: 'buy', label: 'Buy now' }, { value: 'preorder', label: 'Registrations open (free pre-order)' }, { value: 'preorder_closed', label: 'Registrations closed' }]} />
        </div>
        <Field label="Registration limit (optional)" name="preorderLimit" type="number" min={1} defaultValue={initial?.preorderLimit ?? ''} placeholder="Unlimited" />

        {showLowImageWarning && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            This product has fewer than {MIN_IMAGES} images. Add more when you can.
          </div>
        )}

        <div className="rounded-xl border border-ink-border bg-ink-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Product images</p>
              <p className="text-xs text-text-muted">
                {isEdit
                  ? `Provide ${MIN_IMAGES} to ${MAX_IMAGES} image URLs if you change the list. The first image is the cover. Must be https URLs, no duplicates.`
                  : `Provide ${MIN_IMAGES} to ${MAX_IMAGES} image URLs. The first image is the cover. Must be https URLs, no duplicates.`}
              </p>
            </div>
          </div>
          {fieldErrors.imageUrls && (
            <p className="mb-2 text-xs text-red-400">{fieldErrors.imageUrls}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: MAX_IMAGES }, (_, i) => {
              const name = `image_url_${i}`;
              const required = !isEdit && i < MIN_IMAGES;
              const label = required ? `Image ${i + 1} (cover)` : `Image ${i + 1}`;
              return (
                <ImageFieldRow
                  key={i}
                  name={name}
                  label={label}
                  required={required}
                  defaultValue={initialImageUrls[i] ?? ''}
                  placeholder="https://..."
                />
              );
            })}
          </div>
        </div>

        <VariantsEditor
          variantLabel={variantLabel}
          onLabelChange={setVariantLabel}
          variants={variants}
          onVariantsChange={setVariants}
          variantInput={variantInput}
          onVariantInputChange={setVariantInput}
          error={fieldErrors.variants}
        />

        <Field label="Active (visible in catalog)" name="active" type="checkbox" defaultChecked={initial?.active ?? true} placeholder="Show in public catalog" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Save Changes' : 'Add Product'}</Button>
        </div>
      </form>
    );
  },
);

ProductForm.displayName = 'ProductForm';

interface ImageFieldRowProps {
  name: string;
  label: string;
  required: boolean;
  defaultValue: string;
  placeholder: string;
}

function ImageFieldRow({ name, label, required, defaultValue, placeholder }: ImageFieldRowProps) {
  return (
    <div className="flex gap-3">
      <ThumbPreview inputName={name} initialUrl={defaultValue} />
      <div className="flex-1">
        <label htmlFor={name} className="mb-1 flex items-center gap-1 text-xs font-medium text-text">
          {required ? <Star className="h-3 w-3 text-flame-400" /> : null}
          {label}
        </label>
        <input
          id={name}
          name={name}
          type="url"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full rounded-lg border border-ink-border bg-ink-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-flame-500 focus:border-transparent transition-colors"
        />
      </div>
    </div>
  );
}

function ThumbPreview({ inputName, initialUrl }: { inputName: string; initialUrl: string }) {
  return (
    <ThumbPreviewInner inputName={inputName} initialUrl={initialUrl} />
  );
}

function ThumbPreviewInner({ inputName, initialUrl }: { inputName: string; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setUrl(initialUrl);
    setErrored(false);
  }, [initialUrl]);

  useEffect(() => {
    const input = document.querySelector(`input[name="${inputName}"]`) as HTMLInputElement | null;
    if (!input) return;
    const handler = () => {
      setUrl(input.value.trim());
      setErrored(false);
    };
    input.addEventListener('input', handler);
    return () => input.removeEventListener('input', handler);
  }, [inputName]);

  const showImage = url.length > 0 && !errored;

  return (
    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-ink-border bg-ink-surface">
      {showImage ? (
        <img
          src={url}
          alt="preview"
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ink-raised text-text-muted">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function VariantsEditor({
  variantLabel,
  onLabelChange,
  variants,
  onVariantsChange,
  variantInput,
  onVariantInputChange,
  error,
}: {
  variantLabel: string;
  onLabelChange: (v: string) => void;
  variants: Variant[];
  onVariantsChange: (v: Variant[]) => void;
  variantInput: string;
  onVariantInputChange: (v: string) => void;
  error?: string;
}) {
  const addVariant = (rawLabel: string) => {
    const label = rawLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (variants.some((v) => v.id === id)) return;
    if (variants.length >= 12) return;
    onVariantsChange([...variants, { id, label, in_stock: true }]);
    onVariantInputChange('');
  };

  const removeVariant = (id: string) => {
    onVariantsChange(variants.filter((v) => v.id !== id));
  };

  const toggleStock = (id: string) => {
    onVariantsChange(variants.map((v) => (v.id === id ? { ...v, in_stock: !v.in_stock } : v)));
  };

  const applyPreset = (values: string[]) => {
    const next: Variant[] = [];
    for (const val of values) {
      const id = slugify(val);
      if (next.some((v) => v.id === id)) continue;
      if (next.length >= 12) break;
      next.push({ id, label: val, in_stock: true });
    }
    onVariantsChange(next);
  };

  return (
    <div className="rounded-xl border border-ink-border bg-ink-surface p-4">
      <div className="mb-3">
        <p className="text-sm font-medium text-text">Variants (optional)</p>
        <p className="text-xs text-text-muted">Add sizes or other options. Customers must pick one before adding to cart.</p>
      </div>
      <Field
        label="Option name"
        name="variantLabel"
        placeholder="e.g. Size, Color, Waist"
        value={variantLabel}
        onChange={(e) => onLabelChange(e.target.value)}
        error={error}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {VARIANT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset.values)}
            className="rounded-lg border border-ink-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-ink-raised hover:text-text"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={variantInput}
          onChange={(e) => onVariantInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addVariant(variantInput);
            }
          }}
          placeholder="Add a value (e.g. M)"
          maxLength={20}
          className="flex-1 rounded-lg border border-ink-border bg-ink-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-flame-500"
        />
        <button
          type="button"
          onClick={() => addVariant(variantInput)}
          disabled={!variantInput.trim() || variants.length >= 12}
          className="flex items-center gap-1 rounded-lg bg-flame-500 px-3 py-2 text-sm font-medium text-[#141416] transition-colors hover:bg-flame-400 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      {variants.length > 0 && (
        <div className="mt-3 space-y-2">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border border-ink-border bg-ink-raised px-3 py-2">
              <span className="text-sm font-medium text-text">{v.label}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleStock(v.id)}
                  className={classNames(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    v.in_stock ? 'bg-emerald-500/15 text-emerald-300' : 'bg-ink-surface text-text-muted',
                  )}
                >
                  <span className={classNames('flex h-4 w-4 items-center justify-center rounded', v.in_stock ? 'bg-emerald-500 text-[#141416]' : 'bg-ink-border')}>
                    {v.in_stock && <Check className="h-3 w-3" />}
                  </span>
                  {v.in_stock ? 'In stock' : 'Out of stock'}
                </button>
                <button
                  type="button"
                  onClick={() => removeVariant(v.id)}
                  className="text-text-muted transition-colors hover:text-red-400"
                  aria-label={`Remove ${v.label}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export { PLACEHOLDER_IMAGE };
