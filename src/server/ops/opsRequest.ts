import { cookies } from 'next/headers';
import { OPS_SESSION_COOKIE, verifyOpsSessionValue } from './opsAuth';

export async function hasOpsSession(): Promise<boolean> {
  const store = await cookies();
  return verifyOpsSessionValue(store.get(OPS_SESSION_COOKIE)?.value);
}
