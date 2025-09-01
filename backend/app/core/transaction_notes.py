"""
Transaction Notes Utility

Shared utility functions for consistent internal notes handling across all services.
Provides standardized truncation, validation, and formatting for transaction notes.
"""

# Standard library imports
from typing import Optional
from datetime import datetime, UTC
import re


class NotesError(Exception):
    """Base exception for notes handling operations"""
    pass


class NotesValidationError(NotesError):
    """Notes validation related errors"""
    pass


def safe_append_transaction_notes(
    existing_notes: Optional[str],
    new_note: str,
    max_length: int = 500,
    add_timestamp: bool = True,
    user_id: Optional[str] = None
) -> str:
    """
    Safely append a new note to existing transaction notes with intelligent truncation.
    
    Ensures total length stays within limits while preserving the most recent and
    important information. Uses smart truncation that prioritizes new notes.
    
    Args:
        existing_notes: Current internal notes (can be None or empty)
        new_note: New note to append
        max_length: Maximum total length (default: 500 characters)
        add_timestamp: Whether to add timestamp prefix to new note
        user_id: Optional user ID to include in timestamp
        
    Returns:
        Combined notes string within length limit
        
    Raises:
        NotesValidationError: If new_note is invalid or too long
        
    Example:
        notes = safe_append_transaction_notes(
            transaction.internal_notes,
            f"Payment of ${amount} processed",
            user_id="02"
        )
        transaction.internal_notes = notes
    """
    # Validate new note
    if not new_note or not new_note.strip():
        raise NotesValidationError("New note cannot be empty")
    
    new_note = new_note.strip()
    
    # Format new note with timestamp if requested
    if add_timestamp:
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        user_prefix = f" by {user_id}" if user_id else ""
        formatted_new_note = f"[{timestamp}{user_prefix}] {new_note}"
    else:
        formatted_new_note = new_note
    
    # Check if new note alone exceeds maximum length
    if len(formatted_new_note) > max_length:
        raise NotesValidationError(
            f"New note too long ({len(formatted_new_note)} chars). "
            f"Maximum allowed: {max_length} characters"
        )
    
    # Handle empty or None existing notes
    if not existing_notes:
        return formatted_new_note
    
    existing_notes = existing_notes.strip()
    if not existing_notes:
        return formatted_new_note
    
    # Combine notes with newline separator
    combined = f"{existing_notes}\n{formatted_new_note}".strip()
    
    # If combined length is within limits, return as-is
    if len(combined) <= max_length:
        return combined
    
    # Need to truncate - prioritize new note
    available_for_existing = max_length - len(formatted_new_note) - 1  # -1 for newline
    
    if available_for_existing <= 0:
        # New note takes up all available space
        return formatted_new_note
    
    if available_for_existing < 10:
        # Not enough space for meaningful existing notes
        return formatted_new_note
    
    # Truncate existing notes intelligently
    truncated_existing = _smart_truncate_existing_notes(
        existing_notes, 
        available_for_existing
    )
    
    return f"{truncated_existing}\n{formatted_new_note}".strip()


def _smart_truncate_existing_notes(existing_notes: str, available_space: int) -> str:
    """
    Intelligently truncate existing notes to fit available space.
    
    Preserves the most recent entries and important information by:
    1. Keeping complete timestamp blocks when possible
    2. Truncating from the beginning (oldest entries)
    3. Adding ellipsis indicator for truncation
    
    Args:
        existing_notes: Notes to truncate
        available_space: Available characters including ellipsis
        
    Returns:
        Truncated notes with ellipsis indicator
    """
    if len(existing_notes) <= available_space:
        return existing_notes
    
    # Reserve space for ellipsis
    ellipsis = "..."
    content_space = available_space - len(ellipsis)
    
    if content_space <= 0:
        return ellipsis[:available_space]
    
    # Try to find natural break points (timestamp boundaries)
    # Look for pattern like "[2024-01-15 14:30 UTC" at beginning of lines
    timestamp_pattern = r'\n\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC'
    
    # Find all timestamp positions
    timestamps = list(re.finditer(timestamp_pattern, existing_notes))
    
    if not timestamps:
        # No timestamps found, simple truncation from start
        return ellipsis + existing_notes[-(content_space):]
    
    # Try to keep complete timestamp blocks from the end
    for i in range(len(timestamps) - 1, -1, -1):
        start_pos = timestamps[i].start() + 1  # +1 to skip the newline
        candidate = existing_notes[start_pos:]
        
        if len(candidate) <= content_space:
            return ellipsis + candidate
    
    # If no complete blocks fit, truncate the last block
    if timestamps:
        last_start = timestamps[-1].start() + 1
        last_block = existing_notes[last_start:]
        
        if len(last_block) > content_space:
            # Truncate within the last block
            return ellipsis + last_block[-content_space:]
        else:
            return ellipsis + last_block
    
    # Fallback: simple truncation from end
    return ellipsis + existing_notes[-content_space:]


