import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../lib/password';

describe('password utilities', () => {
  it('hashes a password and verifies it correctly', async () => {
    const raw = 'MyS3cureP@ss!';
    const hash = await hashPassword(raw);

    // Hash should be a bcrypt string
    expect(hash).toMatch(/^\$2[aby]?\$/);

    // Comparison should succeed with the correct password
    expect(await comparePassword(raw, hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });

  it('generates different hashes for the same input (salted)', async () => {
    const raw = 'same-password';
    const h1 = await hashPassword(raw);
    const h2 = await hashPassword(raw);
    expect(h1).not.toBe(h2);
    // But both should still verify
    expect(await comparePassword(raw, h1)).toBe(true);
    expect(await comparePassword(raw, h2)).toBe(true);
  });
});
