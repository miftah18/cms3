'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Profile', href: '/settings/profile' },
    { label: 'Account', href: '/settings/account' },
    { label: 'Sessions', href: '/settings/sessions' },
    { label: 'Activity', href: '/settings/activity' },
    { label: 'Preferences', href: '/settings/preferences' },
  ];

  return (
    <div className="flex gap-6">
      <nav className="w-48">
        <div className="space-y-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 rounded-lg transition-colors ${
                pathname === item.href
                  ? 'bg-primary text-white'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
