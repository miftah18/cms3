import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { ActivityTable } from '@/components/settings/ActivityTable';

export const metadata = {
  title: 'Activity Log',
  description: 'View your account activity history',
};

export default function ActivityPage() {
  return (
    <div className="container py-8">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Activity Log</h2>
            <p className="text-muted-foreground mb-6">
              Track all actions performed on your account
            </p>
          </div>
          <ActivityTable />
        </div>
      </SettingsLayout>
    </div>
  );
}
