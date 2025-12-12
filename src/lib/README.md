# Lib Directory

Contains utility functions and helpers.

## utils.ts

### cn() - Class Name Merger

Combines Tailwind classes intelligently, handling conflicts.

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage:**
```tsx
// Merge base classes with conditional classes
<div className={cn(
  "base-class",
  isActive && "active-class",
  className // prop from parent
)}>
```

**Why use cn() instead of template strings:**
```tsx
// ❌ Can cause conflicts
className={`p-4 ${large ? 'p-8' : ''}`}
// Results in "p-4 p-8" - both applied!

// ✅ cn() resolves conflicts
className={cn('p-4', large && 'p-8')}
// Results in just "p-8" when large is true
```

**Common patterns:**
```tsx
// Conditional classes
cn('base', condition && 'conditional')

// Multiple conditions
cn(
  'base',
  variant === 'primary' && 'bg-primary',
  variant === 'secondary' && 'bg-secondary',
  disabled && 'opacity-50 cursor-not-allowed'
)

// Merging with className prop
cn('component-base', className)
```

---

## Adding New Utilities

Keep utilities pure and focused:

```typescript
// src/lib/format.ts
export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('fa-IR');
};

export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('fa-IR') + ' تومان';
};
```

```typescript
// src/lib/api.ts
const BASE_URL = 'https://pseudo-admin-panel.safaee1361.workers.dev';

export const api = {
  login: (credentials: { username: string; password: string }) =>
    fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }),
    
  getUsers: (token: string) =>
    fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }),
};
```
