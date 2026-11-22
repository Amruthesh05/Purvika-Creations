import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { indianMobileSchema, pincodeSchema, addressInputSchema } from '@/lib/validation';
import type { AddressInput } from '@/lib/types';

function makeAddressInput(label = 'Home', is_default?: boolean): AddressInput {
  return {
    label,
    name: 'John Doe',
    phone: '9876543210',
    alt_phone: null,
    address_line: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    is_default,
  };
}

describe('saved addresses — 5-address limit', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('allows creating up to 5 addresses', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.createAddress('u1', makeAddressInput(`Addr ${i}`));
    }
    const count = await repo.getAddressCount('u1');
    expect(count).toBe(5);
  });

  it('refuses creating a 6th address', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.createAddress('u1', makeAddressInput(`Addr ${i}`));
    }
    await expect(repo.createAddress('u1', makeAddressInput('Sixth'))).rejects.toThrow('Maximum of 5 addresses allowed');
  });
});

describe('saved addresses — ownership / no cross-user access', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('listAddresses returns only the user own addresses', async () => {
    await repo.createAddress('u1', makeAddressInput('Home'));
    await repo.createAddress('u2', makeAddressInput('Other'));
    const u1Addresses = await repo.listAddresses('u1');
    expect(u1Addresses).toHaveLength(1);
    expect(u1Addresses[0].label).toBe('Home');
  });

  it('updateAddress refuses to update another user address', async () => {
    const addr = await repo.createAddress('u1', makeAddressInput('Home'));
    await expect(repo.updateAddress(addr.id, 'u2', makeAddressInput('Hacked'))).rejects.toThrow('Address not found');
  });

  it('deleteAddress does not delete another user address', async () => {
    const addr = await repo.createAddress('u1', makeAddressInput('Home'));
    await repo.deleteAddress(addr.id, 'u2');
    const list = await repo.listAddresses('u1');
    expect(list).toHaveLength(1);
  });

  it('setDefaultAddress refuses for another user address', async () => {
    const addr = await repo.createAddress('u1', makeAddressInput('Home'));
    await expect(repo.setDefaultAddress(addr.id, 'u2')).rejects.toThrow('Address not found');
  });
});

describe('saved addresses — one default at a time', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('setting a new default clears the previous default', async () => {
    const a1 = await repo.createAddress('u1', makeAddressInput('Home', true));
    const a2 = await repo.createAddress('u1', makeAddressInput('Office', true));
    const list = await repo.listAddresses('u1');
    const defaults = list.filter((a) => a.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(a2.id);
    expect(list.find((a) => a.id === a1.id)!.is_default).toBe(false);
  });

  it('setDefaultAddress makes only one address the default', async () => {
    const a1 = await repo.createAddress('u1', makeAddressInput('Home', true));
    const a2 = await repo.createAddress('u1', makeAddressInput('Office'));
    await repo.setDefaultAddress(a2.id, 'u1');
    const list = await repo.listAddresses('u1');
    const defaults = list.filter((a) => a.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(a2.id);
  });
});

describe('saved addresses — first address becomes default', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('first address becomes default when is_default is set', async () => {
    const input = makeAddressInput('Home');
    input.is_default = true;
    const addr = await repo.createAddress('u1', input);
    expect(addr.is_default).toBe(true);
  });

  it('second address is not default by default', async () => {
    await repo.createAddress('u1', makeAddressInput('Home', true));
    const second = await repo.createAddress('u1', makeAddressInput('Office'));
    expect(second.is_default).toBe(false);
  });
});

describe('validators — Indian mobile', () => {
  it('accepts a valid 10-digit number starting with 6-9', () => {
    expect(indianMobileSchema.safeParse('9876543210').success).toBe(true);
  });

  it('accepts +91 prefix', () => {
    expect(indianMobileSchema.safeParse('+919876543210').success).toBe(true);
  });

  it('accepts leading 0', () => {
    expect(indianMobileSchema.safeParse('09876543210').success).toBe(true);
  });

  it('rejects a number starting with 5', () => {
    expect(indianMobileSchema.safeParse('5876543210').success).toBe(false);
  });

  it('rejects an 8-digit number', () => {
    expect(indianMobileSchema.safeParse('98765432').success).toBe(false);
  });
});

describe('validators — pincode', () => {
  it('accepts a 6-digit pincode', () => {
    expect(pincodeSchema.safeParse('400001').success).toBe(true);
  });

  it('rejects a 5-digit pincode', () => {
    expect(pincodeSchema.safeParse('40001').success).toBe(false);
  });

  it('rejects letters', () => {
    expect(pincodeSchema.safeParse('40AB01').success).toBe(false);
  });
});

describe('addressInputSchema', () => {
  it('accepts a valid address input', () => {
    const r = addressInputSchema.safeParse(makeAddressInput('Home'));
    expect(r.success).toBe(true);
  });

  it('rejects missing label', () => {
    const input = makeAddressInput('Home');
    delete (input as Partial<AddressInput>).label;
    expect(addressInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid phone', () => {
    const input = makeAddressInput('Home');
    input.phone = '12345';
    expect(addressInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects invalid pincode', () => {
    const input = makeAddressInput('Home');
    input.pincode = 'abc';
    expect(addressInputSchema.safeParse(input).success).toBe(false);
  });
});