def validate_notes_content(notes: str, max_length: int = 500) -> bool:
    """
    Validate notes content for compliance with business rules.
    
    Args:
        notes: Notes content to validate
        max_length: Maximum allowed length
        
    Returns:
        True if valid
        
    Raises:
        NotesValidationError: If validation fails
    """
    if notes is None:
        return True  # None/empty notes are allowed
    
    if not isinstance(notes, str):
        raise NotesValidationError("Notes must be a string")
    
    if len(notes) > max_length:
        raise NotesValidationError(
            f"Notes too long ({len(notes)} chars). Maximum: {max_length} characters"
        )
    
    # Check for potentially problematic characters
    if '\x00' in notes:  # Null bytes
        raise NotesValidationError("Notes cannot contain null bytes")
    
    # Check for excessive whitespace
    if notes != notes.strip() and len(notes) > len(notes.strip()) + 2:
        raise NotesValidationError("Notes contain excessive leading/trailing whitespace")
    
    return True


def format_system_note(
    action: str,
    details: Optional[str] = None,
    user_id: Optional[str] = None,
    amount: Optional[int] = None,
    add_timestamp: bool = True
) -> str:
    """
    Format a standardized system note with consistent structure.
    
    Args:
        action: Primary action (e.g., "Payment processed", "Extension applied")
        details: Optional additional details
        user_id: Optional user ID who performed the action
        amount: Optional monetary amount (in whole dollars)
        add_timestamp: Whether to include timestamp prefix
        
    Returns:
        Formatted system note
        
    Example:
        note = format_system_note(
            action="Payment processed",
            details="Balance after payment: $150",
            user_id="02",
            amount=200
        )
        # Returns: "[2024-01-15 14:30 UTC by 02] Payment processed ($200). Balance after payment: $150"
    """
    # Build the core message
    message_parts = [action]
    
    # Add amount if provided
    if amount is not None:
        message_parts[0] = f"{action} (${amount:,})"
    
    # Add details if provided
    if details:
        message_parts.append(details)
    
    message = ". ".join(message_parts)
    
    # Add timestamp prefix if requested
    if add_timestamp:
        timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        user_prefix = f" by {user_id}" if user_id else ""
        return f"[{timestamp}{user_prefix}] {message}"
    
    return message


def clean_notes_for_display(notes: Optional[str]) -> str:
    """
    Clean and format notes for display in UI or reports.
    
    Args:
        notes: Raw notes content
        
    Returns:
        Cleaned notes suitable for display
    """
    if not notes:
        return ""
    
    # Remove excessive whitespace but preserve intentional formatting
    lines = [line.rstrip() for line in notes.split('\n')]
    
    # Remove empty lines at start and end
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    
    return '\n'.join(lines)


def extract_notes_summary(notes: Optional[str], max_length: int = 100) -> str:
    """
    Extract a summary from notes for quick display.
    
    Prioritizes recent entries and important information.
    
    Args:
        notes: Notes to summarize
        max_length: Maximum summary length
        
    Returns:
        Summary string
    """
    if not notes:
        return "No notes"
    
    cleaned = clean_notes_for_display(notes)
    
    if len(cleaned) <= max_length:
        return cleaned
    
    # Try to get the most recent complete entry
    lines = cleaned.split('\n')
    if lines:
        # Start from the last line and work backwards
        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if line and len(line) <= max_length - 3:  # -3 for potential ellipsis
                return line
    
    # Fallback: truncate from end with ellipsis
    return cleaned[-max_length+3:].lstrip() + "..."


def count_notes_entries(notes: Optional[str]) -> int:
    """
    Count the number of timestamped entries in notes.
    
    Args:
        notes: Notes content to analyze
        
    Returns:
        Number of timestamped entries found
    """
    if not notes:
        return 0
    
    # Count timestamp patterns
    timestamp_pattern = r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC'
    matches = re.findall(timestamp_pattern, notes)
    
    return len(matches)


# Business rule constants
MAX_NOTES_LENGTH = 500
MAX_SINGLE_NOTE_LENGTH = 300  # Maximum length for a single note entry
TRUNCATION_ELLIPSIS = "..."

# Validation patterns
TIMESTAMP_PATTERN = re.compile(r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC(?:\s+by\s+\w+)?\]')
SYSTEM_NOTE_PATTERN = re.compile(r'\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC(?:\s+by\s+\w+)?\]\s+(.+)')