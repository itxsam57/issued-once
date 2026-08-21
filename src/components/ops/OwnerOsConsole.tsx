'use client';

import { useState } from 'react';
import { AttentionPanel } from './AttentionPanel';
import { AuditPanel } from './AuditPanel';
import { CustomersPanel } from './CustomersPanel';
import { DesignerPanel } from './DesignerPanel';
import { HomePanel } from './HomePanel';
import { IssuesPanel } from './IssuesPanel';
import { ManufacturingPanel } from './ManufacturingPanel';
import { OwnerOsShell, type OwnerOsSection } from './OwnerOsShell';
import { ReferralsPanel } from './ReferralsPanel';
import { SalesPanel } from './SalesPanel';
import { SupportPanel } from './SupportPanel';
import { SystemPanel } from './SystemPanel';
import { WebsitePanel } from './WebsitePanel';

export function OwnerOsConsole() {
  const [active, setActive] = useState<OwnerOsSection>('Home');

  async function logout() {
    await fetch('/ops/api/session', { method: 'DELETE' }).catch(() => null);
    window.location.reload();
  }

  let content;
  switch (active) {
    case 'Home': content = <><AttentionPanel onNavigate={setActive} /><HomePanel /></>; break;
    case 'Issues': content = <IssuesPanel />; break;
    case 'Designer': content = <DesignerPanel />; break;
    case 'Manufacturing': content = <ManufacturingPanel />; break;
    case 'Sales': content = <SalesPanel />; break;
    case 'Referrals': content = <ReferralsPanel />; break;
    case 'Customers': content = <CustomersPanel />; break;
    case 'Support': content = <SupportPanel />; break;
    case 'Website': content = <WebsitePanel />; break;
    case 'System': content = <SystemPanel />; break;
    case 'Audit': content = <AuditPanel />; break;
  }

  return <OwnerOsShell active={active} onNavigate={setActive} onLogout={() => void logout()}>{content}</OwnerOsShell>;
}
