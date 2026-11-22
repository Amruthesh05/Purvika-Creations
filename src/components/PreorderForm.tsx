import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product, User } from '@/lib/types';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';

export function PreorderForm({ product, user }: { product: Product; user: User | null | undefined }) {
  const [form, setForm] = useState({ quantity: '1', phone: user?.phone ?? '', altPhone: '', note: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (product.saleMode === 'preorder_closed') return <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-600">Registrations closed</p>;
  if (!user) return <Link to={`/login?return=/product/${product.id}`} className="inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Sign in to register</Link>;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setLoading(true); setMessage(null); try { await apiPost('/api/preorders/register', { productId: product.id, quantity: Number(form.quantity), phone: form.phone, altPhone: form.altPhone || undefined, note: form.note || undefined }); setMessage('You are registered. We will contact you when it launches.'); } catch { setMessage('Could not register. Please check your details and try again.'); } finally { setLoading(false); } };
  return <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4"><p className="text-sm font-semibold text-gray-900">Register for free</p><p className="text-xs text-gray-500">No payment now. We will contact you when it launches.</p><div className="grid grid-cols-2 gap-3"><Field label="Quantity" name="quantity" type="select" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /><Field label="Phone" name="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div><Field label="Alternate phone (optional)" name="altPhone" type="tel" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} /><Field label="Note (optional)" name="note" type="textarea" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /><Button type="submit" loading={loading}>Register for free</Button>{message && <p className="text-sm text-gray-600">{message}</p>}</form>;
}
