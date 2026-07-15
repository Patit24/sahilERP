# Steel Trading ERP - Professional UI Enhancement

## Mission Statement
Elevate the Steel Trading ERP to a sophisticated, finance-grade application with refined typography, professional color palette, enhanced visual hierarchy, and polished styling that inspires confidence and trust.

## Experience Qualities
1. **Professional** - Premium, business-appropriate design with refined typography and sophisticated color palette
2. **Polished** - Subtle shadows, refined borders, and enhanced visual depth create a high-quality feel
3. **Trustworthy** - Clean hierarchy and consistent styling inspire confidence in financial data accuracy

## Complexity Level
**Complex Application** (advanced functionality with multiple views) - This is a complete ERP system with multiple interconnected modules for purchase management, sales tracking, discount calculations, and financial reporting. The UI enhancement focuses on visual refinement while maintaining all existing functionality.

## Essential Features

### Feature 1: Unified Visual Language
- **Functionality**: Consistent spacing (4px, 8px, 12px, 16px, 20px), typography sizes (xs, sm, base), and color usage across all pages
- **Purpose**: Creates a cohesive, professional experience that reduces cognitive load
- **Trigger**: Applied automatically across all pages and components
- **Progression**: Theme variables → Component styling → Page layouts
- **Success criteria**: All pages feel like parts of one unified application

### Feature 2: Professional Table Design
- **Functionality**: Fixed headers, alternating row hover states, compact sizing, clear column labels
- **Purpose**: Makes financial data easy to scan and compare
- **Trigger**: Applied to all data tables throughout the application
- **Progression**: Header styling → Row styling → Cell alignment → Hover states
- **Success criteria**: Tables are easy to read and navigate with professional appearance

### Feature 3: Consistent Status Badges
- **Functionality**: Standardized badge colors: Pending (amber/warning), Received/Paid (green/success), Advance (gray/muted)
- **Purpose**: Instant visual recognition of transaction states
- **Trigger**: Status display across all pages (invoices, payments, discounts)
- **Progression**: Define badge variants → Apply consistently → Test visibility
- **Success criteria**: Users can instantly identify status at a glance

### Feature 4: Streamlined Action Buttons
- **Functionality**: Compact sizing, consistent placement, non-distracting styling
- **Purpose**: Actions are accessible but don't dominate the interface
- **Trigger**: All CRUD operations (Add, Edit, Delete buttons)
- **Progression**: Size reduction → Icon sizing → Color refinement → Placement optimization
- **Success criteria**: Buttons are easy to find and use but don't compete with data

### Feature 5: Clean Modal Forms
- **Functionality**: Clear titles, required field indicators (*), labeled primary/secondary buttons, proper spacing
- **Purpose**: Makes data entry straightforward and reduces errors
- **Trigger**: All add/edit dialogs across the application
- **Progression**: Title sizing → Field labeling → Input styling → Button hierarchy
- **Success criteria**: Forms are easy to complete with clear guidance

### Feature 6: Dashboard Hierarchy
- **Functionality**: Filters at top → Summary cards → Data tables → Action logs (vertical flow)
- **Purpose**: Natural information flow that matches user mental models
- **Trigger**: Applied to all list/report pages
- **Progression**: Filter section → KPI cards → Detail tables → Secondary information
- **Success criteria**: Users can quickly find what they need without scrolling randomly

## Edge Case Handling
- **Empty States**: Clear messaging with icons, helpful next steps
- **Long Text**: Truncation with tooltips for table cells, wrapping in forms
- **Large Datasets**: Scrollable tables with fixed headers, pagination where needed
- **Narrow Screens**: Responsive grid layouts that stack appropriately (though desktop-optimized)

## Design Direction
The design evokes **trust, sophistication, and precision**. This is a financial system where accuracy and professionalism matter - the UI should feel refined, authoritative, and focused on data clarity. Enhanced shadows, refined borders, and sophisticated color gradients create depth without distraction. Think: Bloomberg Terminal meets modern premium SaaS - serious, polished, and contemporary.

