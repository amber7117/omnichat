import { PortalHeader, PortalControls, PortalLogs, PortalStatus } from '../components';
import { usePortal } from '../hooks/use-portal';

export function PortalPage() {
  const { status } = usePortal();

  return (
    <div className="portal-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <PortalHeader />
      <PortalStatus status={status} />
      <PortalControls />
      <PortalLogs />
    </div>
  );
} 