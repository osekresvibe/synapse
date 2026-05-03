# Synapse Edit Design Guidelines

## Design Approach

**Selected Approach:** Design System (Hybrid) - Linear + Notion Inspired  
**Justification:** Synapse Edit is a utility-focused productivity tool where efficiency and clarity are paramount. The "modern sleek minimalist" requirement aligns perfectly with Linear's clean aesthetic combined with Notion's welcoming spaciousness. This approach ensures professional creators can focus on their content decisions without visual overwhelm.

**Core Design Principles:**
1. **Breathing Room First:** Generous whitespace creates mental space for decision-making
2. **Progressive Disclosure:** Show complexity only when needed (e.g., timeline appears after upload)
3. **Visual Hierarchy Through Scale:** Use size and weight differences, not color, to establish importance
4. **Functional Minimalism:** Every element serves the editing workflow

---

## Color Palette

**Dark Mode (Primary):**
- Background Base: `0 0% 9%` (near black, softer than pure black)
- Surface Elevated: `0 0% 12%` (cards, modals, panels)
- Surface Interactive: `0 0% 15%` (hover states, active areas)
- Border Subtle: `0 0% 18%` (dividers, container edges)
- Text Primary: `0 0% 98%` (main content, headings)
- Text Secondary: `0 0% 65%` (labels, metadata)
- Text Tertiary: `0 0% 45%` (placeholders, disabled states)

**Brand & Accent:**
- Primary Brand: `240 75% 60%` (vibrant indigo for CTAs, active states)
- Primary Hover: `240 75% 55%` (darker variant)
- Success Indicator: `142 70% 50%` (processing complete, export ready)
- Warning/Progress: `45 95% 60%` (rendering in progress)

**Light Mode (Secondary Support):**
- Background Base: `0 0% 98%`
- Surface Elevated: `0 0% 100%`
- Text Primary: `0 0% 10%`
- Same brand colors with adjusted alpha for contrast

---

## Typography

**Font Families:**
- **Primary:** Inter (via Google Fonts CDN) - UI elements, body text, labels
- **Display:** Space Grotesk (via Google Fonts CDN) - Hero section, large headings
- **Monospace:** JetBrains Mono - Timestamps, technical data, frame counts

**Type Scale:**
- Hero/Display: 48px (3rem), font-weight 600, Space Grotesk
- Page Titles: 32px (2rem), font-weight 600, Inter
- Section Headers: 24px (1.5rem), font-weight 600, Inter
- Card Titles: 18px (1.125rem), font-weight 500, Inter
- Body Text: 15px (0.9375rem), font-weight 400, Inter, line-height 1.6
- Labels/Metadata: 13px (0.8125rem), font-weight 500, Inter, letter-spacing 0.01em
- Timestamps: 12px (0.75rem), font-weight 400, JetBrains Mono

---

## Layout System

**Spacing Primitives (Tailwind Units):**
- **Core Set:** 2, 4, 6, 8, 12, 16, 24 (for consistency and rhythm)
- Component Padding: p-6 to p-8 (medium density), p-12 to p-16 (spacious sections)
- Stack Spacing: space-y-6 for related items, space-y-12 for distinct sections
- Grid Gaps: gap-4 for tight grids, gap-6 for breathing room, gap-8 for generous layouts

**Container Strategy:**
- Max Width: max-w-7xl (1280px) for main content areas
- Full Width Panels: w-full for video previews, timeline
- Sidebar Width: w-80 (320px) for controls and settings

**Responsive Breakpoints:**
- Mobile: Single column, collapsible panels
- Tablet (md:): 2-column layout where appropriate (upload + settings)
- Desktop (lg:): 3-column Triptych, expanded timeline

---

## Component Library

### Core Navigation
- **Top Bar:** Fixed, h-16, bg-surface with bottom border, contains logo (left), progress indicator (center), export button (right)
- **Sidebar (Desktop):** Fixed left, w-80, collapsible, houses upload zone and preset controls

### Upload & Input
- **YouTube URL Input:** Full-width field with paste icon, auto-validates URL format, shows thumbnail preview on valid input
- **Drag-Drop Zone:** Dashed border (border-dashed), centered icon + text, transforms to solid border on hover, h-48 minimum

### Triptych Preview (Core Innovation)
- **3-Card Layout:** Grid with gap-6, equal height cards
- **Video Card Structure:**
  - Aspect ratio 16:9 video preview (bg-black)
  - Bottom overlay gradient for metadata
  - Title (Short Hook/Standard/Comprehensive)
  - Duration badge (absolute top-right, rounded-full, backdrop-blur)
  - Hover state: Subtle lift (transform scale-105), play button overlay

### Timeline & Smart Slices
- **Timeline Container:** Full-width, h-32, horizontal scroll, snap-x behavior
- **Slice Clips:** Draggable cards, w-24 to w-32 based on duration, thumbnail background, duration label, handles for grab interaction
- **Drop Zones:** Dotted outline appears between clips when dragging, visual feedback with border-primary-500

### Controls & Settings
- **Mood Presets:** 3-button group, icon + label, active state with bg-primary and text-white, inactive with border-subtle
- **Style Reference:** Upload area for reference video, displays extracted metadata (cut tempo, color profile) in chip format

### Buttons & Actions
- **Primary CTA:** bg-primary, hover:bg-primary-hover, px-6 py-3, rounded-lg, font-medium
- **Secondary:** border border-subtle, hover:bg-surface-interactive, same padding
- **Icon Buttons:** p-2, hover:bg-surface-interactive, rounded-md

### Feedback & Progress
- **Processing Indicator:** Linear progress bar, indeterminate animation for analysis, determinate for rendering
- **Toast Notifications:** Fixed bottom-right, slide-in animation, auto-dismiss, success/warning colors

---

## Animation Guidelines

**Use Sparingly:**
- Hover States: Simple opacity/background changes (150ms duration)
- Card Interactions: Subtle lift on hover (200ms transform)
- Drag Feedback: Immediate visual snap with spring physics (300ms)
- Progress: Smooth bar fills, no bouncing or excessive motion
- **Avoid:** Page transitions, scroll-triggered effects, decorative animations

---

## Images

**Hero Section:**
- Large hero image showcasing the Triptych interface in action (mockup of three video previews side by side)
- Background: Subtle gradient overlay from dark edges to center, ensuring text readability
- Placement: Full-width, h-[500px] on desktop, h-[350px] on mobile
- Image Description: Clean screenshot of Synapse Edit's Triptych preview with three polished video thumbnails, each showing different editing styles (fast cuts, balanced, comprehensive), with subtle UI chrome visible

**Feature Illustrations:**
- Smart Slices visualization: Diagram showing AI analyzing video segments
- Style Mimicry: Before/after comparison of reference matching
- Use throughout: Subtle, functional diagrams rather than decorative imagery