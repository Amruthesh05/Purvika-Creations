import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, MapPin, Plus, Trash2, Check, Star, Pencil } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { EmptyState, ErrorState } from '@/components/States';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiFetch, apiPost, ApiError } from '@/lib/api';
import { classNames } from '@/lib/utils';
import type { User, Address, AddressInput } from '@/lib/types';

interface AccountPageProps {
  user: User | null | undefined;
}

type Tab = 'profile' | 'addresses';

const emptyAddressForm: AddressInput = {
  label: '',
  name: '',
  phone: '',
  alt_phone: '',
  address_line: '',
  city: '',
  state: '',
  pincode: '',
  is_default: false,
};

export function AccountPage({ user }: AccountPageProps) {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '', alt_phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressInput>(emptyAddressForm);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [defaultLoading, setDefaultLoading] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const d = (await apiFetch('/api/account/profile')) as { user: User };
      setProfile(d.user);
      setProfileForm({
        display_name: d.user.display_name ?? '',
        phone: d.user.phone ?? '',
        alt_phone: d.user.alt_phone ?? '',
      });
    } catch {
      setProfileError('Failed to load your profile.');
    }
  }, [user]);

  const loadAddresses = useCallback(async () => {
    if (!user) {
      setAddressesLoading(false);
      return;
    }
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      const d = (await apiFetch('/api/account/addresses')) as { addresses: Address[] };
      setAddresses(d.addresses ?? []);
    } catch {
      setAddressesError('Failed to load saved addresses.');
    } finally {
      setAddressesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
    loadAddresses();
  }, [loadProfile, loadAddresses]);

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    setProfileError(null);
    setProfileSaved(false);
    try {
      await apiPost('/api/account/profile', {
        display_name: profileForm.display_name || undefined,
        phone: profileForm.phone || undefined,
        alt_phone: profileForm.alt_phone || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_failed') {
        setProfileError('Please check the phone number format.');
      } else {
        setProfileError('Could not save your profile. Please try again.');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm);
    setAddressError(null);
    setShowAddressForm(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      label: addr.label,
      name: addr.name,
      phone: addr.phone,
      alt_phone: addr.alt_phone ?? '',
      address_line: addr.address_line,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      is_default: addr.is_default,
    });
    setAddressError(null);
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    setAddressSaving(true);
    setAddressError(null);
    try {
      const payload: AddressInput = { ...addressForm };
      if (editingAddressId) {
        await apiFetch(`/api/account/addresses?id=${editingAddressId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiPost('/api/account/addresses', payload);
      }
      await loadAddresses();
      setShowAddressForm(false);
      setEditingAddressId(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'max_addresses_reached') {
          setAddressError('You can save at most 5 addresses. Please delete one first.');
        } else if (err.code === 'validation_failed') {
          setAddressError('Please check the details — phone must be 10 digits starting 6-9, pincode must be 6 digits.');
        } else {
          setAddressError('Could not save the address. Please try again.');
        }
      } else {
        setAddressError('Could not save the address.');
      }
    } finally {
      setAddressSaving(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/account/addresses?id=${deleteTarget.id}`, { method: 'DELETE' });
      await loadAddresses();
      setDeleteTarget(null);
    } catch {
      setAddressesError('Could not delete the address.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    setDefaultLoading(addrId);
    try {
      await apiPost('/api/account/addresses?action=default', { addressId: addrId });
      await loadAddresses();
    } catch {
      setAddressesError('Could not set the default address.');
    } finally {
      setDefaultLoading(null);
    }
  };

  if (user === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex min-h-[200px] items-center justify-center">
            <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="mb-2 text-xl font-bold text-gray-900">Sign in to view your account</h1>
            <Link to="/login?return=/account" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
              Go to sign in
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">My Account</h1>

        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab('profile')}
            className={classNames(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <UserIcon className="h-4 w-4" /> Profile
          </button>
          <button
            onClick={() => setTab('addresses')}
            className={classNames(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === 'addresses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <MapPin className="h-4 w-4" /> Saved addresses
            {addresses.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{addresses.length}</span>
            )}
          </button>
        </div>

        {tab === 'profile' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Profile details</h2>
            <p className="mb-4 text-sm text-gray-500">Signed in as <span className="font-medium text-gray-700">{user.email}</span></p>
            {profileError && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{profileError}</p>}
            {profileSaved && <p className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">Profile saved.</p>}
            <div className="space-y-4">
              <Field label="Display name" name="display_name" value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} />
              <Field label="Phone number" name="phone" type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
              <Field label="Alternate phone" name="alt_phone" type="tel" value={profileForm.alt_phone} onChange={(e) => setProfileForm({ ...profileForm, alt_phone: e.target.value })} />
            </div>
            <div className="mt-5">
              <Button onClick={handleSaveProfile} loading={profileLoading}>Save profile</Button>
            </div>
          </div>
        )}

        {tab === 'addresses' && (
          <div className="space-y-4">
            {addressesError && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{addressesError}</p>}

            {addressesLoading ? (
              <div className="flex min-h-[100px] items-center justify-center">
                <svg className="h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : addresses.length === 0 && !showAddressForm ? (
              <EmptyState message="You have no saved addresses yet." />
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{addr.label}</span>
                          {addr.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              <Star className="h-3 w-3" /> Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{addr.name} · {addr.phone}</p>
                        <p className="text-sm text-gray-500">{addr.address_line}, {addr.city}, {addr.state} - {addr.pincode}</p>
                        {addr.alt_phone && <p className="text-xs text-gray-400">Alt: {addr.alt_phone}</p>}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {!addr.is_default && (
                          <button
                            onClick={() => handleSetDefault(addr.id)}
                            disabled={defaultLoading === addr.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" /> Set default
                          </button>
                        )}
                        <button
                          onClick={() => openEditAddress(addr)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(addr)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddressForm ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-gray-900">{editingAddressId ? 'Edit address' : 'Add address'}</h2>
                {addressError && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{addressError}</p>}
                <div className="space-y-3">
                  <Field label="Label (e.g. Home, Office)" name="label" value={addressForm.label} onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })} required />
                  <Field label="Full name" name="name" value={addressForm.name} onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })} required />
                  <Field label="Phone number" name="phone" type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} required />
                  <Field label="Alternate phone (optional)" name="alt_phone" type="tel" value={addressForm.alt_phone ?? ''} onChange={(e) => setAddressForm({ ...addressForm, alt_phone: e.target.value })} />
                  <Field label="Address line" name="address_line" type="textarea" value={addressForm.address_line} onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })} required />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" name="city" value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required />
                    <Field label="State" name="state" value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} required />
                  </div>
                  <Field label="Pincode" name="pincode" value={addressForm.pincode} onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })} required />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={addressForm.is_default ?? false} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    Set as default address
                  </label>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => { setShowAddressForm(false); setEditingAddressId(null); }} disabled={addressSaving}>Cancel</Button>
                  <Button onClick={handleSaveAddress} loading={addressSaving}>{editingAddressId ? 'Update' : 'Add'}</Button>
                </div>
              </div>
            ) : (
              addresses.length < 5 && (
                <Button variant="secondary" onClick={openAddAddress} className="w-full">
                  <Plus className="h-4 w-4" /> Add address
                </Button>
              )
            )}
          </div>
        )}
      </main>
      <Footer />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this address?"
        message={deleteTarget ? `This will remove "${deleteTarget.label}" from your saved addresses.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDeleteAddress}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
