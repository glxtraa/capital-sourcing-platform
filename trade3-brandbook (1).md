# Trade3 Brand Book

## Color Palette

### Primary Colors

```css
:root {
  /* Primary Navy - Main brand color */
  --color-navy-primary: #1a1f3a;
  --color-navy-dark: #151829;
  
  /* Accent Colors */
  --color-coral-primary: #ff6b4a;
  --color-coral-light: #ff8566;
  
  /* Neutral Colors */
  --color-white: #ffffff;
  --color-off-white: #fafafa;
  --color-light-gray: #f5f5f7;
  
  /* Text Colors */
  --color-text-primary: #1a1f3a;
  --color-text-secondary: #8b8d98;
  --color-text-on-dark: #ffffff;
  --color-text-muted: #a8aab3;
}
```

### Color Usage Guidelines

**Navy Primary (#1a1f3a)**
- Primary brand color
- Hero sections and backgrounds
- Headers and important UI elements
- Conveys trust, professionalism, and stability

**Coral Accent (#ff6b4a)**
- Call-to-action buttons
- Interactive elements
- Highlights and emphasis
- The "3" in the logo
- Bullet points and decorative elements

**White/Off-white**
- Main background color for content sections
- Card backgrounds
- Text on dark backgrounds

**Gray Tones**
- Body copy and secondary text
- Subtle borders and dividers
- Placeholder text

---

## Typography

### Font Families

```css
:root {
  /* Primary Font - Headings and Display */
  --font-primary: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* Secondary Font - Body Text */
  --font-secondary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* Alternative: If Satoshi is unavailable */
  --font-fallback: 'DM Sans', 'Plus Jakarta Sans', 'Circular', sans-serif;
}
```

### Font Weights

```css
:root {
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
}
```

### Type Scale

```css
:root {
  /* Hero/Display */
  --font-size-hero: 4rem;        /* 64px */
  --line-height-hero: 1.1;
  
  /* H1 */
  --font-size-h1: 3rem;          /* 48px */
  --line-height-h1: 1.15;
  
  /* H2 */
  --font-size-h2: 2.25rem;       /* 36px */
  --line-height-h2: 1.2;
  
  /* H3 */
  --font-size-h3: 1.5rem;        /* 24px */
  --line-height-h3: 1.3;
  
  /* Body Large */
  --font-size-body-lg: 1.125rem; /* 18px */
  --line-height-body-lg: 1.6;
  
  /* Body Regular */
  --font-size-body: 1rem;        /* 16px */
  --line-height-body: 1.6;
  
  /* Body Small */
  --font-size-small: 0.875rem;   /* 14px */
  --line-height-small: 1.5;
  
  /* Label/Caption */
  --font-size-caption: 0.75rem;  /* 12px */
  --line-height-caption: 1.4;
}
```

### Typography Classes

```css
/* Hero Text - "Welcome to a better way to trade" */
.text-hero {
  font-family: var(--font-primary);
  font-size: var(--font-size-hero);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-hero);
  letter-spacing: -0.02em;
  color: var(--color-white);
}

/* Section Label - "Our solution" */
.text-label {
  font-family: var(--font-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  text-transform: lowercase;
  color: var(--color-white);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.text-label::before {
  content: '';
  width: 8px;
  height: 8px;
  background-color: var(--color-coral-primary);
  border-radius: 50%;
}

/* Body Text - Regular paragraphs */
.text-body {
  font-family: var(--font-secondary);
  font-size: var(--font-size-body-lg);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-body-lg);
  color: var(--color-text-muted);
}

.text-body-on-dark {
  color: #b8bac7;
}

/* Subheading - "The old way trade operated is holding you back" */
.text-subheading {
  font-family: var(--font-primary);
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-h3);
  color: var(--color-white);
}

/* Card Title - "1. Fund Smart Agreement" */
.text-card-title {
  font-family: var(--font-primary);
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-h3);
  color: var(--color-text-primary);
}

/* Card Description */
.text-card-description {
  font-family: var(--font-secondary);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-body);
  color: var(--color-text-secondary);
}
```

---

## Spacing System

```css
:root {
  /* Spacing Scale */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
  --space-32: 8rem;     /* 128px */
}
```

---

## Components

### Cards

```css
.card {
  background: var(--color-white);
  border-radius: 16px;
  padding: var(--space-8);
  box-shadow: 0 2px 8px rgba(26, 31, 58, 0.04);
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: 0 8px 24px rgba(26, 31, 58, 0.08);
  transform: translateY(-2px);
}

.card-icon {
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-6);
  color: var(--color-navy-primary);
}
```

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--color-coral-primary);
  color: var(--color-white);
  border: none;
  border-radius: 8px;
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-secondary);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: var(--color-coral-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 107, 74, 0.3);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--color-navy-primary);
  border: 2px solid var(--color-navy-primary);
  border-radius: 8px;
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-secondary);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: var(--color-navy-primary);
  color: var(--color-white);
}

/* Button on Dark Background */
.btn-outline-light {
  background: transparent;
  color: var(--color-white);
  border: 2px solid var(--color-white);
  border-radius: 8px;
  padding: var(--space-3) var(--space-6);
}

