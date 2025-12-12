# Source Code Overview

This is the main source directory for the Admin Panel application. Below is a high-level overview of the architecture and how different parts connect.

## Directory Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React Context providers (Auth)
├── hooks/          # Custom React hooks
├── lib/            # Utility functions
├── pages/          # Page components (routes)
├── types/          # TypeScript type definitions
├── App.tsx         # Main app with routing
├── index.css       # Global styles & design system
└── main.tsx        # App entry point
```

## Application Flow

### 1. Authentication Flow
```
User opens app → App.tsx checks AuthContext → 
  → If not logged in → Redirect to /login
  → If logged in → Show requested page with Header
```

### 2. Data Flow for Users
```
UserManagement page mounts → 
  → Calls API with JWT token → 
  → Receives user array → 
  → Displays in Card/List view → 
  → User clicks card → Navigate to /users/:id → 
  → UserDetail fetches specific user data
```

### 3. Filter/Search Flow
```
User clicks FAB (gold button) → 
  → GlassModal opens with filter form → 
  → User fills filters → 
  → Clicks "اعمال فیلتر" → 
  → Filters applied to user list → 
  → Modal closes
```

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Routing configuration and auth protection |
| `index.css` | Design system (glass effects, stripes, colors) |
| `contexts/AuthContext.tsx` | JWT token management and login state |
| `pages/UserManagement.tsx` | Main user list with filtering |
| `pages/UserDetail.tsx` | Individual user view and editing |

## API Integration

All API calls use the JWT token from AuthContext:
```typescript
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## RTL Support

The entire application is RTL (Right-to-Left) for Persian language:
- Set in `index.html`: `<html dir="rtl" lang="fa">`
- Modals explicitly set `style={{ direction: 'rtl' }}`
