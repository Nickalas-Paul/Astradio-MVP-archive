import dynamic from 'next/dynamic';

const CommunityClient = dynamic(
  () => import('./CommunityClient').then((m) => m.default),
  { ssr: false, loading: () => <div className="min-h-screen bg-bg flex items-center justify-center text-text-secondary">Loading Community…</div> }
);

export default function CommunityPage() {
  return <CommunityClient />;
}
