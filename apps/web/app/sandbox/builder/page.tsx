import { redirect } from 'next/navigation';

/**
 * Phase 6: /sandbox is the single canonical lab. Builder redirects to it.
 */
export default function SandboxBuilderPage() {
  redirect('/sandbox');
}
