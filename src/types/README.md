# Types Directory

Contains TypeScript type definitions for the application.

## user.ts

Defines the structure of user data from the API.

```typescript
export interface User {
  user_id: string;           // Unique identifier
  username: string;          // Login username
  first_name: string;        // First name
  last_name: string;         // Last name
  country: string;           // Country name
  phone_number: string;      // Phone number
  whatsapp_number: string;   // WhatsApp number
  profile_path: string;      // Relative path to profile image
  join_date: string;         // ISO date string
  is_ban: boolean;           // Banned status
  is_registered: boolean;    // Registration status
  score: number;             // User score/points
  // ... additional fields as needed
}
```

## Usage

Import types where needed:
```typescript
import { User } from '@/types/user';

// In component
const [users, setUsers] = useState<User[]>([]);

// In function
const findUser = (id: string): User | undefined => {
  return users.find(u => u.user_id === id);
};
```

## Adding New Types

1. Create a new `.ts` file or add to existing
2. Export the interface/type
3. Import where needed using `@/types/...`

Example for new feature:
```typescript
// src/types/task.ts
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  assignedTo: string; // user_id
}
```
