'use client';

interface HashtagTextProps {
  text: string;
  onTagClick: (tag: string) => void;
}

export function HashtagText({ text, onTagClick }: HashtagTextProps) {
  const parts = text.split(/(#[a-zA-Z0-9_]{1,30})/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('#') ? (
          <button
            key={i}
            type="button"
            onClick={() => onTagClick(part.slice(1).toLowerCase())}
            className="text-accent hover:underline font-medium"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
