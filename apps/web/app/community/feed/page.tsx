'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route: feed lives on /community?tab=feed */
export default function CommunityFeedRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/community?tab=feed');
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-text-secondary text-sm">
      Redirecting to Community feed…
    </div>
  );
}
