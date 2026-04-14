import { redirect } from 'next/navigation';

/** Legacy `/login` — canonical account entry is Profile. */
export default function LoginPage() {
  redirect('/profile');
}