Key Visual Principles:
- **Elevated Cards**: Subtle shadow-md with hover:shadow-lg transitions for interactive depth
- **Refined Borders**: Reduced opacity (border-border/60) for softer, more sophisticated separation
- **Strategic Gradients**: Subtle 8% color gradients (from-primary/8) add richness without distraction
- **Enhanced Typography**: Tighter tracking, improved font weights, and optimized rendering
- **Professional Shadows**: Custom shadow utilities (shadow-professional, shadow-professional-lg) for premium feel

## Color Selection

**Refined Professional Palette** with enhanced sophistication:

- **Primary Color**: `oklch(0.38 0.06 240)` - Deep blue-gray with increased depth for primary actions. Communicates stability, trust, and professionalism.
- **Background**: `oklch(0.985 0.002 240)` - Barely-tinted off-white with slight cool tone for reduced eye strain and modern feel
- **Card**: `oklch(1 0 0)` - Pure white for content cards with enhanced contrast against background
- **Secondary Colors**: 
  - Muted: `oklch(0.96 0.003 240)` - Refined light gray for secondary backgrounds
  - Border: `oklch(0.90 0.003 240)` - Soft, sophisticated borders that define without dominating
- **Accent Color**: `oklch(0.58 0.09 200)` - Professional teal for interactive elements and highlights
- **Status Colors**:
  - Success/Received: `oklch(0.58 0.16 145)` - Refined professional green
  - Warning/Pending: `oklch(0.72 0.16 75)` - Sophisticated amber/gold  
  - Destructive: `oklch(0.55 0.20 25)` - Restrained professional red
- **Sidebar**: `oklch(0.28 0.04 240)` - Deep, sophisticated navy-gray for premium feel
- **Chart Colors**: Refined palette with `oklch(0.48 0.14 240)`, `oklch(0.58 0.12 200)`, `oklch(0.62 0.14 160)`, `oklch(0.68 0.10 140)`, `oklch(0.52 0.12 220)`

**Foreground/Background Pairings**:
- Background (`oklch(0.985 0.002 240)`): Foreground (`oklch(0.20 0.01 240)`) - Ratio 15.2:1 ✓
- Card (`oklch(1 0 0)`): Card Foreground (`oklch(0.20 0.01 240)`) - Ratio 16.1:1 ✓
- Primary (`oklch(0.38 0.06 240)`): Primary Foreground (`oklch(0.99 0 0)`) - Ratio 9.4:1 ✓
- Success (`oklch(0.58 0.16 145)`): White (`oklch(0.99 0 0)`) - Ratio 5.4:1 ✓
- Warning (`oklch(0.72 0.16 75)`): Dark text (`oklch(0.18 0 0)`) - Ratio 8.8:1 ✓

## Font Selection

Professional, highly-readable typefaces optimized for financial data and business applications:

- **Primary Font**: IBM Plex Sans - Modern, professional sans-serif with exceptional readability and character at all sizes. Superior for financial interfaces with tabular numerals.
- **Monospace Font**: JetBrains Mono - Crystal-clear, distinct characters perfect for numbers, dates, and data with ligature support

### Typographic Hierarchy
- **Page Titles (H1)**: IBM Plex Sans Semibold / 20px / tight letter-spacing (-0.01em) / tracking-tight
- **Section Headers (H2)**: IBM Plex Sans Semibold / 16px / tight letter-spacing / tracking-tight
- **Card Titles (H3)**: IBM Plex Sans Semibold / 14px / tight letter-spacing / tracking-tight
- **Body Text**: IBM Plex Sans Regular / 13px / normal line-height / font-medium for emphasis
- **Table Headers**: IBM Plex Sans Semibold / 12px / normal spacing / font-semibold
- **Table Cells**: IBM Plex Sans Medium / 12px / improved weight for readability
- **Form Labels**: IBM Plex Sans Medium / 11px / font-semibold for clarity
- **Small Text/Hints**: IBM Plex Sans Medium / 11px / relaxed line-height / font-medium
- **Data/Numbers**: JetBrains Mono Medium/Semibold / 12-13px / tabular numerals / monospaced

