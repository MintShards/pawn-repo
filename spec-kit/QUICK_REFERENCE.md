# Spec Kit Quick Reference

## Essential Commands

### `/specify [feature-description]`
Creates business-focused specification for new feature
- **Example**: `/specify mobile receipt generation with email and SMS delivery`
- **Output**: `spec-kit/specs/mobile-receipt-generation.md`
- **Focus**: WHAT users need and WHY (no technical details)

### `/plan [spec-file]`
Generates technical implementation plan from specification
- **Example**: `/plan mobile-receipt-generation.md`  
- **Output**: `spec-kit/plans/mobile-receipt-technical-plan.md`
- **Focus**: HOW to implement (architecture, APIs, database)

### `/tasks [plan-file]`
Breaks down technical plan into development tasks
- **Example**: `/tasks mobile-receipt-technical-plan.md`
- **Output**: `spec-kit/tasks/mobile-receipt-tasks.md`
- **Focus**: Actionable development work with priorities

## File Locations

```
spec-kit/
├── specs/           # Business specifications (/specify output)
├── plans/           # Technical plans (/plan output)  
├── tasks/           # Development tasks (/tasks output)
├── memory/          # Constitution and project memory
└── templates/       # Reusable templates
```

## Workflow Pattern

```
Business Need → /specify → Review Spec → /plan → Review Plan → /tasks → Implement
```

## Constitution Compliance Checklist

Before any implementation, verify:
- [ ] Business value clearly defined
- [ ] Security requirements addressed  
- [ ] Test coverage plan (80%+ target)
- [ ] Async/await patterns planned
- [ ] Audit trail considerations
- [ ] Performance targets defined (<200ms API)

## Common Use Cases

### New Feature Development
```bash
/specify inventory management with barcode scanning and categorization
/plan inventory-management.md
/tasks inventory-management-technical-plan.md
```

### API Enhancement  
```bash
/specify enhanced search with fuzzy matching and filters
/plan enhanced-search.md
/tasks enhanced-search-technical-plan.md
```

### User Interface Improvements
```bash
/specify responsive mobile dashboard for transaction management  
/plan responsive-mobile-dashboard.md
/tasks responsive-mobile-dashboard-technical-plan.md
```

### Integration Projects
```bash
/specify payment processor integration with multiple providers
/plan payment-processor-integration.md
/tasks payment-processor-integration-technical-plan.md
```

## Quality Standards

### Specifications Must Have:
- Clear user scenarios
- Testable acceptance criteria
- Bounded scope
- Business value justification

### Technical Plans Must Include:
- Database schema changes
- API endpoint design
- Security considerations
- Performance implications
- Testing strategy

### Tasks Must Specify:
- Acceptance criteria
- Dependencies
- Testing requirements
- Estimated complexity

## Pro Tips

1. **Start Small**: Begin with simple features to learn the workflow
2. **Mark Ambiguities**: Use [NEEDS CLARIFICATION] for unclear requirements
3. **Reference Constitution**: Check compliance at each step
4. **Validate Early**: Review specs/plans before implementation
5. **Think Business First**: Always start with user value, not technical solution