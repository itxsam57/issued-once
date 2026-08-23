import { OwnerOsConsole } from '@/components/ops/OwnerOsConsole';
import { OpsLogin } from '@/components/ops/OpsLogin';
import { hasOpsSession } from '@/server/ops/opsRequest';

export const dynamic = 'force-dynamic';

export default async function OpsPage() {
  const authenticated = await hasOpsSession();
  return authenticated ? <OwnerOsConsole /> : <OpsLogin />;
}
