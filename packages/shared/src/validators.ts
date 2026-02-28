// ──────────────────────────────────────────────
// Pure validation functions — no external deps
// Designed for reuse on web, backend, and mobile
// ──────────────────────────────────────────────

import { USERNAME, PASSWORD, SEARCH, RATING, LIBRARY, PAGINATION } from './constants';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

// ── Email ───────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') return fail('Email is required');
  if (!EMAIL_REGEX.test(email.trim())) return fail('Invalid email address');
  return ok();
}

// ── Username ────────────────────────────────

export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== 'string') return fail('Username is required');
  const trimmed = username.trim();
  const errors: string[] = [];

  if (trimmed.length < USERNAME.MIN_LENGTH) {
    errors.push(`Username must be at least ${USERNAME.MIN_LENGTH} characters`);
  }
  if (trimmed.length > USERNAME.MAX_LENGTH) {
    errors.push(`Username must be at most ${USERNAME.MAX_LENGTH} characters`);
  }
  if (!USERNAME.PATTERN.test(trimmed)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }
  return errors.length ? fail(...errors) : ok();
}

// ── Password ────────────────────────────────

export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') return fail('Password is required');
  const errors: string[] = [];

  if (password.length < PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD.MIN_LENGTH} characters`);
  }
  if (password.length > PASSWORD.MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD.MAX_LENGTH} characters`);
  }
  return errors.length ? fail(...errors) : ok();
}

// ── Signup ───────────────────────────────────

export function validateSignup(data: {
  email: string;
  username: string;
  password: string;
}): ValidationResult {
  const results = [
    validateEmail(data.email),
    validateUsername(data.username),
    validatePassword(data.password),
  ];
  const errors = results.flatMap((r) => r.errors);
  return errors.length ? fail(...errors) : ok();
}

// ── Library ──────────────────────────────────

export function validateLibraryName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') return fail('Library name is required');
  const trimmed = name.trim();
  if (trimmed.length === 0) return fail('Library name cannot be empty');
  if (trimmed.length > LIBRARY.MAX_NAME_LENGTH) {
    return fail(`Library name must be at most ${LIBRARY.MAX_NAME_LENGTH} characters`);
  }
  return ok();
}

// ── Rating ───────────────────────────────────

export function validateRating(rating: number): ValidationResult {
  if (typeof rating !== 'number' || isNaN(rating)) return fail('Rating must be a number');
  if (rating < RATING.MIN || rating > RATING.MAX) {
    return fail(`Rating must be between ${RATING.MIN} and ${RATING.MAX}`);
  }
  return ok();
}

// ── Search ───────────────────────────────────

export function validateSearchQuery(query: string): ValidationResult {
  if (!query || typeof query !== 'string') return fail('Search query is required');
  const trimmed = query.trim();
  if (trimmed.length < SEARCH.MIN_QUERY_LENGTH) {
    return fail(`Search query must be at least ${SEARCH.MIN_QUERY_LENGTH} characters`);
  }
  if (trimmed.length > SEARCH.MAX_QUERY_LENGTH) {
    return fail(`Search query must be at most ${SEARCH.MAX_QUERY_LENGTH} characters`);
  }
  return ok();
}

// ── Pagination ───────────────────────────────

export function clampPagination(page?: number, pageSize?: number) {
  return {
    page: Math.max(1, page ?? PAGINATION.DEFAULT_PAGE),
    pageSize: Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(1, pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE),
    ),
  };
}