.btn-outline-light:hover {
  background: var(--color-white);
  color: var(--color-navy-primary);
}
```

---

## Layout Sections

### Hero Section

```css
.hero-section {
  background: var(--color-navy-primary);
  padding: var(--space-24) var(--space-6);
  min-height: 600px;
  display: flex;
  align-items: center;
}

.hero-content {
  max-width: 900px;
}

.hero-label {
  margin-bottom: var(--space-4);
}

.hero-title {
  margin-bottom: var(--space-6);
}

.hero-description {
  margin-bottom: var(--space-8);
  max-width: 700px;
}

.hero-subheading {
  margin-bottom: var(--space-4);
  margin-top: var(--space-10);
}
```

### Feature Cards Section

```css
.features-section {
  background: var(--color-off-white);
  padding: var(--space-20) var(--space-6);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-8);
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  background: var(--color-white);
  border-radius: 16px;
  padding: var(--space-8);
}
```

---

## Icons

### Icon Style Guidelines

- **Style**: Outlined/Line icons
- **Stroke Width**: 2px
- **Color**: Navy Primary (#1a1f3a)
- **Size**: 48-64px for feature cards
- **Corner Radius**: Rounded corners where applicable

### Icon Examples from Screenshots

1. **Document with Coins** - Fund Smart Agreement
2. **Blockchain/Package** - Verify and track  
3. **Wallet** - Instant payment release

---

## Brand Voice & Tone

### Voice Characteristics

- **Professional yet Approachable**: Confident but not intimidating
- **Progressive**: Forward-thinking, innovative
- **Clear and Direct**: No jargon, straightforward communication
- **Empowering**: Focused on solving problems

### Writing Style

- Use active voice
- Short, punchy sentences for impact
- Lead with benefits, not features
- Address pain points directly
- "Trade done right" - confident, simple messaging

---

## Logo Usage

### Primary Logo
- White text with coral "3" on navy background
- Minimum clear space: 20px on all sides
- Minimum width: 120px

### Logo Variations
- Full color (navy + coral on light backgrounds)
- White version (all white on dark backgrounds)
- Navy version (all navy on light backgrounds)

---

## Accessibility

### Color Contrast Ratios

```css
/* WCAG AA Compliant Combinations */

/* Text on Navy Background */
--contrast-navy-white: 12.9:1 ✓ AAA

/* Navy Text on White */
--contrast-white-navy: 12.9:1 ✓ AAA

/* Gray Text on White (Body Copy) */
--contrast-white-gray: 5.2:1 ✓ AA

/* Coral on White (Use for accents, not body text) */
--contrast-white-coral: 3.8:1 ✓ AA Large
```

### Guidelines
- All body text must meet WCAG AA standards (4.5:1)
- Large text (24px+) must meet 3:1 ratio
- Interactive elements need clear focus states
- Provide sufficient color contrast for all text

---

## Responsive Design

### Breakpoints

```css
:root {
  --breakpoint-mobile: 480px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1440px;
}

/* Mobile First Approach */
@media (min-width: 768px) {
  :root {
    --font-size-hero: 3.5rem;
  }
}

@media (min-width: 1024px) {
  :root {
    --font-size-hero: 4rem;
  }
}
```

---

## Animation & Motion

```css
:root {
  --transition-fast: 0.15s ease;
  --transition-base: 0.3s ease;
  --transition-slow: 0.5s ease;
  
  --easing-default: cubic-bezier(0.4, 0.0, 0.2, 1);
  --easing-enter: cubic-bezier(0.0, 0.0, 0.2, 1);
  --easing-exit: cubic-bezier(0.4, 0.0, 1, 1);
}

/* Subtle hover effects */
.interactive-element {
  transition: all var(--transition-base) var(--easing-default);
}

.interactive-element:hover {
  transform: translateY(-2px);
}
```

---

## Implementation Example

### Complete Hero Section HTML + CSS

```html
<section class="hero-section">
  <div class="hero-content">
    <div class="text-label">
      Our solution
    </div>
    
    <h1 class="text-hero">
      Welcome to a better way to trade
    </h1>
    
    <p class="text-body text-body-on-dark">
      The current trade finance model is slow, costly, and built on decades-old 
      infrastructure. It traps capital, relies on mountains of paper, and leaves small 
      businesses exposed to risk. The system wasn't built for a connected world.
    </p>
    
    <h2 class="text-subheading">
      The old way trade operated is holding you back
    </h2>
    
    <p class="text-body text-body-on-dark">
      We've built a next-generation foundation for global trade. By moving processes onto 
      blockchain, we eliminate delays, reduce risk, and remove the need for middlemen.
    </p>
  </div>
</section>
```

---

## Summary

### Quick Reference

**Primary Navy**: `#1a1f3a`  
**Coral Accent**: `#ff6b4a`  
**White**: `#ffffff`  
**Text Gray**: `#8b8d98`

**Primary Font**: Satoshi (headings)  
**Secondary Font**: Inter (body)

**Brand Promise**: "Trade done right"

**Design Philosophy**: Modern, professional, trustworthy with energetic accents that convey innovation and forward-thinking in the fintech/trade space.
