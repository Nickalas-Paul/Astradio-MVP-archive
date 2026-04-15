import { redirect } from 'next/navigation';

/**
 * /sandbox is the single canonical compose lab. Builder redirects to it.
 */
export default function SandboxBuilderPage() {
  redirect('/sandbox');
}
