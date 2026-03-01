import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-neutral-900/80 px-4 text-sm text-neutral-100 transition-all duration-200 backdrop-blur-sm',
            'placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:shadow-[0_0_16px_rgba(139,92,246,0.15)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-red-500/50 focus:ring-red-500 focus:shadow-[0_0_16px_rgba(239,68,68,0.15)]'
              : 'border-neutral-800/80 hover:border-neutral-700',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
