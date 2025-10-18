# Archived Scripts

This directory contains one-time utility scripts that have been executed and are kept for historical reference.

## backfill_last_transaction_date.py

**Date**: October 18, 2025
**Purpose**: Backfill `last_transaction_date` field for all existing customers based on their most recent pawn transaction.

**Context**: During Advanced Filters implementation, the `last_transaction_date` field was added to the Customer model to enable "Last Activity" filtering (Active within X days / Inactive for X days). Existing customers in the database needed this field populated from historical transaction data.

**Execution**: Script was run once to populate the field for all customers with transactions. Used MongoDB aggregation pipeline to find most recent `pawn_date` for each customer and update their `last_transaction_date` field.

**Status**: ✅ Completed - Field is now automatically maintained by `PawnTransactionService` (line 252) when new transactions are created. No longer needed for regular operations.

---

## cleanup_null_formatted_ids.py

**Date**: October 6, 2025
**Purpose**: Remove transactions with null formatted_id values that were causing duplicate key errors on the unique index.

**Context**: During the overdue fee feature implementation, we discovered legacy transactions in the database that had null `formatted_id` values. This violated the unique index constraint on the `formatted_id` field.

**Execution**: Script was run once to clean up the database. All future transactions properly generate formatted IDs (PW000XXX format) using the FormattedIdService.

**Status**: ✅ Completed - Database is clean, no longer needed for regular operations.
