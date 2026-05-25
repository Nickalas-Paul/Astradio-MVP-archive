import { redirect } from 'next/navigation';

/** MVP: library lives on Profile tab (post-beta may add /community/saved). */
export default function LibraryRedirect() {
  redirect('/profile?tab=library');
}
