import { IssueStatusView } from '@/components/experience/IssueStatusView';
import { PublicUtilityHeader } from '@/components/public/PublicUtilityHeader';

export default function IssuePage() {
  return (
    <>
      <PublicUtilityHeader center="ISSUE / STATUS" />
      <main className="public-interview public-interview--headered">
        <IssueStatusView />
      </main>
    </>
  );
}
