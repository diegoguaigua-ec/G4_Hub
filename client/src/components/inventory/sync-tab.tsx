import SyncLogsSection from "@/components/dashboard/sync-logs-section";

interface SyncTabProps {
  storeId: number;
}

export function SyncTab({ storeId }: SyncTabProps) {
  return (
    <div className="space-y-4">
      <SyncLogsSection storeId={storeId} />
    </div>
  );
}
