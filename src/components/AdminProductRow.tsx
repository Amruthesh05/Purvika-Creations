import type { Product } from '@/lib/types';
import { formatINR, formatDate, classNames } from '@/lib/utils';
import { Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';

interface AdminProductRowProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegistrations: (product: Product) => void;
}

export function AdminProductRow({ product, onEdit, onDelete, onRegistrations }: AdminProductRowProps) {
  const inStock = product.stock_status === 'in_stock';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-lg object-cover" loading="lazy" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
            <p className="truncate text-xs text-gray-500">{product.description}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatINR(product.price_paise)}</td>
      <td className="py-3 px-4">
        <span className={classNames(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        )}>
          {inStock ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(product.updated_at)}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onEdit(product)} className="px-3 py-1.5 text-xs">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="secondary" onClick={() => onRegistrations(product)} className="px-3 py-1.5 text-xs">
            Registrations
          </Button>
          <Button variant="danger" onClick={() => onDelete(product)} className="px-3 py-1.5 text-xs">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
