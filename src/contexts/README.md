# Contexts Directory

This directory contains React Context providers for global state management.

## AuthContext.tsx

Manages authentication state across the application.

### What it provides:
```typescript
interface AuthContextType {
  token: string | null;      // JWT token
  isAuthenticated: boolean;  // Derived from token presence
  login: (token: string) => void;
  logout: () => void;
}
```

### How it works:

**Token Storage:**
```typescript
// On login - store in localStorage
const login = (newToken: string) => {
  localStorage.setItem('auth_token', newToken);
  setToken(newToken);
};

// On logout - clear from localStorage
const logout = () => {
  localStorage.removeItem('auth_token');
  setToken(null);
};

// On app load - restore from localStorage
useEffect(() => {
  const savedToken = localStorage.getItem('auth_token');
  if (savedToken) {
    setToken(savedToken);
  }
}, []);
```

### Usage in Components:

**Checking auth status:**
```tsx
import { useAuth } from '@/contexts/AuthContext';

const MyComponent = () => {
  const { isAuthenticated, token } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // Use token for API calls
  fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
};
```

**Login action:**
```tsx
const LoginPage = () => {
  const { login } = useAuth();
  
  const handleSubmit = async () => {
    const response = await fetch(loginUrl, { ... });
    const data = await response.json();
    login(data.token); // Store token
    navigate('/');
  };
};
```

**Logout action:**
```tsx
const Header = () => {
  const { logout } = useAuth();
  
  return (
    <Button onClick={logout}>
      <LogOut /> خروج
    </Button>
  );
};
```

### Route Protection

In App.tsx, routes check authentication:
```tsx
<Route 
  path="/" 
  element={
    isAuthenticated 
      ? <Dashboard /> 
      : <Navigate to="/login" />
  } 
/>
```
