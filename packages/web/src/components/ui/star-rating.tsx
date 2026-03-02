'use client';

import { useState } from 'react';

interface StarRatingProps {
  /** Current rating value (1-5), or null/0 for unrated */
  value: number | null;
  /** Called when a star is clicked. Passes the new rating, or null if cleared. */
  onChange: (rating: number | null) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the stars are interactive */
  readOnly?: boolean;
}

const sizes = {
  sm: 'text-lg gap-0.5',
  md: 'text-2xl gap-1',
  lg: 'text-3xl gap-1',
};

export function StarRating({ value, onChange, size = 'md', readOnly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const display = hovered ?? (value || 0);

  return (
    <div
      className={`inline-flex items-center ${sizes[size]}`}
      onMouseLeave={() => !readOnly && setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`transition-transform duration-150 select-none ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onClick={() => {
            if (readOnly) return;
            // Clicking the same star clears the rating
            onChange(value === star ? null : star);
          }}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <span
            className={`transition-colors duration-150 ${
              star <= display
                ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]'
                : 'text-neutral-600'
            }`}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

/** Compact inline star display (read-only) for cards/badges */
export function StarDisplay({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-px text-xs">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < value ? 'text-yellow-400' : 'text-neutral-600'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