### Typography Enhancements
- **Font Features**: Enabled tabular numerals (`tnum`) and lining numerals (`lnum`) for aligned numeric data
- **Rendering**: Optimized with `text-rendering: optimizeLegibility`, `-webkit-font-smoothing: antialiased`
- **Heading Treatment**: Subtle negative letter-spacing (-0.01em) for refined professional appearance

## Animations

**Minimal and purposeful** - this is a desktop business application, not a consumer app:

- **Hover States**: Instant background color transitions (no delay) on table rows and buttons
- **Page Transitions**: None - instant switching between tabs
- **Modal Entry**: Subtle fade-in (100ms) for dialogs
- **No animations**: Loading spinners, success notifications, or decorative effects

The application should feel **immediate and responsive**, not animated.

## Responsive Spacing System

**Viewport-Scaled Spacing** - All spacing automatically adjusts based on viewport size to ensure optimal density and readability across screen sizes:

### Core Spacing Utilities

The application uses `clamp()` CSS functions to create fluid spacing that scales between minimum and maximum values based on viewport width:

- **spacing-responsive-xs**: `clamp(0.25rem, 0.5vw, 0.375rem)` - Extra small spacing (4-6px)
- **spacing-responsive-sm**: `clamp(0.375rem, 0.75vw, 0.5rem)` - Small spacing (6-8px)
- **spacing-responsive-base**: `clamp(0.5rem, 1vw, 0.75rem)` - Base spacing (8-12px)
- **spacing-responsive-md**: `clamp(0.75rem, 1.5vw, 1rem)` - Medium spacing (12-16px)
- **spacing-responsive-lg**: `clamp(1rem, 2vw, 1.5rem)` - Large spacing (16-24px)
- **spacing-responsive-xl**: `clamp(1.25rem, 2.5vw, 2rem)` - Extra large spacing (20-32px)
- **spacing-responsive-2xl**: `clamp(1.5rem, 3vw, 2.5rem)` - 2X large spacing (24-40px)

### Directional Spacing

**Gap Utilities** (for flexbox/grid spacing):
- `gap-responsive-xs` through `gap-responsive-xl` - Fluid gap spacing

**Padding Utilities**:
- `px-responsive-sm`, `px-responsive-md`, `px-responsive-lg`, `px-responsive-xl` - Horizontal padding
- `py-responsive-sm`, `py-responsive-md`, `py-responsive-lg`, `py-responsive-xl` - Vertical padding

**Margin Utilities**:
- `mt-responsive-sm`, `mt-responsive-md`, `mt-responsive-lg` - Top margin
- `mb-responsive-sm`, `mb-responsive-md`, `mb-responsive-lg` - Bottom margin
- `margin-responsive-xs` through `margin-responsive-xl` - All-sides margin

**Space Between Utilities**:
- `space-y-responsive-sm`, `space-y-responsive-md`, `space-y-responsive-lg` - Vertical spacing between children
- `space-x-responsive-sm`, `space-x-responsive-md`, `space-x-responsive-lg` - Horizontal spacing between children

### Context-Specific Spacing

**Semantic spacing utilities for common UI patterns**:

