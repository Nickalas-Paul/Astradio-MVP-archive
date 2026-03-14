export default function LoginPage() {
  // Legacy /login route: redirect to canonical profile entry point.
  if (typeof window !== 'undefined') {
    window.location.replace('/profile');
  }
  return null;
}
