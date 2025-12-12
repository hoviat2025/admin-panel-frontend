# Components Directory

This directory contains reusable UI components that implement the liquid glass design system.

## Core Components

### GlassBox.tsx
A container component with glass morphism effect.

**Props:**
```typescript
interface GlassBoxProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;      // Shows gray overlay when true
  onClick?: () => void;    // Makes it clickable with hover effects
  intense?: boolean;       // Uses stronger glass effect
}
```

**Usage:**
```tsx
// Basic glass card
<GlassBox>Content here</GlassBox>

// Clickable card with intense glass
<GlassBox onClick={handleClick} intense>
  Interactive content
</GlassBox>

// Disabled state (Coming Soon)
<GlassBox disabled>
  Disabled content with overlay
</GlassBox>
```

**How it works:**
- Uses CSS class `.glass` or `.glass-intense` from index.css
- Applies backdrop-filter blur for transparency
- Adds hover scale effect when onClick is provided
- Shows `.disabled-overlay` when disabled

---

### GlassModal.tsx
A modal component with glass backdrop and bright white content area.

**Props:**
```typescript
interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}
```

**Key Features:**
- Locks body scroll when open (`overflow: hidden`)
- Bright white background for readability (different from glass cards)
- RTL direction for Persian text
- Closes on backdrop click
- No parallax/scroll animations for smoothness

**Implementation Details:**
```tsx
// Backdrop with blur
<div 
  className="fixed inset-0 z-50 bg-charcoal/40"
  style={{ backdropFilter: 'blur(12px)' }}
>
  // Modal content - white, not glassy
  <div className="bg-white border border-white/80">
    {children}
  </div>
</div>
```

---

### FloatingActionButton.tsx
A fixed-position button for primary actions (search/filter).

**Props:**
```typescript
interface FloatingActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}
```

**Styling:**
- Uses `.gold-fab` class for shiny gold appearance
- Fixed position: bottom-left corner
- Has pulse glow animation

---

### Header.tsx
The main navigation header that appears on all pages (except login).

**Features:**
- Glass effect with transparency
- Floating design with rounded corners and margins
- Home button (right side) - navigates to dashboard
- Back button OR Logout button (left side):
  - Dashboard: Shows logout button
  - Other pages: Shows back button

**Conditional Rendering:**
```tsx
{location.pathname === '/' ? (
  <LogoutButton />
) : (
  <BackButton />
)}
```

---

### NavLink.tsx
A styled navigation link component.

---

## UI Components (src/components/ui/)

These are shadcn/ui components. See their individual files for usage.
Key ones used in this project:
- `button.tsx` - Various button styles
- `input.tsx` - Form inputs
- `badge.tsx` - Status badges (e.g., banned user)
- `switch.tsx` - Toggle switches
- `select.tsx` - Dropdown selects

## Creating New Components

1. Follow the glass design pattern:
```tsx
import { GlassBox } from "./GlassBox";

export const NewComponent = () => (
  <GlassBox className="custom-styles">
    Content
  </GlassBox>
);
```

2. For modals, use GlassModal:
```tsx
<GlassModal isOpen={isOpen} onClose={close} title="عنوان">
  Modal content in RTL
</GlassModal>
```

3. Use semantic color tokens from the design system (see index.css)
