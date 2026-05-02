# Duolingo Design System & UI Patterns — Comprehensive Analysis

> **Research Date:** May 2026  
> **Product:** Duolingo Language Learning App (iOS, Android, Web)  
> **Scope:** Visual design system, interaction patterns, gamification elements, and user experience architecture

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Components](#4-components)
5. [Gamification Elements](#5-gamification-elements)
6. [Animations & Micro-interactions](#6-animations--micro-interactions)
7. [Navigation Architecture](#7-navigation-architecture)
8. [Empty States](#8-empty-states)
9. [Onboarding Experience](#9-onboarding-experience)
10. [Dark Mode Analysis](#10-dark-mode-analysis)
11. [Accessibility Considerations](#11-accessibility-considerations)

---

## 1. Color System

### Primary Brand Colors

Duolingo's color palette is vibrant, playful, and instantly recognizable. The brand leans heavily on a signature green that has become synonymous with the product.

| Token Name | Hex Code | RGB | Usage |
|------------|----------|-----|-------|
| **Feather Green** | `#58CC02` | `rgb(88, 204, 2)` | Primary brand color, CTAs, progress indicators, success states |
| **Feather Green Dark** | `#58A700` | `rgb(88, 167, 0)` | Hover states, pressed buttons, shadows |
| **Feather Green Light** | `#89E219` | `rgb(137, 226, 25)` | Highlights, gradients, active states |
| **Snow** | `#FFFFFF` | `rgb(255, 255, 255)` | Backgrounds, text on dark, card surfaces |
| **Eel** | `#4B4B4B` | `rgb(75, 75, 75)` | Primary text, headings, icons |

### Secondary & Accent Colors

Duolingo uses a spectrum of bright, saturated colors for different UI contexts, gamification elements, and course differentiation.

| Token Name | Hex Code | Usage |
|------------|----------|-------|
| **Macaw** | `#1CB0F6` | Blue accents, water elements, secondary actions, links |
| **Macaw Dark** | `#1899D6` | Blue hover/pressed states |
| **Fox** | `#FF9600` | Orange accents, warnings, streak flames, heat |
| **Fox Dark** | `#E68600` | Orange pressed states |
| **Cardinal** | `#FF4B4B` | Red accents, errors, hearts/lives, delete actions |
| **Cardinal Dark** | `#E04343` | Red pressed states |
| **Bee** | `#FFC800` | Yellow accents, stars, achievements, celebrations |
| **Bee Dark** | `#E6B400` | Yellow pressed states |
| **Humpback** | `#2B70C9` | Dark blue, premium/Super Duolingo branding |
| **Humpback Dark** | `#2459A3` | Premium pressed states |
| **Iguana** | `#D7FFB8` | Light green, success backgrounds, correct answer highlights |
| **Wolf** | `#E5E5E5` | Light gray, disabled states, dividers, borders |
| **Wolf Dark** | `#AFAFAF` | Medium gray, placeholder text, inactive icons |
| **Panther** | `#000000` | Pure black, used sparingly for emphasis |

### Semantic Color Mapping

```css
/* Success / Correct */
--color-success: #58CC02;
--color-success-light: #D7FFB8;
--color-success-dark: #58A700;

/* Error / Incorrect */
--color-error: #FF4B4B;
--color-error-light: #FFE0E0;
--color-error-dark: #E04343;

/* Warning / Caution */
--color-warning: #FF9600;
--color-warning-light: #FFF0D4;

/* Info / Neutral */
--color-info: #1CB0F6;
--color-info-light: #D4EDFC;
```

### Gradient Patterns

Duolingo frequently uses subtle gradients to add depth and dimension, particularly on cards and interactive elements.

```css
/* Primary Button Gradient */
background: linear-gradient(180deg, #58CC02 0%, #58A700 100%);

/* Premium/Super Duolingo Gradient */
background: linear-gradient(180deg, #2B70C9 0%, #1E5AAD 100%);

/* Streak Flame Gradient */
background: linear-gradient(180deg, #FF9600 0%, #FF4B4B 100%);

/* Achievement Badge Gradient */
background: linear-gradient(135deg, #FFC800 0%, #FF9600 100%);

/* Card Surface Gradient (subtle) */
background: linear-gradient(180deg, #FFFFFF 0%, #F7F7F7 100%);
```

### Course/Language Color Coding

Each language course is assigned a distinct color for visual differentiation on the home screen path:

- Spanish: `#FF9600` (Orange/Fox)
- French: `#1CB0F6` (Blue/Macaw)
- German: `#FF4B4B` (Red/Cardinal)
- Japanese: `#FF4B8B` (Pink)
- Korean: `#8000FF` (Purple)
- Italian: `#FF9600` (Yellow/Orange)
- Chinese: `#58CC02` (Green/Feather)
- Portuguese: `#FF4B4B` (Red)

---

## 2. Typography

### Font Family

Duolingo uses a custom typeface called **"DIN Round"** (a rounded variant of the classic DIN typeface) for its primary UI text. This gives the app its friendly, approachable character while maintaining excellent legibility.

```css
/* Primary Font Stack */
font-family: 'DIN Round', 'Nunito', 'Varela Round', 'Quicksand', sans-serif;

/* Fallback for web */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
```

**Characteristics of DIN Round:**
- Geometric sans-serif with rounded terminals
- Friendly yet authoritative
- Excellent at small sizes
- Distinctive lowercase 'a' and 'g'
- Rounded dots on 'i' and 'j'

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| **Display** | 32px / 2rem | 700 (Bold) | 1.2 | -0.5px | Splash screens, major announcements, empty states |
| **H1** | 28px / 1.75rem | 700 | 1.25 | -0.3px | Screen titles, modals |
| **H2** | 24px / 1.5rem | 700 | 1.3 | -0.2px | Section headers, lesson unit titles |
| **H3** | 20px / 1.25rem | 700 | 1.35 | -0.1px | Card titles, sub-sections |
| **H4** | 18px / 1.125rem | 700 | 1.4 | 0px | List items, button text |
| **Body** | 16px / 1rem | 400 (Regular) | 1.5 | 0px | Primary body text, instructions |
| **Body Small** | 14px / 0.875rem | 400 | 1.5 | 0px | Secondary text, descriptions |
| **Caption** | 12px / 0.75rem | 700 | 1.4 | 0.5px | Labels, badges, timestamps (uppercase) |
| **Button** | 16px / 1rem | 700 | 1 | 0.8px | Button labels (uppercase) |

### Typography Patterns

```css
/* Button Text */
.button-text {
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #FFFFFF;
}

/* Exercise Question */
.question-text {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  color: #4B4B4B;
  text-align: center;
}

/* Caption / Label */
.caption {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #AFAFAF;
}
```

### Text Treatment Rules

- **Headings:** Always bold (700), often centered in exercises
- **Body Text:** Regular weight, high contrast against backgrounds
- **Interactive Elements:** Uppercase with increased letter-spacing for buttons and labels
- **Correct Answers:** Green text (`#58CC02`) with bold weight
- **Incorrect Answers:** Red text (`#FF4B4B`) with bold weight
- **Disabled Text:** Gray (`#AFAFAF`) with reduced opacity

---

## 3. Spacing & Layout

### Spacing Tokens

Duolingo uses a 4px base grid system with logical increments.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight internal padding, icon gaps |
| `space-2` | 8px | Tight component padding, small gaps |
| `space-3` | 12px | Default component padding, text blocks |
| `space-4` | 16px | Standard padding, card internal spacing |
| `space-5` | 20px | Section padding, modal padding |
| `space-6` | 24px | Large component gaps, screen edge padding (mobile) |
| `space-8` | 32px | Section separators, large gaps |
| `space-10` | 40px | Major section divisions |
| `space-12` | 48px | Screen vertical padding |
| `space-16` | 64px | Hero spacing, major layout divisions |

### Layout Architecture

#### Mobile-First Design
Duolingo is primarily a mobile app, with the design system optimized for touch interfaces on 375px–414px width screens.

```css
/* Mobile Container */
.mobile-container {
  max-width: 100%;
  padding: 0 16px;
  margin: 0 auto;
}

/* Tablet Breakpoint */
@media (min-width: 768px) {
  .tablet-container {
    max-width: 600px;
    padding: 0 24px;
  }
}

/* Desktop Breakpoint */
@media (min-width: 1024px) {
  .desktop-container {
    max-width: 960px;
    padding: 0 32px;
  }
}
```

### Card System

Duolingo's cards are fundamental UI elements, used for exercises, lessons, and content containers.

```css
/* Standard Card */
.card {
  background: #FFFFFF;
  border-radius: 16px;
  border: 2px solid #E5E5E5;
  padding: 16px;
  box-shadow: 0 4px 0 #E5E5E5;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

/* Card Hover/Active State */
.card:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 #E5E5E5;
}

/* Exercise Option Card */
.exercise-card {
  background: #FFFFFF;
  border-radius: 12px;
  border: 2px solid #E5E5E5;
  border-bottom-width: 4px;
  padding: 16px 20px;
  cursor: pointer;
  transition: all 0.1s ease;
}

/* Selected State */
.exercise-card.selected {
  background: #D4EDFC;
  border-color: #1CB0F6;
  border-bottom-width: 2px;
  transform: translateY(2px);
}

/* Correct State */
.exercise-card.correct {
  background: #D7FFB8;
  border-color: #58CC02;
  border-bottom-width: 2px;
}

/* Incorrect State */
.exercise-card.incorrect {
  background: #FFE0E0;
  border-color: #FF4B4B;
  border-bottom-width: 2px;
}
```

### Shadow System

Duolingo uses "hard" shadows (solid color offsets) rather than blurred shadows to create a tactile, button-like feel.

```css
/* Button Shadow (Primary) */
.btn-shadow {
  box-shadow: 0 6px 0 #58A700;
}

/* Button Shadow (Secondary) */
.btn-shadow-secondary {
  box-shadow: 0 6px 0 #1899D6;
}

/* Card Shadow */
.card-shadow {
  box-shadow: 0 4px 0 #E5E5E5;
}

/* Floating Action Button Shadow */
.fab-shadow {
  box-shadow: 0 6px 0 #4B4B4B, 0 8px 16px rgba(0, 0, 0, 0.15);
}

/* Pressed State (Shadow Removed) */
.pressed {
  transform: translateY(6px);
  box-shadow: 0 0 0 transparent;
}
```

---

## 4. Components

### Buttons

Duolingo buttons are chunky, tactile, and highly interactive. They use a "pressed down" animation style.

#### Primary Button

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  padding: 16px 24px;
  background: linear-gradient(180deg, #58CC02 0%, #58A700 100%);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border: none;
  border-radius: 16px;
  box-shadow: 0 6px 0 #3D8C00;
  cursor: pointer;
  transition: all 0.1s ease;
  position: relative;
  overflow: hidden;
}

.btn-primary:hover {
  background: linear-gradient(180deg, #66E000 0%, #58A700 100%);
}

.btn-primary:active {
  transform: translateY(6px);
  box-shadow: 0 0 0 transparent;
}

.btn-primary:disabled {
  background: #E5E5E5;
  color: #AFAFAF;
  box-shadow: 0 6px 0 #CCCCCC;
  cursor: not-allowed;
}
```

#### Secondary Button

```css
.btn-secondary {
  padding: 16px 24px;
  background: #FFFFFF;
  color: #1CB0F6;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  border: 2px solid #E5E5E5;
  border-bottom-width: 4px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.btn-secondary:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}
```

#### Ghost Button

```css
.btn-ghost {
  padding: 12px 16px;
  background: transparent;
  color: #AFAFAF;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.05);
}
```

#### Button Shape & Border Radius

| Button Type | Border Radius | Height | Padding |
|-------------|---------------|--------|---------|
| Primary CTA | `16px` | 56px | 16px 24px |
| Secondary | `16px` | 56px | 16px 24px |
| Small/Icon | `12px` | 40px | 8px 12px |
| Floating Action | `50%` (circle) | 64px | 0 |

### Input Fields

Duolingo uses minimal, bottom-bordered inputs for text entry exercises.

```css
.duolingo-input {
  width: 100%;
  padding: 16px 0;
  font-size: 20px;
  font-weight: 700;
  color: #4B4B4B;
  background: transparent;
  border: none;
  border-bottom: 3px solid #E5E5E5;
  outline: none;
  transition: border-color 0.2s ease;
}

.duolingo-input:focus {
  border-bottom-color: #1CB0F6;
}

.duolingo-input.correct {
  border-bottom-color: #58CC02;
  color: #58CC02;
}

.duolingo-input.incorrect {
  border-bottom-color: #FF4B4B;
  color: #FF4B4B;
}
```

### Modals & Bottom Sheets

Duolingo prefers bottom sheets on mobile and centered modals on desktop.

```css
/* Mobile Bottom Sheet */
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border-radius: 20px 20px 0 0;
  padding: 24px 20px 32px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Desktop Modal */
.modal {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 32px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

### Progress Indicators

#### Lesson Progress Bar

```css
.progress-bar {
  height: 16px;
  background: #E5E5E5;
  border-radius: 8px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #58CC02 0%, #89E219 100%);
  border-radius: 8px;
  transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

#### Circular Progress (Level Ring)

```css
.level-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(
    #58CC02 0deg var(--progress-degree),
    #E5E5E5 var(--progress-degree) 360deg
  );
  padding: 6px;
}

.level-ring-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 24px;
  color: #58CC02;
}
```

---

## 5. Gamification Elements

### XP Bar (Experience Points)

The XP bar tracks daily and total progress. It uses a bright green fill with animated increments.

**Visual Description:**
- Horizontal bar, 16px height, fully rounded caps
- Background: `#E5E5E5`
- Fill: Gradient from `#58CC02` to `#89E219`
- Animated with a "bouncing" ease when XP is gained
- Numbers pop up above the bar in `#58CC02` with a `+15 XP` format

```css
.xp-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}

.xp-icon {
  width: 24px;
  height: 24px;
  color: #FFC800;
}

.xp-bar {
  flex: 1;
  height: 16px;
  background: #E5E5E5;
  border-radius: 8px;
  overflow: hidden;
}

.xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #58CC02, #89E219);
  border-radius: 8px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.xp-text {
  font-size: 14px;
  font-weight: 700;
  color: #FF9600;
  min-width: 60px;
  text-align: right;
}
```

### Streak Flame

The streak counter is one of Duolingo's most iconic elements, represented by a fire icon.

**Visual Description:**
- Fire icon in gradient from `#FF9600` (top) to `#FF4B4B` (bottom)
- Number displayed next to icon in `#FF9600` (bold, 16px)
- When streak is at risk (evening), icon pulses with a subtle scale animation
- If streak breaks, icon turns gray (`#AFAFAF`) with a "sad" wobble animation
- Streak freeze indicator appears as a blue shield overlay

```css
.streak-flame {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255, 150, 0, 0.1);
}

.streak-flame.at-risk {
  animation: pulse 1.5s ease-in-out infinite;
}

.streak-flame.broken {
  filter: grayscale(100%);
  opacity: 0.5;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.streak-number {
  font-size: 16px;
  font-weight: 700;
  color: #FF9600;
}
```

### Hearts / Lives System

Hearts represent the user's remaining attempts in a lesson. Free users have 5 hearts; Super users have unlimited.

**Visual Description:**
- Heart shape icon, filled with `#FF4B4B` when active
- Empty heart outline in `#E5E5E5` when lost
- Hearts are arranged horizontally with 4px gap
- When a heart is lost: quick shake animation + fade to outline
- When refilling: hearts fill sequentially with a "pop" animation
- Heart break animation: icon cracks and falls with gravity

```css
.hearts-container {
  display: flex;
  gap: 4px;
  align-items: center;
}

.heart {
  width: 28px;
  height: 28px;
  color: #FF4B4B;
  transition: all 0.2s ease;
}

.heart.empty {
  color: #E5E5E5;
  transform: scale(0.9);
}

.heart.lost {
  animation: heartBreak 0.4s ease forwards;
}

@keyframes heartBreak {
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.2) rotate(-10deg); }
  50% { transform: scale(0.9) rotate(10deg); }
  100% { transform: scale(1) rotate(0deg); color: #E5E5E5; }
}
```

### Achievement Badges

Badges are circular icons awarded for completing specific objectives.

**Visual Description:**
- Circular badge, 64px diameter
- Locked state: grayscale with a lock icon overlay, `#E5E5E5` background
- Unlocked state: full color with a gold border (`#FFC800`)
- Newly unlocked: "shine" animation with rotating sparkles
- Badge categories use different color schemes (gold, silver, bronze)

```css
.badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFC800, #FF9600);
  border: 3px solid #FFC800;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.badge.locked {
  background: #E5E5E5;
  border-color: #CCCCCC;
  filter: grayscale(100%);
}

.badge.newly-unlocked {
  animation: badgeShine 0.6s ease;
}

@keyframes badgeShine {
  0% { transform: scale(0) rotate(-180deg); }
  70% { transform: scale(1.1) rotate(10deg); }
  100% { transform: scale(1) rotate(0deg); }
}
```

### Level Rings

Circular progress indicators that wrap around the user's profile picture or skill icons.

**Visual Description:**
- Conic gradient ring around a central avatar
- Color indicates level tier (bronze: `#CD7F32`, silver: `#C0C0C0`, gold: `#FFD700`, diamond: `#B9F2FF`)
- Progress fill animates smoothly when XP is gained
- Level number displayed in center

```css
.level-ring {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  padding: 6px;
  background: conic-gradient(
    from 0deg,
    #58CC02 calc(var(--progress) * 3.6deg),
    #E5E5E5 calc(var(--progress) * 3.6deg)
  );
  position: relative;
}

.level-ring-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.level-number {
  font-size: 28px;
  font-weight: 700;
  color: #58CC02;
  line-height: 1;
}

.level-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #AFAFAF;
  letter-spacing: 0.5px;
}
```

### League System

Users compete in weekly leagues (Bronze → Diamond).

**Visual Description:**
- League badge displayed as a shield or banner icon
- Current league highlighted with a glowing border
- Leaderboard shows top 20 users with rank numbers
- Promotion zone (top 10) highlighted in green
- Demotion zone (bottom 5) highlighted in red
- Rank change arrows (up/down) with animation

```css
.league-badge {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
}

.league-bronze { background: linear-gradient(135deg, #CD7F32, #A0522D); }
.league-silver { background: linear-gradient(135deg, #E0E0E0, #A0A0A0); }
.league-gold { background: linear-gradient(135deg, #FFD700, #FFA500); }
.league-sapphire { background: linear-gradient(135deg, #0F52BA, #1E90FF); }
.league-ruby { background: linear-gradient(135deg, #E0115F, #FF1493); }
.league-emerald { background: linear-gradient(135deg, #50C878, #228B22); }
.league-amethyst { background: linear-gradient(135deg, #9966CC, #8A2BE2); }
.league-pearl { background: linear-gradient(135deg, #F0F0F0, #E8E8E8); }
.league-obsidian { background: linear-gradient(135deg, #2D2D2D, #000000); }
.league-diamond { background: linear-gradient(135deg, #B9F2FF, #00CED1); }
```

### Celebration Animations

Duolingo uses extensive celebration animations for milestones.

**Visual Elements:**
- Confetti particles in brand colors (`#58CC02`, `#1CB0F6`, `#FF9600`, `#FF4B4B`, `#FFC800`)
- Duo (the owl mascot) appears with a celebration pose
- XP numbers "float up" with a `+50` animation
- Screen briefly flashes with success color (`#D7FFB8`)
- Streak milestone: fireworks animation, Duo dances
- Lesson complete: circular "ripple" effect from center

```css
.celebration-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1000;
}

.confetti-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  animation: confettiFall 2s ease-out forwards;
}

@keyframes confettiFall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

.xp-float {
  position: absolute;
  font-size: 24px;
  font-weight: 700;
  color: #58CC02;
  animation: xpFloat 1s ease-out forwards;
}

@keyframes xpFloat {
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-80px) scale(1.2); opacity: 0; }
}
```

---

## 6. Animations & Micro-interactions

### Button Press Animation

Duolingo's signature interaction: buttons physically "press down" when tapped.

```css
.interactive-button {
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.interactive-button:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 transparent;
}

/* For buttons with 6px shadow */
.interactive-button-deep:active {
  transform: translateY(6px);
}
```

### Page Transitions

```css
/* Slide In From Right (Lesson start) */
.page-enter {
  animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Slide Out To Left (Lesson complete) */
.page-exit {
  animation: slideOutLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideOutLeft {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

/* Fade Up (Modal appearance) */
.modal-enter {
  animation: fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### Success/Failure Feedback

**Correct Answer:**
- Card background transitions to `#D7FFB8` (light green)
- Border color changes to `#58CC02`
- Checkmark icon scales in with a "pop" (`scale(0)` → `scale(1.2)` → `scale(1)`)
- Subtle haptic feedback (vibration)

**Incorrect Answer:**
- Card background transitions to `#FFE0E0` (light red)
- Border color changes to `#FF4B4B`
- Card shakes horizontally (`translateX(-8px)` → `translateX(8px)` → `0`)
- "Incorrect" text appears in `#FF4B4B`

```css
.correct-feedback {
  animation: correctPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes correctPop {
  0% { transform: scale(1); }
  40% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

.incorrect-feedback {
  animation: incorrectShake 0.4s ease;
}

@keyframes incorrectShake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
```

### Loading States

```css
/* Skeleton Loading */
.skeleton {
  background: linear-gradient(90deg, #E5E5E5 25%, #F0F0F0 50%, #E5E5E5 75%);
  background-size: 200% 100%;
  animation: skeletonShimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes skeletonShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Spinner (Duo Owl) */
.loading-spinner {
  width: 64px;
  height: 64px;
  animation: spinnerBounce 1s ease-in-out infinite;
}

@keyframes spinnerBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
```

### Micro-interactions Summary

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Button Press | translateY + shadow removal | 100ms | ease |
| Card Select | scale + border color | 150ms | ease-out |
| Correct Answer | background color + pop | 400ms | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Incorrect Answer | horizontal shake | 400ms | ease |
| Page Transition | slide + fade | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Modal Appear | slide up + fade | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| XP Gain | float up + fade | 1000ms | ease-out |
| Confetti | fall + rotate | 2000ms | ease-out |
| Streak Pulse | scale | 1500ms | ease-in-out (infinite) |
| Heart Loss | shake + color change | 400ms | ease |
| Level Up | ring fill + scale | 600ms | cubic-bezier(0.34, 1.56, 0.64, 1) |

---

## 7. Navigation Architecture

### Home Screen Layout (The "Path")

Duolingo's home screen is organized as a vertical "path" that users follow linearly through their course.

**Visual Description:**
- **Header:** Fixed top bar with streak flame (left), XP count (center), hearts (right)
- **Course Switcher:** Dropdown at top to change between enrolled courses
- **The Path:** A winding, game-board-like trail that scrolls vertically
- **Path Nodes:** Circular "bubbles" representing lessons, spaced ~80px apart vertically
- **Path Lines:** Dashed or solid connecting lines between nodes
- **Unit Dividers:** Larger circular "castles" or "checkpoints" every ~30 lessons
- **Floating Action Button:** Large green "+" or "Start" button at bottom center

```css
/* Path Container */
.path-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 120px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F7F7F7 100%);
}

/* Path Node (Lesson Bubble) */
.path-node {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 3px solid #E5E5E5;
  border-bottom-width: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  color: #4B4B4B;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

/* Active Node (Current Lesson) */
.path-node.active {
  background: linear-gradient(180deg, #58CC02 0%, #58A700 100%);
  border-color: #3D8C00;
  color: #FFFFFF;
  animation: nodePulse 2s ease-in-out infinite;
}

/* Completed Node */
.path-node.completed {
  background: #D7FFB8;
  border-color: #58CC02;
  color: #58CC02;
}

/* Locked Node */
.path-node.locked {
  background: #E5E5E5;
  border-color: #CCCCCC;
  color: #AFAFAF;
}

@keyframes nodePulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(88, 204, 2, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(88, 204, 2, 0); }
}

/* Path Connector Line */
.path-connector {
  width: 4px;
  height: 48px;
  background: #E5E5E5;
  border-radius: 2px;
}

.path-connector.completed {
  background: linear-gradient(180deg, #58CC02, #89E219);
}
```

### Bottom Navigation Bar

The bottom nav provides access to the app's main sections.

| Tab | Icon | Active Color | Screen |
|-----|------|--------------|--------|
| **Learn** | Home/Path | `#58CC02` | Home screen with lesson path |
| **Sounds** | Speaker/Audio | `#1CB0F6` | Audio practice (newer feature) |
| **Leaderboard** | Trophy | `#FF9600` | League rankings |
| **Quests** | Scroll/Target | `#FF4B4B` | Daily/weekly challenges |
| **Profile** | User/Avatar | `#4B4B4B` | User stats, achievements, settings |

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: #FFFFFF;
  border-top: 2px solid #E5E5E5;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  color: #AFAFAF;
  transition: color 0.2s ease;
}

.nav-item.active {
  color: #58CC02;
}

.nav-icon {
  width: 28px;
  height: 28px;
}

.nav-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
```

### Lesson Screen Layout

During a lesson, the UI is stripped down to minimize distractions.

**Structure:**
1. **Top Bar:** Progress bar (lessons are typically 10–20 questions), close button (X)
2. **Question Area:** Centered text or image prompt
3. **Answer Area:** Interactive cards, text input, or audio buttons
4. **Bottom Bar:** Check button (initially disabled, enables after user input)

```css
.lesson-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #FFFFFF;
}

.lesson-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.lesson-progress {
  flex: 1;
  height: 16px;
}

.lesson-close {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #E5E5E5;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.lesson-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 16px;
  gap: 24px;
}

.lesson-question {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  color: #4B4B4B;
}

.lesson-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lesson-footer {
  padding: 16px;
  border-top: 2px solid #E5E5E5;
}

.lesson-check-btn {
  width: 100%;
  padding: 16px;
  background: #58CC02;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border: none;
  border-radius: 16px;
  box-shadow: 0 6px 0 #58A700;
  cursor: pointer;
  transition: all 0.1s ease;
}

.lesson-check-btn:disabled {
  background: #E5E5E5;
  color: #AFAFAF;
  box-shadow: 0 6px 0 #CCCCCC;
  cursor: not-allowed;
}
```

---

## 8. Empty States

### No Internet Connection

**Visual Description:**
- Duo (owl mascot) appears with a "sad" expression
- Text: "No internet connection" in `#4B4B4B`, H3 size
- Subtext: "Please check your connection and try again" in `#AFAFAF`, Body Small
- Action: "Retry" button (Primary style)

### No Active Course

**Visual Description:**
- Large course icon placeholder in `#E5E5E5`
- Text: "Start learning today!" in Display size
- Subtext: "Choose a language and begin your journey" in Body
- Action: "Get Started" button (Primary)

### Empty Leaderboard

**Visual Description:**
- Trophy icon in `#E5E5E5`, 64px
- Text: "No rankings yet" in H3
- Subtext: "Complete a lesson to join the leaderboard" in Body Small

### Empty Friends List

**Visual Description:**
- Duo waving icon
- Text: "Learning is better with friends!" in H2
- Subtext: "Invite friends to learn together" in Body
- Action: "Invite Friends" button

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 16px;
}

.empty-state-icon {
  width: 120px;
  height: 120px;
  color: #E5E5E5;
  margin-bottom: 8px;
}

.empty-state-title {
  font-size: 24px;
  font-weight: 700;
  color: #4B4B4B;
}

.empty-state-description {
  font-size: 16px;
  color: #AFAFAF;
  max-width: 280px;
  line-height: 1.5;
}

.empty-state-action {
  margin-top: 8px;
}
```

---

## 9. Onboarding Experience

### First-Time User Flow

Duolingo's onboarding is designed to get users into a lesson within 60 seconds.

**Step 1: Welcome Screen**
- Full-screen illustration of Duo waving
- "Hi there! I'm Duo." (H1, centered)
- "I'll help you learn a language." (Body, centered)
- "Get Started" button (Primary, large)
- "I Already Have an Account" link (Ghost button)

**Step 2: Language Selection**
- Grid of language flags/cards (2-column on mobile)
- Each card: flag icon + language name + "For English speakers"
- Search bar at top for quick filtering
- Popular languages pinned to top

```css
.language-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}

.language-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px;
  background: #FFFFFF;
  border: 2px solid #E5E5E5;
  border-bottom-width: 4px;
  border-radius: 16px;
  gap: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.language-card:active {
  transform: translateY(2px);
  border-bottom-width: 2px;
}

.language-flag {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.language-name {
  font-size: 14px;
  font-weight: 700;
  color: #4B4B4B;
  text-align: center;
}
```

**Step 3: Goal Setting**
- "How much time can you practice each day?" (H2)
- Options presented as cards:
  - Casual: 5 min/day
  - Regular: 10 min/day
  - Serious: 15 min/day
  - Intense: 20 min/day
- Each card shows a brief description
- Selected state: green border + checkmark

**Step 4: Notification Permission**
- Duo illustration with a clock
- "Reminders help you build a streak" (H3)
- "What time would you like to practice?" (Body)
- Time picker wheel (native iOS/Android style)
- "Turn on reminders" (Primary) / "Not now" (Ghost)

**Step 5: First Lesson (Immediate)**
- User is dropped directly into a beginner lesson
- No account creation required upfront
- Guest progress is saved locally, prompt to create account appears after lesson 2–3

### Account Creation Prompt

After completing 2–3 lessons, a modal appears:
- "You're doing great!" (H2)
- "Create an account to save your progress" (Body)
- Social login buttons (Google, Facebook, Apple)
- Email input field
- "Create Account" (Primary) / "Maybe Later" (Ghost)

---

## 10. Dark Mode Analysis

Duolingo's dark mode implementation (introduced in recent years) maintains the playful aesthetic while reducing eye strain.

### Dark Mode Color Mapping

| Light Mode | Dark Mode | Element |
|------------|-----------|---------|
| `#FFFFFF` | `#1F1F1F` | Backgrounds |
| `#F7F7F7` | `#2D2D2D` | Card backgrounds, secondary surfaces |
| `#4B4B4B` | `#E5E5E5` | Primary text |
| `#AFAFAF` | `#808080` | Secondary text, placeholders |
| `#E5E5E5` | `#404040` | Borders, dividers |
| `#FFFFFF` (button) | `#404040` | Secondary button backgrounds |

### Dark Mode Specific Adjustments

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1F1F1F;
    --bg-secondary: #2D2D2D;
    --bg-card: #2D2D2D;
    --text-primary: #E5E5E5;
    --text-secondary: #808080;
    --border-color: #404040;
    --shadow-color: rgba(0, 0, 0, 0.3);
  }

  .card {
    background: var(--bg-card);
    border-color: var(--border-color);
    box-shadow: 0 4px 0 var(--border-color);
  }

  .btn-secondary {
    background: var(--bg-card);
    color: #1CB0F6;
    border-color: var(--border-color);
  }
}
```

### Dark Mode Gamification Colors

Gamification elements largely retain their colors in dark mode for brand consistency:
- **Feather Green:** Remains `#58CC02`
- **Streak Flame:** Remains `#FF9600`
- **Hearts:** Remain `#FF4B4B`
- **XP:** Remains `#FF9600`

However, backgrounds behind these elements shift to dark:
- Success background: `#1A3300` instead of `#D7FFB8`
- Error background: `#330000` instead of `#FFE0E0`

---

## 11. Accessibility Considerations

### Color Contrast

Duolingo generally maintains WCAG AA compliance for text:
- `#4B4B4B` on `#FFFFFF`: 9.7:1 (AAA)
- `#58CC02` on `#FFFFFF`: 2.9:1 (Fails AA for small text, acceptable for large text/buttons)
- `#FFFFFF` on `#58CC02`: 2.9:1 (Used for button text, acceptable at 16px+ bold)

### Touch Targets

All interactive elements meet or exceed 44×44px touch target size:
- Buttons: minimum 150×56px
- Cards: full width, minimum 64px height
- Icons: 28–40px with adequate padding

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Screen Reader Support

- All interactive elements have descriptive `aria-labels`
- Progress announced via `aria-live` regions
- Success/failure feedback announced immediately
- Images have descriptive `alt` text

---

## Visual Summary: Key Screens

### 1. Home Screen (The Path)

```
┌─────────────────────────────┐
│  🔥 365     🇪🇸 Spanish    💎 5 │  ← Header (Streak, Course, Hearts)
├─────────────────────────────┤
│                             │
│      ┌─────┐                │
│      │ 🔒  │                │  ← Locked lessons (gray bubbles)
│      └──┬──┘                │
│         │                   │
│      ┌──┴──┐                │
│      │ ✅  │                │  ← Completed lessons (green check)
│      └──┬──┘                │
│         │                   │
│      ┌──┴──┐                │
│      │ 📚  │                │  ← Active lesson (pulsing green)
│      └──┬──┘                │
│         │                   │
│      ┌──┴──┐                │
│      │ 🏰  │                │  ← Checkpoint/Castle (unit divider)
│      └─────┘                │
│                             │
│  ┌─────────────────────┐    │
│  │    START LESSON     │    │  ← Floating CTA Button
│  └─────────────────────┘    │
├─────────────────────────────┤
│  🏠    🏆    📜    👤      │  ← Bottom Navigation
└─────────────────────────────┘
```

### 2. Lesson Exercise Screen

```
┌─────────────────────────────┐
│  ════════════░  ✕          │  ← Progress bar + Close
├─────────────────────────────┤
│                             │
│    Translate this sentence  │
│                             │
│    "The cat eats fish"      │  ← Question prompt
│                             │
│  ┌─────────────────────┐    │
│  │      El gato        │    │  ← Option 1
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │   come pescado      │    │  ← Option 2
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │      La gata        │    │  ← Option 3
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────┐    │
│  │       CHECK         │    │  ← Action button
│  └─────────────────────┘    │
└─────────────────────────────┘
```

### 3. Lesson Complete Celebration

```
┌─────────────────────────────┐
│                             │
│           🎉                │
│                             │
│      Lesson Complete!       │
│                             │
│      ┌─────────┐            │
│      │  +15 XP  │           │  ← Floating XP
│      └─────────┘            │
│                             │
│     ┌───────────────┐       │
│     │  AMAZING      │       │
│     │  100% ACCURACY │      │
│     └───────────────┘       │
│                             │
│  ┌─────────────────────┐    │
│  │    CONTINUE         │    │
│  └─────────────────────┘    │
│                             │
│   Duo appears dancing       │
│   Confetti animation        │
└─────────────────────────────┘
```

---

## Key Design Principles

1. **Playful but Functional:** Every element has a purpose, but is presented with personality
2. **Immediate Feedback:** Users know instantly if they're correct or incorrect
3. **Progress Visibility:** The path makes progress tangible and motivating
4. **Loss Aversion:** Hearts and streaks leverage psychological motivators
5. **Mobile-First:** Touch targets are large, gestures are simple
6. **Chunked Learning:** Lessons are bite-sized (3–5 minutes)
7. **Celebration-Driven:** Success is always celebrated, no matter how small
8. **Brand Consistency:** The green owl (Duo) is present throughout, reinforcing brand identity

---

## Implementation Notes for Developers

### Recommended Tech Stack
- **Framework:** React Native (mobile), React (web)
- **Animation:** React Native Animated API, Lottie for complex animations
- **State Management:** Redux or Zustand for user progress/game state
- **Styling:** Styled Components or Tailwind CSS with custom design tokens
- **Icons:** Custom SVG icon set matching Duolingo's rounded style

### Critical CSS Variables

```css
:root {
  /* Colors */
  --color-feather: #58CC02;
  --color-feather-dark: #58A700;
  --color-feather-light: #89E219;
  --color-macaw: #1CB0F6;
  --color-fox: #FF9600;
  --color-cardinal: #FF4B4B;
  --color-bee: #FFC800;
  --color-humpback: #2B70C9;
  --color-iguana: #D7FFB8;
  --color-wolf: #E5E5E5;
  --color-wolf-dark: #AFAFAF;
  --color-eel: #4B4B4B;
  --color-snow: #FFFFFF;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Shadows (Hard shadows for tactile feel) */
  --shadow-btn: 0 6px 0 var(--color-feather-dark);
  --shadow-card: 0 4px 0 var(--color-wolf);
  --shadow-fab: 0 6px 0 var(--color-eel), 0 8px 16px rgba(0, 0, 0, 0.15);

  /* Transitions */
  --transition-fast: 100ms ease;
  --transition-base: 200ms ease;
  --transition-bounce: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

*Report compiled from extensive analysis of Duolingo's public-facing applications, design documentation, and established UX patterns as of May 2026.*
