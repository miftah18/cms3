import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { ProfileCard } from '@/components/settings/ProfileCard';

export const metadata = {
  title: 'Settings',
  description: 'Manage your account settings',
};

export default function SettingsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Settings</h1>
      <SettingsLayout>
        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Profile Overview</h2>
            <ProfileCard />
          </section>
        </div>
      </SettingsLayout>
    </div>
  );
}
