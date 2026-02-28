'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onError?: (message: string) => void;
}

export function GoogleSignInButton({ text = 'continue_with', onError }: GoogleSignInButtonProps) {
  const router = useRouter();
  const { oauthLogin } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      try {
        await oauthLogin(response.credential, 'google');
        router.push('/dashboard');
      } catch (err) {
        if (err instanceof ApiError) {
          onError?.(err.message);
        } else {
          onError?.('Google sign-in failed. Please try again.');
        }
      }
    },
    [oauthLogin, router, onError],
  );

  useEffect(() => {
    if (!clientId || initializedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || !buttonRef.current) return;
      initializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        text,
        shape: 'pill',
        width: buttonRef.current.offsetWidth,
      });
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: only remove script if we added it
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [clientId, handleCredentialResponse, text]);

  if (!clientId) return null;

  return (
    <div
      ref={buttonRef}
      className="w-full flex items-center justify-center min-h-[44px]"
    />
  );
}
