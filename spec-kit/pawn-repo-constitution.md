# Pawn-Repo Constitution

## Core Principles

### I. Business-First Development
Every feature must directly serve pawnshop operations with measurable business value. Features must enhance customer service, improve transaction efficiency, or reduce operational risk. No feature is developed without clear business justification and user validation.

### II. Security & Compliance (NON-NEGOTIABLE)
All customer data is encrypted at rest and in transit. PIN-based authentication with secure JWT tokens. Comprehensive audit trails for all financial transactions. NEVER compromise security for convenience or speed. Field-level encryption for PII data.

### III. Test-First Quality Assurance (NON-NEGOTIABLE)  
TDD mandatory: Tests written → User approved → Tests fail → Then implement. 80%+ coverage requirement strictly enforced. Red-Green-Refactor cycle for all new features. Integration tests for transaction workflows and payment processing.

### IV. Async-First Architecture
All database operations and API endpoints use async/await patterns. Service layer isolates business logic from API handlers. MongoDB with Beanie ODM for scalable async document operations. Performance targets: <200ms API response times.

### V. Production-Ready Operations
Structured logging with request IDs for debugging. Prometheus metrics for monitoring. Redis caching with fallback strategies. Environment-based configuration with secrets management. Database migrations and backup strategies.

## Technical Standards

### Technology Stack Requirements
- **Frontend**: React 19 + ShadCN UI + Tailwind CSS for modern, accessible interfaces
- **Backend**: FastAPI + Python 3.x + async/await for high-performance APIs  
- **Database**: MongoDB + Beanie ODM for scalable document storage
- **Authentication**: PIN-based (2-digit User ID + 4-digit PIN) + JWT tokens
- **Testing**: pytest with async support, minimum 80% coverage
- **Monitoring**: Prometheus metrics + structured logging with structlog

### Data Integrity Standards
- UTC storage with timezone-aware business logic for all timestamps
- Interest-first payment allocation with audit trails
- Automatic transaction status transitions based on business rules
- Customer loan limits enforced at application layer (max 8 active loans)
- Comprehensive audit entries for all state changes with request tracking

## Development Workflow

### Quality Gates
1. **Syntax & Type Validation**: Language parsers, type checking, linting
2. **Security Review**: Vulnerability scanning, authentication validation
3. **Test Coverage**: 80% unit tests, 70% integration tests minimum
4. **Performance Validation**: API response time <200ms, database query optimization
5. **Business Logic Verification**: Service layer testing, transaction workflow validation
6. **Documentation Updates**: API docs, user guides, deployment procedures
7. **Integration Testing**: End-to-end workflows, cross-component validation
8. **Deployment Readiness**: Environment configuration, database migrations, monitoring setup

### Review Requirements
- All PRs require business logic validation against pawn shop requirements
- Security review mandatory for authentication, payments, and customer data features
- Performance benchmarking required for database queries and API endpoints
- UI/UX validation for customer-facing interfaces with accessibility compliance

## Governance

Constitution supersedes all other development practices. Amendments require documentation, team approval, and migration plan. All features must comply with business rules: 97-day forfeiture timeline, monthly interest calculations, partial payment allocation (interest first), extension processing (30/60/90 days).

**Complexity Justification Required**: Any deviation from established patterns must be documented and approved. Use CLAUDE.md for runtime development guidance and architectural decisions.

**Version**: 1.0.0 | **Ratified**: 2025-01-09 | **Last Amended**: 2025-01-09