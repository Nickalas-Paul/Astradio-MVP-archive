'use client';

import { motion } from 'framer-motion';

interface CalloutProps {
  tone?: 'info' | 'tip' | 'warn' | 'success';
  children: React.ReactNode;
  className?: string;
}

export default function Callout({ tone = 'info', children, className = '' }: CalloutProps) {
  const toneStyles = {
    info: 'border-violet bg-violet/10 text-violet',
    tip: 'border-emerald bg-emerald/10 text-emerald',
    warn: 'border-warning bg-warning/10 text-warning',
    success: 'border-success bg-success/10 text-success'
  };

  const icons = {
    info: '💡',
    tip: '💡',
    warn: '⚠️',
    success: '✅'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-2xl border ${toneStyles[tone]} ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 mt-0.5">{icons[tone]}</span>
        <div className="text-sm leading-6 flex-1">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
