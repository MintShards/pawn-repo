# Archived Scripts

This directory contains one-time utility scripts that have been executed and are kept for historical reference.

## cleanup_null_formatted_ids.py

**Date**: October 6, 2025
**Purpose**: Remove transactions with null formatted_id values that were causing duplicate key errors on the unique index.

**Context**: During the overdue fee feature implementation, we discovered legacy transactions in the database that had null `formatted_id` values. This violated the unique index constraint on the `formatted_id` field.

**Execution**: Script was run once to clean up the database. All future transactions properly generate formatted IDs (PW000XXX format) using the FormattedIdService.

**Status**: ✅ Completed - Database is clean, no longer needed for regular operations.
