'use client';

interface ExplanationPanelProps {
  composeHash: string;
  text?: string;
  isLoading?: boolean;
  className?: string;
}

export function ExplanationPanel({ composeHash, text, isLoading = false, className = '' }: ExplanationPanelProps) {
  const explanation = text && text.length > 0
    ? text
    : composeHash 
      ? 'Your natal chart combined with today\'s transits creates a unique musical signature. The planetary positions influence the tempo, harmony, and emotional tone of your personalized soundtrack.'
      : 'Loading astrological analysis...';
    
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-zinc-100">Astrological Analysis</h3>
      <div className="prose prose-invert max-w-none">
        <p className="text-zinc-400 leading-relaxed">
          {explanation}
        </p>
      </div>
    </div>
  );
}

export default ExplanationPanel;
