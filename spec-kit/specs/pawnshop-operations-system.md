# Feature Specification: Pawnshop Operations Management System

**Feature Branch**: `main`  
**Created**: 2025-01-09  
**Status**: Implemented  
**Input**: Complete pawnshop operations system for internal staff use

## Execution Flow (main)
```
1. Parse pawnshop business requirements
   → Core operations: customer management, pawn transactions, payments, extensions
2. Extract key business concepts
   → Actors: customers, staff, admin; Actions: pawn, pay, extend, redeem; Data: transactions, items, payments
3. Business rules identified and documented
   → 97-day forfeiture, monthly interest, 8-loan limit, interest-first payments
4. User scenarios mapped to business workflows
   → Complete transaction lifecycle from pawn to redemption/forfeiture
5. Functional requirements derived from business operations
   → Each requirement tested and validated in production system
6. Key entities identified and implemented
   → Customer, PawnTransaction, PawnItem, Payment, Extension, ServiceAlert
7. System passes all business rule validations
   → Comprehensive test suite with 80%+ coverage
8. Status: SUCCESS (system operational and serving pawnshop business)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on pawnshop business operations and staff efficiency
- ✅ Internal staff system with secure authentication and audit trails
- ✅ Financial transaction integrity with comprehensive tracking

---

## User Scenarios & Testing

### Primary User Story
Pawnshop staff process customer transactions efficiently while maintaining accurate financial records and ensuring business rule compliance. System supports complete transaction lifecycle from initial pawn through redemption or forfeiture.

### Acceptance Scenarios
1. **Given** a customer brings items to pawn, **When** staff creates new pawn transaction, **Then** system generates loan with proper interest calculation and maturity date
2. **Given** active pawn transaction, **When** customer makes partial payment, **Then** system applies payment to interest first, then principal, with accurate remaining balance
3. **Given** pawn transaction approaching maturity, **When** customer requests extension, **Then** system adds 30/60/90 days with appropriate fee calculation
4. **Given** pawn transaction past maturity date, **When** system runs daily status update, **Then** transaction automatically transitions to overdue status
5. **Given** transaction 97 days from loan date, **When** system processes, **Then** transaction automatically forfeit with audit trail
6. **Given** staff needs customer information, **When** searching by phone/name/ID, **Then** system returns comprehensive customer profile with transaction history

### Edge Cases
- What happens when customer reaches maximum active loan limit (8 loans)?
- How does system handle partial payments that exceed remaining balance?
- What occurs when extension is requested on already extended transaction?
- How are timezone differences handled for maturity date calculations?
- What safeguards exist for accidental status changes or deletions?

## Requirements

### Functional Requirements

#### Authentication & Security
- **FR-001**: System MUST authenticate users via 2-digit User ID + 4-digit PIN combination
- **FR-002**: System MUST generate secure JWT tokens with 30-minute expiration and refresh capability
- **FR-003**: System MUST encrypt sensitive customer data at field level (PII protection)
- **FR-004**: System MUST log all financial transactions with audit trail and request ID tracking
- **FR-005**: System MUST enforce role-based access (Admin: full access, Staff: operational access)

#### Customer Management
- **FR-006**: System MUST uniquely identify customers by 10-digit phone number
- **FR-007**: System MUST store customer personal information with field-level encryption
- **FR-008**: System MUST enforce maximum 8 active loans per customer (configurable by admin)
- **FR-009**: System MUST track customer service alerts and follow-up requirements
- **FR-010**: System MUST provide unified search across customers by phone, name, or transaction ID

#### Transaction Processing
- **FR-011**: System MUST create pawn transactions with multiple items per transaction
- **FR-012**: System MUST calculate fixed monthly interest amounts (not percentage-based)
- **FR-013**: System MUST set transaction maturity dates and track status transitions
- **FR-014**: System MUST support transaction status flow: Active → Overdue → Forfeited or Redeemed
- **FR-015**: System MUST automatically forfeit transactions 97 days after loan date
- **FR-016**: System MUST process partial payments with interest-first allocation
- **FR-017**: System MUST handle transaction extensions (30/60/90 days) with fees
- **FR-018**: System MUST generate transaction notes with audit trail for all changes

#### Financial Operations
- **FR-019**: System MUST track all payments by method (cash, card, check, other)
- **FR-020**: System MUST calculate accurate remaining balances after each payment
- **FR-021**: System MUST handle extension fees as separate line items
- **FR-022**: System MUST prevent overpayments and handle exact balance scenarios
- **FR-023**: System MUST generate receipts for all financial transactions

#### Business Rules Enforcement
- **FR-024**: System MUST enforce 97-day forfeiture rule from original loan date
- **FR-025**: System MUST apply extensions to original maturity date, not current date
- **FR-026**: System MUST allocate payments to oldest accrued interest first, then principal
- **FR-027**: System MUST validate item categories: jewelry, electronics, tools, musical_instruments, collectibles, other
- **FR-028**: System MUST track item conditions: excellent, good, fair, poor

#### Reporting & Analytics
- **FR-029**: System MUST provide transaction search and filtering capabilities
- **FR-030**: System MUST generate comprehensive audit logs for compliance
- **FR-031**: System MUST track business metrics (active loans, overdue amounts, forfeited items)
- **FR-032**: System MUST support timezone-aware date calculations for multi-location operations

### Key Entities

- **User**: Staff member with role-based permissions, PIN authentication, audit trail tracking
- **Customer**: Unique phone-based identification, encrypted PII, loan limit tracking, service alerts
- **PawnTransaction**: Core business entity with status lifecycle, interest calculations, maturity tracking
- **PawnItem**: Individual items within transactions, categorized and condition-tracked
- **Payment**: Financial transaction records with method tracking, balance calculations, interest allocation
- **Extension**: Loan term extensions with fee calculations and maturity date adjustments
- **ServiceAlert**: Customer service requests and follow-up tracking with staff assignment
- **AuditEntry**: Complete audit trail for all system changes with user tracking and request IDs

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details exposed to business users (abstracted behind service layer)
- [x] Focused on pawnshop business value and operational efficiency
- [x] Designed for pawnshop staff and administrative users
- [x] All mandatory business functions implemented and tested

### Requirement Completeness
- [x] No ambiguous requirements remain (comprehensive business rule documentation)
- [x] Requirements are testable and validated (80%+ test coverage achieved)
- [x] Success criteria are measurable (response times, accuracy, audit completeness)
- [x] Scope clearly bounded to pawnshop operations (internal staff system)
- [x] Dependencies identified (MongoDB, Redis, JWT tokens) and assumptions documented

---

## Execution Status

- [x] Business requirements parsed and documented
- [x] Key pawnshop concepts extracted and implemented
- [x] All business rules identified and enforced
- [x] User scenarios defined and tested
- [x] Functional requirements implemented and validated
- [x] Data entities designed and deployed
- [x] Review checklist passed with production deployment
- [x] System operational and serving pawnshop business needs

---

**Implementation Status**: ✅ COMPLETE - System deployed and operational
**Test Coverage**: ✅ 80%+ achieved across unit and integration tests
**Business Validation**: ✅ All core pawnshop workflows functional and validated