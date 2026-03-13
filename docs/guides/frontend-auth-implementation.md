# Frontend Authentication & User Management Implementation

## Overview

This guide covers the complete authentication and user management system implemented in the frontend application.

## Architecture

### Components & Hooks

The authentication system is built using custom React hooks and reusable components:

#### Custom Hooks (lib/hooks/)

1. **useAuth** - Core authentication state and operations
   - Login/logout functionality
   - Token management
   - User state persistence
   - Device detection

2. **useProfile** - User profile management
   - Fetch user profile
   - Update profile information
   - Error handling

3. **useSession** - Active session management
   - Fetch all active sessions
   - Revoke individual sessions
   - Revoke all other sessions

4. **useActivityLog** - User activity tracking
   - Fetch activity logs with pagination
   - Filter by action/resource
   - Delete activity records

5. **usePermissions** - Role-based access control
   - Check individual permissions
   - Check multiple permissions (any/all)
   - Pre-defined permission constants
   - Role-based shortcuts

6. **usePasswordChange** - Password management
   - Change password with validation
   - Reset password request
   - Password strength validation

### Settings Components (components/settings/)

1. **SettingsLayout** - Navigation layout for all settings pages
2. **ProfileCard** - Display user profile information
3. **ProfileForm** - Edit profile (name, phone, avatar)
4. **SessionsList** - View and manage active sessions
5. **ActivityTable** - Display activity log with pagination
6. **PasswordForm** - Change password with validation

### Pages (app/(dashboard)/settings/)

- `/settings` - Settings overview
- `/settings/profile` - Edit profile information
- `/settings/account` - Change password
- `/settings/sessions` - Manage active sessions
- `/settings/activity` - View activity log

## Usage Examples

### Using useAuth

```typescript
import { useAuth } from '@/lib/hooks/useAuth';

export function MyComponent() {
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div>
      {user && <p>Hello, {user.name}</p>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Using usePermissions

```typescript
import { usePermissions, PERMISSIONS } from '@/lib/hooks/usePermissions';

export function AdminPanel() {
  const { hasPermission, canViewUsers, canEditSettings } = usePermissions();

  if (!hasPermission(PERMISSIONS.VIEW_USERS)) {
    return <div>You don't have access to this page</div>;
  }

  return (
    <div>
      {canViewUsers && <UsersList />}
      {canEditSettings && <SettingsPanel />}
    </div>
  );
}
```

### Using useSession

```typescript
import { useSession } from '@/lib/hooks/useSession';

export function SessionManager() {
  const { sessions, revokeSession } = useSession();

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id}>
          <p>{session.device}</p>
          <button onClick={() => revokeSession(session.id)}>
            Revoke
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Security Features

### Password Validation

Passwords are validated to ensure strength:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

### Token Management

- JWT tokens are stored securely in httpOnly cookies
- Refresh token rotation on each request
- Automatic token refresh before expiration
- Token blacklisting on logout

### Session Management

- Multi-device session tracking
- Ability to revoke individual sessions
- Ability to revoke all other sessions
- IP and user agent tracking

### Activity Logging

- All actions are logged with timestamps
- IP address and user agent captured
- Success/failure status tracking
- Detailed change tracking for updates

## API Integration

The frontend communicates with the backend through these endpoints:

### Authentication
- `POST /api/v1/auth/login/` - Login
- `POST /api/v1/auth/logout/` - Logout
- `POST /api/v1/auth/refresh/` - Refresh token
- `POST /api/v1/auth/change-password/` - Change password

### Profile
- `GET /api/v1/users/{id}/` - Get user profile
- `PATCH /api/v1/users/{id}/` - Update profile

### Sessions
- `GET /api/v1/sessions/` - List sessions
- `DELETE /api/v1/sessions/{id}/` - Revoke session
- `POST /api/v1/sessions/revoke-all-other/` - Revoke all other

### Activity
- `GET /api/v1/activity-logs/` - List activity logs
- `DELETE /api/v1/activity-logs/{id}/` - Delete log entry

## Testing

### Testing useAuth Hook

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/LoginForm';

test('should login successfully', async () => {
  render(<LoginForm />);
  
  await userEvent.type(screen.getByPlaceholderText('Email'), 'user@example.com');
  await userEvent.type(screen.getByPlaceholderText('Password'), 'password123');
  await userEvent.click(screen.getByText('Login'));
  
  await waitFor(() => {
    expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
  });
});
```

### Testing usePermissions Hook

```typescript
import { renderHook } from '@testing-library/react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/authStore';

test('should check permissions correctly', () => {
  // Mock the auth store
  useAuthStore.setState({
    user: {
      id: '1',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [],
    },
  });

  const { result } = renderHook(() => usePermissions());
  
  expect(result.current.hasPermission('any.permission')).toBe(true);
});
```

## Error Handling

All hooks include comprehensive error handling:

```typescript
const { data, loading, error } = useProfile();

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
return <ProfileDisplay data={data} />;
```

## Performance Optimization

### Memoization

Hooks use `useCallback` to prevent unnecessary re-renders:

```typescript
const fetchProfile = useCallback(async () => {
  // Only recreated when dependencies change
}, [user?.id]);
```

### State Management

Zustand store for global authentication state:
- Prevents prop drilling
- Efficient updates
- Persistence support

## Migration Guide

### From Class Components

```typescript
// Old
class ProfilePage extends React.Component {
  componentDidMount() {
    this.fetchProfile();
  }
}

// New
export default function ProfilePage() {
  const { profile, fetchProfile } = useProfile();
  
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
}
```

## Best Practices

1. **Always check isLoading state before rendering data**
2. **Handle errors gracefully with user-friendly messages**
3. **Use usePermissions for access control, not role checks**
4. **Revoke sessions after suspicious activity**
5. **Validate passwords before submission**
6. **Keep sensitive data in httpOnly cookies only**

## Troubleshooting

### "Failed to fetch profile"
- Check API endpoint is correct
- Verify authentication token is valid
- Check CORS configuration

### "Permission denied"
- Verify user role and permissions in backend
- Check permission constants match backend
- Clear browser cache and login again

### "Session already exists"
- User is already logged in on another device
- Use revoke other sessions feature
- Or logout from other devices manually
