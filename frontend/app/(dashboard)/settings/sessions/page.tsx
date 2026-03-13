import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SessionsList } from '@/components/settings/SessionsList';

export const metadata = {
  title: 'Active Sessions',
  description: 'Manage your active sessions',
};

export default function SessionsPage() {
  return (
    <div className="container py-8">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Active Sessions</h2>
            <p className="text-muted-foreground mb-6">
              View and manage all devices signed into your account
            </p>
          </div>
          <SessionsList />
        </div>
      </SettingsLayout>
    </div>
  );
}
