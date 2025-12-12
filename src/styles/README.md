# Styles & Design System

The design system is primarily defined in `src/index.css` using CSS custom properties (variables) and Tailwind CSS.

## Color Palette

### CSS Variables (in `:root`)
```css
--background: 0 0% 100%;        /* White */
--foreground: 0 0% 20%;         /* Dark charcoal for text */
--charcoal: 0 0% 20%;           /* #333 - Primary text */
--silver: 0 0% 45%;             /* #737373 - Secondary text */
--silver-light: 0 0% 85%;       /* #d9d9d9 - Borders */
--gold: 43 100% 50%;            /* #FFC107 - Primary accent */
--gold-light: 43 100% 65%;      /* Lighter gold for hover */
--gold-dark: 43 100% 35%;       /* Darker gold */
```

### Usage in Tailwind
```tsx
// Use semantic tokens, not raw colors
<p className="text-charcoal">Primary text</p>
<p className="text-silver">Secondary text</p>
<button className="bg-gold">Gold button</button>
```

---

## Glass Effect

The signature liquid glass morphism effect.

### .glass class
```css
.glass {
  /* Semi-transparent white gradient */
  background: linear-gradient(
    135deg,
    hsl(0 0% 100% / 0.5),    /* 50% white */
    hsl(0 0% 100% / 0.35)    /* 35% white */
  );
  
  /* Frosted glass blur */
  backdrop-filter: blur(20px) saturate(180%);
  
  /* Subtle white border */
  border: 1px solid hsl(0 0% 100% / 0.6);
  
  /* Glow effect */
  box-shadow: 
    0 8px 32px hsl(var(--glass-shadow)),
    inset 0 1px 0 hsl(0 0% 100% / 0.5),
    0 0 60px -10px hsl(0 0% 100% / 0.4);
}
```

### .glass-intense class
Stronger glass effect for important elements (like header):
```css
.glass-intense {
  background: linear-gradient(
    135deg,
    hsl(0 0% 100% / 0.65),
    hsl(0 0% 98% / 0.5)
  );
  backdrop-filter: blur(24px) saturate(180%);
}
```

### Tweaking Glass Effect

| Property | Effect | Increase → | Decrease → |
|----------|--------|-----------|------------|
| `background opacity` | Transparency | More solid | More see-through |
| `backdrop-filter: blur()` | Blur amount | Frosted look | Clearer |
| `saturate()` | Color intensity | More vibrant | More muted |
| `box-shadow` outer glow | Glow size | Bigger glow | Subtle glow |

**Example - More transparent glass:**
```css
.glass {
  background: linear-gradient(
    135deg,
    hsl(0 0% 100% / 0.3),    /* Was 0.5 */
    hsl(0 0% 100% / 0.2)     /* Was 0.35 */
  );
}
```

---

## Diagonal Stripes Background

Creates the subtle striped pattern visible through glass elements.

### Implementation
```css
body {
  background: 
    repeating-linear-gradient(
      135deg,                          /* Diagonal angle */
      hsl(0 0% 100% / 1) 0px,          /* Pure white */
      hsl(0 0% 96% / 1) 80px,          /* Slightly gray */
      hsl(0 0% 90% / 1) 160px,         /* More gray */
      hsl(0 0% 96% / 1) 240px,         /* Back to light */
      hsl(0 0% 100% / 1) 320px         /* Pure white */
    ),
    /* Subtle gold accent gradients */
    radial-gradient(...);
}
```

### Tweaking Stripes

| Change | How |
|--------|-----|
| **Thicker stripes** | Increase pixel values (80px → 120px) |
| **More visible** | Increase contrast (90% → 85% lightness) |
| **Subtler** | Decrease contrast (90% → 95% lightness) |
| **Different angle** | Change 135deg (45deg = opposite diagonal) |

**Example - Bolder stripes:**
```css
repeating-linear-gradient(
  135deg,
  hsl(0 0% 100% / 1) 0px,
  hsl(0 0% 92% / 1) 100px,    /* Darker, wider */
  hsl(0 0% 85% / 1) 200px,    /* Even darker */
  hsl(0 0% 92% / 1) 300px,
  hsl(0 0% 100% / 1) 400px
)
```

---

## Gold Button Styles

### .gold-button
```css
.gold-button {
  background: linear-gradient(
    135deg,
    hsl(var(--gold-light)),
    hsl(var(--gold)),
    hsl(var(--gold-dark))
  );
  color: white;
  font-weight: 600;
  border-radius: 9999px;       /* Fully rounded */
  box-shadow: 
    0 4px 15px hsl(var(--gold) / 0.4),
    inset 0 1px 0 hsl(0 0% 100% / 0.3);
  transition: all 0.3s ease;
}

.gold-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px hsl(var(--gold) / 0.5);
}
```

### .gold-fab (Floating Action Button)
```css
.gold-fab {
  /* Same gradient as gold-button */
  width: 56px;
  height: 56px;
  border-radius: 50%;
  /* Stronger shadow for floating effect */
  box-shadow: 
    0 6px 20px hsl(var(--gold) / 0.5),
    inset 0 2px 0 hsl(0 0% 100% / 0.3);
}
```

---

## Disabled Overlay

Used for "Coming Soon" features:
```css
.disabled-overlay {
  position: relative;
}

.disabled-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: hsl(0 0% 50% / 0.3);  /* Gray overlay */
  border-radius: inherit;
  pointer-events: none;
}
```

---

## Animations

### Pulse Glow (for FAB)
```css
@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 0 6px 20px hsl(var(--gold) / 0.5); 
  }
  50% { 
    box-shadow: 0 6px 30px hsl(var(--gold) / 0.7); 
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

### Adding New Animations

1. Define keyframes in index.css
2. Add animation class
3. Use via Tailwind: `className="animate-your-animation"`

---

## Tailwind Config

See `tailwind.config.ts` for:
- Extended colors using CSS variables
- Custom animations
- Font family definitions
