# Vanilla Dashboard

Modern SaaS Dashboard built with pure HTML, CSS, and vanilla JavaScript. No frameworks, no build step.

## Features

- **Collapsible Sidebar** (56px ↔ 220px) with smooth transitions
- **Stat Cards** with click interactions and hover effects
- **Interactive Charts** using Chart.js CDN
- **Sortable Data Table** with search functionality
- **Modal Dialogs** with backdrop blur and animations
- **Toast Notifications** with auto-dismiss
- **Skeleton Loaders** for loading states
- **Fully Accessible** with ARIA labels and keyboard navigation

## Stack

- Pure HTML5
- CSS Custom Properties (design tokens)
- Vanilla JavaScript (ES6+)
- Chart.js (via CDN)
- Lucide Icons (via CDN)
- Plus Jakarta Sans (Google Fonts)

## File Structure

```
/
├── index.html          # Main dashboard page
├── css/
│   ├── tokens.css      # CSS custom properties
│   ├── main.css        # Global styles
│   └── components.css  # UI components
├── js/
│   ├── sidebar.js      # Sidebar toggle functionality
│   ├── charts.js       # Chart.js integration
│   └── main.js         # Dashboard logic
└── README.md
```

## How to Use

Simply open `index.html` in your browser. No server or build step required.

```bash
# Option 1: Direct open
open index.html

# Option 2: Simple HTTP server
python -m http.server 8000
# Then visit http://localhost:8000
```

## Design System

### Colors
- Background: `#F8F9FB`
- Surface: `#FFFFFF`
- Accent: `#7C6FF7` (Soft Violet)
- Text Primary: `#1A1D2E`
- Text Secondary: `#6B7280`

### Border Radius
- sm: 6px
- md: 12px
- lg: 20px
- xl: 28px

### Spacing
Base unit: 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)

## Components

- **Button**: primary, secondary, ghost, danger variants
- **Card**: with header, body, footer
- **Badge**: blue, green, red, amber colors
- **Avatar**: with fallback initials
- **Input**: with label, helper text, error state
- **Select**: custom styled dropdown
- **Modal**: accessible with animations
- **Toast**: auto-dismiss notifications
- **Skeleton**: loading placeholders

## Responsive

- Mobile-first approach
- Sidebar auto-collapses on mobile
- Grid adapts to screen size
- All interactions work on touch devices

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus visible indicators
- Screen reader friendly
- Semantic HTML structure

## License

MIT
