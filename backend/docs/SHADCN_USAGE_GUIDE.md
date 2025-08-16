# ShadCN UI MCP Server Usage Guide

## 🎯 Quick Access

Use the `/sc:shadcn` slash command to access ShadCN UI components through the MCP server.

## 🔧 Available Commands

### Component Access
```bash
/sc:shadcn list                    # List all available components
/sc:shadcn demo button            # Show button component demo
/sc:shadcn get card               # Get card component source
/sc:shadcn meta dialog            # Get dialog metadata/dependencies
```

### Block Access
```bash
/sc:shadcn blocks                 # List available blocks
/sc:shadcn block dashboard-01     # Get dashboard block implementation
```

### Search & Discovery
```bash
/sc:shadcn search input           # Search for input-related components
```

## 📋 Essential Components for Pawn Shop

### Forms & Input
- **Input**: Customer data entry, search fields
- **Button**: Actions, form submissions, navigation
- **Select**: Category selection, status dropdowns
- **Form**: Complete form handling with validation
- **Textarea**: Notes, descriptions, comments
- **Checkbox**: Boolean selections, agreements
- **Radio**: Single choice selections

### Data Display
- **Card**: Item display, customer profiles, summaries
- **Table**: Transaction history, inventory listings
- **Badge**: Status indicators (Active, Overdue, Redeemed)
- **Alert**: System notifications, warnings, errors
- **Avatar**: User profiles, customer photos

### Navigation & Layout
- **Breadcrumb**: Navigation paths through system
- **Tabs**: Organize views (Items, Payments, History)
- **Dialog**: Confirmation modals, detailed views
- **Sheet**: Side panels for additional information
- **Separator**: Visual content organization

### Dashboard Blocks
- **dashboard-01**: Complete admin dashboard layout
- **Calendar blocks**: Appointment and due date tracking
- **Form blocks**: Customer registration, transaction forms

## 🎨 Implementation Workflow

### 1. Planning Phase
```bash
/sc:shadcn list                   # See available components
/sc:shadcn search form            # Find form-related components
```

### 2. Demo Analysis
```bash
/sc:shadcn demo input             # Study usage patterns
/sc:shadcn demo button            # Understand variants
```

### 3. Implementation
```bash
/sc:shadcn get input              # Get source code
/sc:shadcn meta input             # Check dependencies
```

### 4. Integration
- Follow demo patterns exactly
- Use TypeScript typing from source
- Implement accessibility features
- Test responsive behavior

## ⚠️ Important Rules

### DO's ✅
- Always use `/sc:shadcn` command for component access
- Study demo patterns before implementing
- Check metadata for dependencies
- Follow TypeScript patterns exactly
- Use accessibility features provided
- Leverage pre-built blocks for complex layouts

### DON'Ts ❌
- Never write ShadCN components manually
- Don't modify component source code
- Don't skip dependency requirements
- Don't ignore accessibility features
- Don't create custom variants without understanding base

## 🔧 MCP Server Details

### Server Status
- **Location**: `/mcp-servers/shadcn-ui-mcp-server/`
- **Status**: ✅ Connected and functional
- **Framework**: React with TypeScript
- **Components**: 79+ shadcn/ui v4 components
- **Rate Limit**: 60 requests/hour (upgrade with GitHub token)

### Available Tools
1. `list_components` - Lists all available components
2. `get_component` - Retrieves component source code
3. `get_component_demo` - Gets usage examples
4. `get_component_metadata` - Gets dependencies and config
5. `list_blocks` - Lists available blocks
6. `get_block` - Gets complete block implementations
7. `get_directory_structure` - Repository exploration

## 📚 Pawn Shop Use Cases

### Customer Management
```bash
/sc:shadcn demo input             # Customer data forms
/sc:shadcn demo card              # Customer profile display
/sc:shadcn demo avatar            # Customer photos
```

### Transaction Processing
```bash
/sc:shadcn demo form              # Transaction entry forms
/sc:shadcn demo table             # Transaction history
/sc:shadcn demo badge             # Status indicators
```

### Inventory Management
```bash
/sc:shadcn demo card              # Item display cards
/sc:shadcn demo dialog            # Item detail modals
/sc:shadcn demo alert             # Status notifications
```

### Dashboard & Reports
```bash
/sc:shadcn block dashboard-01     # Main dashboard layout
/sc:shadcn demo tabs              # Organize different views
/sc:shadcn demo breadcrumb        # Navigation structure
```

## 🚀 Getting Started

1. **Verify server**: Ensure MCP server is running
2. **Explore components**: Use `/sc:shadcn list` to see options
3. **Study patterns**: Use `/sc:shadcn demo [component]` for examples
4. **Implement**: Use `/sc:shadcn get [component]` for source code
5. **Integrate**: Follow TypeScript patterns exactly

## 🔗 Additional Resources

- **MCP Documentation**: `/mcp-servers/shadcn-ui-mcp-server/docs/`
- **Official ShadCN**: https://ui.shadcn.com/
- **Component Gallery**: https://ui.shadcn.com/components
- **Block Gallery**: https://ui.shadcn.com/blocks

---

**Remember**: The `/sc:shadcn` command is your gateway to professional, accessible UI components. Always use the MCP server instead of manual implementation for consistent, high-quality results.