- **card-spacing-responsive**: `clamp(1rem, 2vw, 1.5rem)` padding with `clamp(0.75rem, 1.5vw, 1rem)` gap
- **header-spacing-responsive**: `clamp(1rem, 2vw, 1.5rem)` vertical, `clamp(1.25rem, 2.5vw, 2rem)` horizontal
- **sidebar-spacing-responsive**: `clamp(0.75rem, 1.5vw, 1rem)` all sides
- **modal-spacing-responsive**: `clamp(1.25rem, 2.5vw, 2rem)` padding with `clamp(1rem, 2vw, 1.5rem)` gap
- **table-cell-spacing-responsive**: `clamp(0.5rem, 1vw, 0.75rem)` vertical, `clamp(0.625rem, 1.25vw, 1rem)` horizontal
- **button-spacing-responsive**: `clamp(0.375rem, 0.75vw, 0.5rem)` vertical, `clamp(0.75rem, 1.5vw, 1rem)` horizontal
- **form-spacing-responsive**: `clamp(0.75rem, 1.5vw, 1rem)` gap between form elements

### Responsive Breakpoints

**Tablet (≤1024px)**: Spacing values lock to their minimum values for tighter layouts
**Mobile (≤768px)**: Spacing is further compressed for smaller screens:
- Cards: 0.75rem padding, 0.5rem gap
- Headers: 0.75rem vertical, 1rem horizontal
- Sidebars: 0.5rem padding
- Modals: 1rem padding, 0.75rem gap
- Table cells: 0.375rem vertical, 0.5rem horizontal
- Buttons: 0.375rem vertical, 0.75rem horizontal

### Application in Components

**All UI components use responsive spacing**:
- Card: `gap-responsive-md`, `py-responsive-lg`, `px-responsive-lg`
- Dialog: `modal-spacing-responsive`, `gap-responsive-md`
- Table: `table-cell-spacing-responsive`
- Button: `button-spacing-responsive`, `gap-responsive-sm`
- Form: `form-spacing-responsive`, `gap-responsive-sm`
- Sidebar navigation: `sidebar-spacing-responsive`, `space-y-responsive-lg`
- Dashboard grids: `gap-responsive-md`, `gap-responsive-lg`

### Benefits

1. **Automatic Density Adjustment**: Spacing increases on larger screens for better visual breathing room, and decreases on smaller screens for efficiency
2. **Consistent Proportions**: All spacing scales proportionally, maintaining visual harmony
3. **Reduced Maintenance**: Change viewport behavior once, affects all components
4. **Better Readability**: Optimal spacing for each screen size improves scannability
5. **Professional Feel**: Sophisticated spacing that adapts to user's context

## Component Selection

### Components from Shadcn Used:
- **Tables**: Clean data display with sticky headers
- **Cards**: Content grouping with subtle borders
- **Buttons**: Compact sizing with clear visual states (default, outline, ghost, destructive)
- **Dialogs**: Modal forms with proper backdrop
- **Select/Input**: Form controls with consistent height (h-9 for main inputs, h-8 for nested)
- **Labels**: Clear field identification with required indicators
- **Badge**: Status display with semantic colors
- **Tabs**: Navigation between views
- **Separator**: Visual dividers where needed

### Customizations:
- **Compact Sizing**: Default button height reduced to h-9 (36px), nested to h-7-8 (28-32px)
- **Table Styling**: Headers with bg-muted/30, rows with hover:bg-muted/20, smaller text (text-xs)
- **Badge Variants**: Custom classes for warning/success status display
- **Form Spacing**: Tighter vertical rhythm (space-y-1.5, space-y-2.5 instead of space-y-4, space-y-6)
- **Card Headers**: Optional border-bottom for visual separation

### States:
- **Buttons**: 
  - Default: Solid background, clear affordance
  - Hover: Slightly lighter/darker
  - Disabled: 50% opacity, not-allowed cursor
- **Inputs**: 
  - Default: Light border
  - Focus: Accent-colored ring
  - Error: Red border (validation)
- **Table Rows**: 
  - Default: White/transparent
  - Hover: Light muted background
  - Selected: Slightly stronger background (if needed)

### Icon Selection (Phosphor Icons):
- **Add Actions**: Plus (16px for buttons)
- **Delete**: Trash (14px for icon buttons)
- **Filters**: FunnelSimple (18px for section headers)
- **Reports**: FileText, FilePdf (16px for export)
- **Info**: Info (18px for callouts)
- **Empty States**: Contextual icons at 40px (Building, Receipt, etc.)

