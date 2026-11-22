import { z } from 'zod';
import { MIN_IMAGES, MAX_IMAGES } from './products/config';
import { MRP_BELOW_PRICE_MESSAGE } from './pricing';

export const saleModeSchema = z.enum(['buy', 'preorder', 'preorder_closed']);

export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const variantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Variant label must be 1-20 characters').max(20, 'Variant label must be 1-20 characters'),
  in_stock: z.boolean(),
});

export const variantsSchema = z.array(variantSchema).max(12, 'At most 12 variants are allowed').superRefine((variants, ctx) => {
  const seenLabels = new Set<string>();
  const seenIds = new Set<string>();
  for (const v of variants) {
    const lower = v.label.toLowerCase().trim();
    if (seenLabels.has(lower)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Variant labels must be unique (case-insensitive)', path: ['variants'] });
      return;
    }
    seenLabels.add(lower);
    if (v.id !== slugify(v.label)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Variant id must be the slug of its label', path: ['variants'] });
      return;
    }
    if (seenIds.has(v.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Variant ids must be unique', path: ['variants'] });
      return;
    }
    seenIds.add(v.id);
  }
});

const imageHttpsUrl = z
  .string()
  .trim()
  .max(500, 'Image URL must be at most 500 characters')
  .refine((v) => v.startsWith('https://'), 'Image URL must start with https://')
  .refine((v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }, 'Must be a valid URL');

export const imageUrlsSchema = z
  .array(imageHttpsUrl)
  .min(MIN_IMAGES, `At least ${MIN_IMAGES} images are required`)
  .max(MAX_IMAGES, `At most ${MAX_IMAGES} images are allowed`)
  .refine((urls) => new Set(urls.map((u) => u.trim())).size === urls.length, 'Duplicate image URLs are not allowed');

const productBaseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  price_paise: z.number().int('Price must be an integer').positive('Price must be positive'),
  stock_status: z.enum(['in_stock', 'out_of_stock']),
  image_url: z.string().url('Must be a valid URL').max(2048),
  imageUrls: imageUrlsSchema,
  active: z.boolean(),
  saleMode: saleModeSchema.default('buy'),
  preorderLimit: z.number().int().positive().nullable().default(null),
  mrpPaise: z.number().int().positive().nullable().default(null),
  variantLabel: z.string().min(1, 'Variant label is required').max(20, 'Variant label must be 1-20 characters').default('Size'),
  variants: variantsSchema.default([]),
});

const mrpNotBelowPrice = (product: { price_paise: number; mrpPaise: number | null }, ctx: z.RefinementCtx) => {
  if (product.mrpPaise !== null && product.mrpPaise < product.price_paise) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MRP_BELOW_PRICE_MESSAGE, path: ['mrpPaise'] });
  }
};

export const productInputSchema = productBaseSchema.superRefine(mrpNotBelowPrice);

export const productUpdateInputSchema = productBaseSchema.extend({
  imageUrls: z
    .array(imageHttpsUrl)
    .max(MAX_IMAGES, `At most ${MAX_IMAGES} images are allowed`)
    .refine((urls) => new Set(urls.map((u) => u.trim())).size === urls.length, 'Duplicate image URLs are not allowed'),
}).superRefine(mrpNotBelowPrice);

export const setStatusInputSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  stock_status: z.enum(['in_stock', 'out_of_stock']).optional(),
  active: z.boolean().optional(),
  sale_mode: saleModeSchema.optional(),
}).refine((data) => data.stock_status !== undefined || data.active !== undefined || data.sale_mode !== undefined, 'At least one field is required for SET_STATUS');

export const mutateRequestSchema = z.object({
  action: z.enum(['ADD', 'UPDATE', 'DELETE', 'SET_STATUS']),
  product: productInputSchema.optional(),
  productId: z.string().optional(),
  setStatus: setStatusInputSchema.optional(),
}).superRefine((data, ctx) => {
  if ((data.action === 'ADD' || data.action === 'UPDATE') && !data.product) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Product is required for ADD and UPDATE actions',
      path: ['product'],
    });
  }
  if (data.action === 'UPDATE' && data.product && !data.product.id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Product id is required for UPDATE action',
      path: ['product', 'id'],
    });
  }
  if (data.action === 'DELETE' && !data.productId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'productId is required for DELETE action',
      path: ['productId'],
    });
  }
  if (data.action === 'SET_STATUS' && !data.setStatus) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'setStatus is required for SET_STATUS action',
      path: ['setStatus'],
    });
  }
});

export const adminActionSchema = z.enum(['approve_admin', 'revoke_admin', 'delete_admin_user', 'request_admin']);

export const adminActionRequestSchema = z.object({
  action: adminActionSchema,
  targetUserId: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.action !== 'request_admin' && !data.targetUserId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'targetUserId is required for this action',
      path: ['targetUserId'],
    });
  }
});

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  nameSnapshot: z.string().min(1, 'Name snapshot is required'),
  pricePaiseSnapshot: z.number().int().positive('Price must be positive'),
  quantity: z.number().int().positive('Quantity must be positive').max(10, 'Max 10 per item'),
  variantId: z.string().optional(),
});

export const orderInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  totalPaise: z.number().int().positive('Total must be positive'),
  shippingName: z.string().max(200).optional(),
  shippingPhone: z.string().max(20).optional(),
  shippingAltPhone: z.string().max(20).optional(),
  shippingAddress: z.string().max(2000).optional(),
  items: z.array(orderItemInputSchema).min(1, 'At least one item is required'),
});

export const indianMobileSchema = z
  .string()
  .min(1, 'Phone is required')
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => {
    let s = v;
    if (s.startsWith('+91')) s = s.slice(3);
    else if (s.startsWith('0')) s = s.slice(1);
    return /^[6-9]\d{9}$/.test(s);
  }, 'Enter a valid 10-digit Indian mobile number (starts with 6-9)');

export const pincodeSchema = z
  .string()
  .min(1, 'Pincode is required')
  .transform((v) => v.replace(/\s+/g, ''))
  .refine((v) => /^\d{6}$/.test(v), 'Pincode must be exactly 6 digits');

export const checkoutRequestSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().min(1, 'Min 1 per item').max(10, 'Max 10 per item'),
    variantId: z.string().optional(),
  })).min(1, 'Cart is empty'),
  shipping: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    phone: indianMobileSchema,
    altPhone: z.string().max(20).optional(),
    address: z.string().min(1, 'Address is required').max(2000),
  }),
  paymentMethod: z.enum(['online', 'cod']).optional(),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  reason: z.string().max(500).optional(),
});

export const updateShippingSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  name: z.string().min(1, 'Name is required').max(200),
  phone: indianMobileSchema,
  altPhone: z.string().max(20).optional(),
  address: z.string().min(1, 'Address is required').max(2000),
  deliveryMode: z.string().optional(),
});

export const addressInputSchema = z.object({
  label: z.string().min(1, 'Label is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  phone: indianMobileSchema,
  altPhone: z.string().max(20).optional(),
  address_line: z.string().min(1, 'Address is required').max(2000),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  pincode: pincodeSchema,
  is_default: z.boolean().optional(),
});

export const preorderRegisterSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(5),
  phone: indianMobileSchema,
  altPhone: z.string().max(20).optional(),
  note: z.string().max(1000).optional(),
});

export const preorderCancelSchema = z.object({
  preorderId: z.string().min(1),
});

export const profileInputSchema = z.object({
  display_name: z.string().max(200).optional(),
  phone: indianMobileSchema.optional(),
  alt_phone: z.string().max(20).optional(),
});
