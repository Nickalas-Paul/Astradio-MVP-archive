'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function LibraryRedirect() {
  useEffect(() => {
    redirect('/community/saved');
  }, []);

  return null;
}