import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { ProfileForm } from '@/components/settings/ProfileForm';

export const metadata = {
  title: 'Profile Settings',
  description: 'Edit your profile information',
};

export default function ProfileSettingsPage() {
  return (
    <div className="container py-8">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Profile Information</h2>
            <p className="text-muted-foreground mb-6">Update your personal information</p>
          </div>
          <ProfileForm />
        </div>
      </SettingsLayout>
    </div>
  );
}
