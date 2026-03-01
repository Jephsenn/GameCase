'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/animations';
import { GoogleSignInButton } from '@/components/auth/google-sign-in';

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      await signup(form.email, form.username, form.password, form.displayName || undefined);
      router.push('/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const errors: Record<string, string> = {};
          for (const [key, messages] of Object.entries(err.details)) {
            errors[key] = messages[0];
          }
          setFieldErrors(errors);
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <FadeIn className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-black tracking-tight">Create your account</h2>
        <p className="text-sm text-neutral-400">
          Start building your game library today.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          error={fieldErrors.email}
          required
          autoComplete="email"
        />

        <Input
          label="Username"
          type="text"
          placeholder="player123"
          value={form.username}
          onChange={(e) => updateField('username', e.target.value)}
          error={fieldErrors.username}
          required
          autoComplete="username"
        />

        <Input
          label="Display Name"
          type="text"
          placeholder="Your display name (optional)"
          value={form.displayName}
          onChange={(e) => updateField('displayName', e.target.value)}
          autoComplete="name"
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => updateField('password', e.target.value)}
          error={fieldErrors.password}
          required
          autoComplete="new-password"
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Create Account
        </Button>
      </form>

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-neutral-950 px-3 text-neutral-500">or continue with</span>
            </div>
          </div>

          <GoogleSignInButton text="signup_with" onError={(msg) => setError(msg)} />
        </>
      )}

      <p className="text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">
          Sign in
        </Link>
      </p>
    </FadeIn>
  );
}
