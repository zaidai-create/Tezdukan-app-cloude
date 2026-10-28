---
name: TezDukan Design System
colors:
  surface: '#f6faf6'
  surface-dim: '#d6dbd7'
  surface-bright: '#f6faf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5f1'
  surface-container: '#eaefeb'
  surface-container-high: '#e5e9e5'
  surface-container-highest: '#dfe4e0'
  on-surface: '#181d1b'
  on-surface-variant: '#404942'
  inverse-surface: '#2c322f'
  inverse-on-surface: '#edf2ee'
  outline: '#707a72'
  outline-variant: '#bfc9c0'
  surface-tint: '#206b48'
  primary: '#004429'
  on-primary: '#ffffff'
  primary-container: '#0b5d3b'
  on-primary-container: '#8ad4a8'
  inverse-primary: '#8dd6ab'
  secondary: '#815600'
  on-secondary: '#ffffff'
  secondary-container: '#fdaf1e'
  on-secondary-container: '#6a4600'
  tertiary: '#00432c'
  on-tertiary: '#ffffff'
  tertiary-container: '#005d3f'
  on-tertiary-container: '#4bdca0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a8f3c6'
  primary-fixed-dim: '#8dd6ab'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005232'
  secondary-fixed: '#ffddb1'
  secondary-fixed-dim: '#ffba4b'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#624000'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f6faf6'
  on-background: '#181d1b'
  surface-variant: '#dfe4e0'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  price-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '800'
    lineHeight: 22px
    letterSpacing: -0.01em
  price-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a high-performance, polished visual language tailored for quick-commerce grocery delivery in Sindh, Pakistan. It merges modern Cupertino-grade precision with the agility, urgency, and dense utility of rapid delivery platforms. 

The aesthetic is clean, warm, and hyper-tactile:
- **Atmosphere:** Fresh, authentic, fast-paced, and dependable. It avoids the cheap clutter of discount marketplaces in favor of curated quality, appetizing produce display, and lightning-quick micro-interactions.
- **Cultural Resonance:** Subtly integrates timeless geometric lattice (Jali) motifs and refined arches into promotional banners, festive occasion tags, and celebratory order-tracking moments without overwhelming layout utility.
- **Physical Feel:** Tactile micro-elevations, crisp borders, and squishy interactive states designed specifically for one-handed thumb interaction during fast shopping journeys.

## Colors

The palette leverages a deep heritage green paired with energetic saffron gold and culinary accents:

- **Primary (`#0B5D3B`):** Deep Emerald Green evokes freshness, trust, agricultural vitality, and market authority. Used for primary interactive triggers, header highlights, and order commitment states.
- **Secondary (`#FFB020`):** Saffron Gold acts as an energetic spark for time-sensitive flash sales, instant delivery countdowns, savings indicators, and VIP membership perks.
- **Tertiary (`#10B981`):** Fresh Mint provides an electric delivery accent, active live-status tracker color, and "in-stock" indicator.
- **Urgency / Discount Accent (`#E11D48`):** Punchy Coral Red reserved strictly for stock-out warnings, expiry alerts, and high-percentage slash badges.
- **Surfaces & Canvases:**
  - Light Mode Canvas: `#FAFAF7` (warm alabaster milk tone, reducing eye strain over harsh pure white).
  - Light Surface Containers: `#FFFFFF` with structural micro-borders in `rgba(11, 93, 59, 0.08)`.
  - Dark Mode Canvas: `#0E1512` (deep pine obsidian).
  - Dark Surface Containers: `#16211C` with stroke borders in `rgba(255, 255, 255, 0.08)`.
- **Text & Contrast:** Primary text rests at `#111614` for high-legibility optical contrast; secondary supporting text stays grounded in slate `#64748B`.

## Typography

The type scale combines **Plus Jakarta Sans** for expressive, friendly headlines, badges, and numeric pricing, with **Inter** for dense transactional labels, weight descriptors, and product descriptions.

- **Currency & Numerics:** The Pakistani Rupee (`Rs.`) symbol is styled consistently in `Plus Jakarta Sans` with tabular figures (`tnum`) enabled to prevent layout jumps when cart totals animate.
- **Urgency Tags:** Flash sales and delivery timeframes (`12 MINS`) use uppercase `label-md` or `label-sm` with tight letter spacing for instant recognition.
- **Optical Hierarchy:** Product titles are clamped to a strict 2-line maximum at `headline-sm`, reserving bold weights for pricing and immediate quantity updates.

## Layout & Spacing

This mobile-first design system optimizes thumb reach zones and rapid catalog scanning:

