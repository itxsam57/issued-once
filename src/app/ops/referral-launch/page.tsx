import { OpsLogin } from '@/components/ops/OpsLogin';
import { ReferralLaunchControl } from '@/components/ops/ReferralLaunchControl';
import { hasOpsSession } from '@/server/ops/opsRequest';

export const dynamic = 'force-dynamic';

export default async function ReferralLaunchPage() {
  const authenticated = await hasOpsSession();
  return authenticated ? <ReferralLaunchControl /> : <OpsLogin />;
}
