import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth';

export default function Index() {
  const user = useAuthStore((state) => state.user);

  if (user) {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/welcome" />;
}
