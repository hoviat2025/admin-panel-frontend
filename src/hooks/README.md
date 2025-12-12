# Hooks Directory

Contains custom React hooks for reusable logic.

## use-mobile.tsx

Detects if the user is on a mobile device.

```typescript
import { useMobile } from '@/hooks/use-mobile';

const MyComponent = () => {
  const isMobile = useMobile();
  
  return isMobile ? <MobileView /> : <DesktopView />;
};
```

**Implementation:**
- Uses `window.matchMedia` to check screen width
- Updates on window resize
- Breakpoint: 768px (configurable)

---

## use-toast.ts

Toast notification system (from shadcn/ui).

```typescript
import { useToast } from '@/hooks/use-toast';

const MyComponent = () => {
  const { toast } = useToast();
  
  const handleSuccess = () => {
    toast({
      title: "موفقیت",
      description: "عملیات با موفقیت انجام شد",
    });
  };
  
  const handleError = () => {
    toast({
      title: "خطا",
      description: "مشکلی پیش آمد",
      variant: "destructive",
    });
  };
};
```

---

## Creating Custom Hooks

Best practices:
1. Name must start with `use`
2. Can use other hooks inside
3. Return values/functions needed by components

Example - API data hook:
```typescript
// src/hooks/use-users.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/user';

export const useUsers = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(API_URL, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        setError('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchUsers();
  }, [token]);

  return { users, loading, error };
};
```

Usage:
```tsx
const UserList = () => {
  const { users, loading, error } = useUsers();
  
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  
  return <UserGrid users={users} />;
};
```
