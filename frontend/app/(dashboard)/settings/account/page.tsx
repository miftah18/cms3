import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { PasswordForm } from '@/components/settings/PasswordForm';

export const metadata = {
  title: 'Account Settings',
  description: 'Manage your account security',
};

export default function AccountSettingsPage() {
  return (
    <div className="container py-8">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">Account Security</h2>
            <p className="text-muted-foreground mb-6">Change your password and manage security settings</p>
          </div>
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-4">Change Password</h3>
            <PasswordForm />
          </section>
        </div>
      </SettingsLayout>
    </div>
  );
}
