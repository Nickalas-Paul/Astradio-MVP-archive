import { redirect } from 'next/navigation';

/** Beta: composer surface retired; canonical compose is Home + Sandbox. */
export default function ComposerPage() {
  redirect('/');
}
