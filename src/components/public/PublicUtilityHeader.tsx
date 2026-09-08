import { ReferenceHeader } from '@/components/reference/ReferenceHeader';

export function PublicUtilityHeader({ center = 'ISSUE / NOT YET' }: { center?: string }) {
  return <ReferenceHeader center={center} />;
}