- **Grid Architecture:** 
  - Mobile (<768px): 2-column or 3-column compact dynamic product grids with `0.75rem` gutters and `1rem` outer canvas padding.
  - Desktop / Tablet Web: 4 to 6-column layout constrained to a max-width of `1200px` centered with fluid guttering.
- **Rhythm & Touch Targets:** All touch targets maintain an absolute minimum height of `48px` (interactive buttons, stepper controls, address pills).
- **Safe Padding:** Bottom list padding reserves `96px` of clear space to ensure that active floating carts and frosted bottom navigation bars do not obscure item controls.

## Elevation & Depth

Visual depth is achieved through ambient multi-layered shadows combined with semi-translucent frosted surfaces:

- **Level 0 (Flat):** Recessed input backgrounds, quantity stepper background containers, and inactive toggle chips (`#F1F3F0`).
- **Level 1 (Cards & Product Tiles):** `#FFFFFF` surfaces layered with `box-shadow: 0 2px 6px -1px rgba(11, 93, 59, 0.04), 0 8px 16px -4px rgba(17, 22, 20, 0.03)` wrapped in a 1px border stroke of `rgba(11, 93, 59, 0.08)`.
- **Level 2 (Floating Action & Quantity Steppers):** Elevated pills, search docks, and checkout drawers use `box-shadow: 0 10px 25px -5px rgba(11, 93, 59, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04)`.
- **Level 3 (Modal Sheets & Delivery Drawers):** Heavy diffuse scrim `rgba(14, 21, 18, 0.6)` paired with top-lifted sheet shadow `0 -12px 32px rgba(0, 0, 0, 0.12)`.
- **Glassmorphic Navigation Bar:** Bottom bar features a 20px blur backdrop (`backdrop-filter: blur(20px) saturate(180%)`) with background fill `rgba(255, 255, 255, 0.82)` and top border `rgba(11, 93, 59, 0.08)`.

## Shapes

The shape vocabulary uses consistent roundedness (`roundedness: 2` = 0.5rem base) with intentional scaling across touchpoints:

- **Cards & Category Tiles:** Standardized at `16px` (`rounded-lg` equivalent) border radius, giving a soft, pocket-sized aesthetic.
- **Buttons & Interactive Steppers:** Fully pill-shaped (`9999px`) to create clear tactile affordances for tapping.
- **Banners & Festive Takeovers:** `20px` corners, often styled with subtle scalloped cuts or geometric Sindhi tile corner brackets.
- **Badges & Micro-tags:** `6px` or `8px` compact rounding to keep layout density crisp without visual bulk.

## Components

### Buttons & Interactive Triggers
- **Primary Action (Add to Cart / Checkout):** Height 48px min (52px on mobile bottom sheets). Fill `#0B5D3B`, text `#FFFFFF`, bold weight with right-aligned arrow or price lockup. Active state provides a haptic scale down (`transform: scale(0.98)`).
- **Secondary CTA:** Ghost or soft-fill emerald (`rgba(11, 93, 59, 0.08)`), text `#0B5D3B`.

### Product Cards
- Vertical layout with a 1:1 square image container featuring an off-white micro-tint backdrop.
- Upper left contains the **Delivery Badge** ("12 MINS" with a lightning bolt icon in `#FFB020` on a dark forest pill).
- Upper right accommodates discount badges ("15% OFF" in `#E11D48` pill).
- Card footer displays weight/unit in slate (`body-sm`), Pakistani Rupee pricing in bold `price-lg`, and an elevated right-aligned rapid stepper.

### Rapid Quantity Steppers
- In zero state: clean white pill button with emerald border and an "+ ADD" label.
- In active state: transitions immediately into a solid emerald (`#0B5D3B`) pill displaying `[-]`, dynamic count in bold white, and `[+]`. Minimum width 88px, height 36px.

### Navigation & Bottom Dock
- Fixed bottom dock with frosted glass surface.
- Floating checkout bar surfaces dynamically 16px above the tab bar whenever cart count > 0, showing item thumbnail stack, total in `Rs.`, and instant swipe/tap trigger.

### Input Fields & Search
- Hyperlocal search bar with prominent GPS location pill ("Deliver to Clifton, Block 2") integrated directly into the top bar.
- Search input uses an inset surface with subtle magnifying glass icon and real-time voice search microphone icon.

### Local Cultural Motifs
- Header banners and promotional deal headers subtly carry fine-line geometric Sindhi Jali (lattice) watermark vectors overlaid at 4% opacity, bringing local relevance without compromising digital polish.