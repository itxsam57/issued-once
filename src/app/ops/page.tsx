import { OpsConsole } from '@/components/ops/OpsConsole';
import { OpsLogin } from '@/components/ops/OpsLogin';
import { hasOpsSession } from '@/server/ops/opsRequest';

export const dynamic = 'force-dynamic';

export default async function OpsPage() {
  const authenticated = await hasOpsSession();
  return authenticated ? <OpsConsole /> : <OpsLogin />;
}
