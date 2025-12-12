# Pages Directory

This directory contains the main page components that correspond to routes.

## Route Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard.tsx | Main dashboard with 4 sections |
| `/login` | Login.tsx | Authentication page |
| `/users` | UserManagement.tsx | User list with filter |
| `/users/:id` | UserDetail.tsx | Individual user view/edit |
| `*` | NotFound.tsx | 404 error page |

---

## Dashboard.tsx

The main landing page after login showing 4 feature boxes.

**Features:**
1. **User Management** (مدیریت کاربران) - ACTIVE, navigates to /users
2. **Recurring Tasks** (اقدامات تکراری) - Coming Soon, disabled
3. **Statistics** (آمار و ارقام) - Coming Soon, disabled
4. **AI** (هوش مصنوعی) - Coming Soon, disabled

**How disabled state works:**
```tsx
<GlassBox
  onClick={feature.active ? () => navigate(feature.path) : undefined}
  disabled={!feature.active}
>
  {/* Content */}
  {!feature.active && (
    <span className="text-xs text-silver">به زودی</span>
  )}
</GlassBox>
```

---

## Login.tsx

Handles user authentication.

**API Call:**
```typescript
const response = await fetch(
  'https://pseudo-admin-panel.safaee1361.workers.dev/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }
);

const data = await response.json();
// data.token contains the JWT
login(data.token); // Stores in AuthContext
```

**Flow:**
1. User enters username/password
2. On submit, POST to login endpoint
3. If successful, store JWT token via AuthContext
4. Redirect to dashboard

---

## UserManagement.tsx

The main user listing page with filtering capabilities.

### Data Fetching
```typescript
useEffect(() => {
  const fetchUsers = async () => {
    const response = await fetch(
      'https://pseudo-admin-panel.safaee1361.workers.dev/users',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const data = await response.json();
    setUsers(data); // Array of user objects
  };
  fetchUsers();
}, [token]);
```

### View Modes
Toggle between two display modes:
- **Card View**: Grid of glass cards with profile image, name, ID, country
- **List View**: Table-like rows with more details

```tsx
{viewMode === 'card' ? (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {/* Card components */}
  </div>
) : (
  <div className="flex flex-col gap-3">
    {/* List rows */}
  </div>
)}
```

### Filtering System

**Filter State:**
```typescript
const [filters, setFilters] = useState({
  name: '',
  userId: '',
  username: '',
  country: '',
  phoneNumber: '',
  isBanned: 'all',      // 'all' | 'true' | 'false'
  isRegistered: 'all'   // 'all' | 'true' | 'false'
});
```

**Filter Logic (on Apply):**
```typescript
const applyFilters = () => {
  let result = users;
  
  if (filters.name) {
    result = result.filter(user =>
      `${user.first_name} ${user.last_name}`
        .toLowerCase()
        .includes(filters.name.toLowerCase())
    );
  }
  
  if (filters.isBanned !== 'all') {
    result = result.filter(user => 
      user.is_ban === (filters.isBanned === 'true')
    );
  }
  
  // ... more filters
  
  setFilteredUsers(result);
  setIsFilterOpen(false); // Close modal
};
```

### Floating Action Button
Opens the filter modal:
```tsx
<FloatingActionButton onClick={() => setIsFilterOpen(true)}>
  <Search className="h-6 w-6 text-white" />
</FloatingActionButton>
```

---

## UserDetail.tsx

Shows detailed information for a single user and allows editing.

### Fetching User Data
Uses the user ID from URL params:
```typescript
const { id } = useParams();

// Find user from pre-fetched list or fetch individually
const user = users.find(u => u.user_id === id);
```

### Profile Image Construction
```typescript
const getProfileImageUrl = (profilePath: string) => {
  const baseUrl = 'https://pub-4036d35baed54ee7a9504072ea49740f.r2.dev/';
  return `${baseUrl}${profilePath}`;
};
```

### Edit Modal
Contains editable fields for user data:
- Basic info: first_name, last_name, username
- Contact: phone_number, whatsapp_number
- Status: is_ban, is_registered, score

**Edit Flow:**
1. Click floating edit button (gold FAB with Edit icon)
2. GlassModal opens with form fields
3. Edit values in form
4. Click "ذخیره تغییرات" (Save Changes)
5. (Currently local only - would need API endpoint for persistence)

```tsx
<FloatingActionButton onClick={() => setIsEditOpen(true)}>
  <Edit className="h-6 w-6 text-white" />
</FloatingActionButton>

<GlassModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
  {/* Edit form fields */}
  <Button onClick={handleSave}>ذخیره تغییرات</Button>
</GlassModal>
```

---

## NotFound.tsx

Simple 404 page with link back to dashboard.