### Spacing:
- **Page Level**: px-8 (horizontal), py-6 (vertical)
- **Component Spacing**: gap-3, gap-4 (between cards/sections), gap-5 (major sections)
- **Card Padding**: pt-3 pb-3 for compact cards, pt-4 pb-4 for content cards
- **Form Fields**: space-y-1.5 (label to input), gap-2/gap-3 (between fields)
- **Tables**: Default padding, no custom spacing needed

### Mobile:
This is a **desktop-first ERP** - mobile optimization is not a priority. Layouts may scroll horizontally on small screens. Focus on 1280px+ viewports where business users will operate.

## Received Discount Allocation Logic (Wallet-Based)

### Architecture Principle: Scheme-Level Wallet Management

The system implements a **wallet-based allocation** approach for Received Discounts, treating each discount scheme as a separate wallet for more accurate month-wise tracking and simplified allocation.

### Core Concept

Each discount scheme behaves as an independent wallet:

1. **Payment CD Wallet** - Combines regular payment CD and advance payment CD (both payment-based)
2. **Fixed Scheme Wallets** - One wallet per fixed scheme (e.g., "Early Bird", "Wire", "Gold")
3. **Invoice Close CD Wallet** - Separate wallet for invoice close discounts

### Wallet Behavior

**Opening Balance**:
- Each wallet starts with the accumulated pending expected discounts from prior periods

**Additions (Monthly)**:
- Expected discounts are added to the appropriate scheme wallet as they are earned

**Deductions (On Received Entry)**:
- Received discounts are allocated using **scheme-wise FIFO** (First-In-First-Out)
- Oldest pending expected balance of that scheme is adjusted first

**Closing Balance**:
- Pending = Opening + Expected - Received

### Allocation Rules

1. **Scheme-Level FIFO** - Not invoice-wise or payment-wise
2. **Chronological Order** - Within a scheme wallet, oldest expected discount entries are settled first
3. **Cross-Scheme Allocation** - User can optionally specify which scheme wallet to allocate against when entering received discount
4. **Auto-Merging** - Payment CD and Advance CD are merged into a single "Payment CD" wallet for allocation purposes

### Example Flow

```
Payment CD Wallet (Supplier A):
┌─────────────────────────────────────────┐
│ Opening Pending: ₹5,000                 │
├─────────────────────────────────────────┤
│ + Expected (Jan):                       │
│   - Invoice #1 (5 days): ₹1,200         │
│   - Invoice #2 (2 days): ₹800           │
│   - Advance Payment: ₹600               │
├─────────────────────────────────────────┤
│ - Received (Jan 15): ₹3,000             │
│   → Allocates to:                       │
│     • Opening pending: ₹5,000 → ₹2,000  │
│     • Invoice #1: ₹1,200 → ₹0 (paid)    │
│     • Invoice #2: ₹800 → ₹0 (paid)      │
│     • Advance: ₹600 → ₹600 (pending)    │
├─────────────────────────────────────────┤
│ = Closing Pending: ₹3,600               │
└─────────────────────────────────────────┘
```

### Benefits

1. **Simplified Tracking** - Month-wise balance is clear per scheme
2. **No Transaction-Level Complexity** - No need to allocate to specific invoices/payments when receiving
3. **Better Reporting** - Scheme-wise pending balances are immediately visible
4. **FIFO Compliance** - Oldest discounts are always settled first within each scheme
5. **Source-Based Integrity** - All calculations remain fully source-driven; received amounts are immutable

### Implementation Note

This is a **calculation-time** change only:
- Source data (invoices, payments, received discounts) remains unchanged
- Invoice/payment breakdown still exists for reporting purposes
- Received discount records are still immutable (locked once entered)
- The change is in how allocations are computed during live calculation
