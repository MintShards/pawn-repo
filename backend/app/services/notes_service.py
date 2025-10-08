"""
Notes Management Service

Service for managing the new separate notes architecture with manual staff notes
and structured system audit logs. Provides utilities for migration, display,
and management of transaction notes.
"""

import re
from typing import Optional, List, Dict, Tuple, Any
from datetime import datetime, UTC

from app.models.audit_entry_model import (
    AuditEntry,
    AuditActionType,
    create_payment_audit,
    create_extension_audit,
    create_status_change_audit,
    create_redemption_audit,
    create_discount_audit
)
from app.models.pawn_transaction_model import PawnTransaction


class NotesService:
    """
    Service for managing transaction notes with the new separate architecture.
    
    Provides utilities for:
    - Adding manual staff notes safely
    - Creating and managing system audit entries  
    - Migrating legacy internal_notes data
    - Generating combined displays for backward compatibility
    """
    
    @staticmethod
    async def add_manual_note(
        transaction: PawnTransaction,
        note: str,
        staff_member: str,
        save_immediately: bool = True
    ) -> None:
        """
        Add a manual staff note to a transaction.
        
        Args:
            transaction: PawnTransaction to add note to
            note: Manual note text
            staff_member: User ID of staff member adding note
            save_immediately: Whether to save the transaction immediately
        """
        transaction.add_manual_note(note, staff_member)
        
        if save_immediately:
            await transaction.save()
    
    @staticmethod
    async def add_system_audit(
        transaction: PawnTransaction,
        action_type: AuditActionType,
        staff_member: str,
        action_summary: str,
        details: Optional[str] = None,
        amount: Optional[int] = None,
        previous_value: Optional[str] = None,
        new_value: Optional[str] = None,
        related_id: Optional[str] = None,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add a system audit entry to a transaction.
        
        Args:
            transaction: PawnTransaction to add audit entry to
            action_type: Type of audit action
            staff_member: User ID of staff member who performed action
            action_summary: Brief description of action
            details: Optional additional details
            amount: Optional monetary amount
            previous_value: Previous value for updates
            new_value: New value for updates
            related_id: Related record ID
            save_immediately: Whether to save the transaction immediately
            
        Returns:
            Created AuditEntry
        """
        audit_entry = AuditEntry(
            action_type=action_type,
            staff_member=staff_member,
            action_summary=action_summary,
            details=details,
            amount=amount,
            previous_value=previous_value,
            new_value=new_value,
            related_id=related_id
        )
        
        transaction.add_system_audit_entry(audit_entry)
        
        if save_immediately:
            await transaction.save()
        
        return audit_entry
    
    @staticmethod
    async def add_payment_audit(
        transaction: PawnTransaction,
        staff_member: str,
        amount: int,
        balance_after: int,
        payment_id: str,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add a payment processing audit entry.
        
        Args:
            transaction: PawnTransaction to add audit entry to
            staff_member: User ID processing payment
            amount: Payment amount
            balance_after: Balance remaining after payment
            payment_id: Payment record ID
            save_immediately: Whether to save immediately
            
        Returns:
            Created AuditEntry
        """
        audit_entry = create_payment_audit(staff_member, amount, balance_after, payment_id)
        transaction.add_system_audit_entry(audit_entry)
        
        if save_immediately:
            await transaction.save()
        
        return audit_entry
    
    @staticmethod
    async def add_extension_audit(
        transaction: PawnTransaction,
        staff_member: str,
        months: int,
        new_maturity: str,
        extension_id: str,
        fee: Optional[int] = None,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add an extension processing audit entry.
        
        Args:
            transaction: PawnTransaction to add audit entry to
            staff_member: User ID processing extension
            months: Number of months extended
            new_maturity: New maturity date string
            extension_id: Extension record ID
            fee: Optional extension fee
            save_immediately: Whether to save immediately
            
        Returns:
            Created AuditEntry
        """
        audit_entry = create_extension_audit(staff_member, months, new_maturity, extension_id, fee)
        transaction.add_system_audit_entry(audit_entry)
        
        if save_immediately:
            await transaction.save()
        
        return audit_entry
    
    @staticmethod
    async def add_status_change_audit(
        transaction: PawnTransaction,
        staff_member: str,
        old_status: str,
        new_status: str,
        reason: Optional[str] = None,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add a status change audit entry.
        
        Args:
            transaction: PawnTransaction to add audit entry to
            staff_member: User ID making status change
            old_status: Previous status
            new_status: New status
            reason: Optional reason for change
            save_immediately: Whether to save immediately
            
        Returns:
            Created AuditEntry
        """
        audit_entry = create_status_change_audit(staff_member, old_status, new_status, reason)
        transaction.add_system_audit_entry(audit_entry)
        
        if save_immediately:
            await transaction.save()
        
        return audit_entry
    
    @staticmethod
    async def add_redemption_audit(
        transaction: PawnTransaction,
        staff_member: str,
        total_paid: int,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add a redemption completion audit entry.
        
        Args:
            transaction: PawnTransaction to add audit entry to
            staff_member: User ID processing redemption
            total_paid: Total amount paid for redemption
            save_immediately: Whether to save immediately
            
        Returns:
            Created AuditEntry
        """
        audit_entry = create_redemption_audit(staff_member, total_paid)
        transaction.add_system_audit_entry(audit_entry)

        if save_immediately:
            await transaction.save()

        return audit_entry

    @staticmethod
    async def add_discount_audit(
        transaction: PawnTransaction,
        staff_member: str,
        discount_amount: int,
        discount_reason: str,
        approved_by: str,
        payment_id: str,
        save_immediately: bool = True
    ) -> AuditEntry:
        """
        Add a discount application audit entry.

        Args:
            transaction: PawnTransaction to add audit entry to
            staff_member: User ID who processed the payment with discount
            discount_amount: Discount amount applied
            discount_reason: Reason for discount
            approved_by: Admin user ID who approved the discount
            payment_id: ID of the payment with discount
            save_immediately: Whether to save immediately

        Returns:
            Created AuditEntry
        """
        audit_entry = create_discount_audit(
            staff_member=staff_member,
            discount_amount=discount_amount,
            discount_reason=discount_reason,
            approved_by=approved_by,
            payment_id=payment_id
        )
        transaction.add_system_audit_entry(audit_entry)

        if save_immediately:
            await transaction.save()

        return audit_entry

    @staticmethod
    def parse_legacy_internal_notes(legacy_notes: str) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Parse legacy internal_notes string to separate manual and system entries.
        
        Used for migrating existing data to the new architecture.
        
        Args:
            legacy_notes: Original internal_notes string
            
        Returns:
            Tuple of (manual_notes_list, system_entries_data)
        """
        if not legacy_notes or not legacy_notes.strip():
            return [], []
        
        manual_notes = []
        system_entries = []
        
        # Split by lines and process each entry
        lines = legacy_notes.split('\n')
        current_entry = []
        
        # Regex pattern for timestamped entries
        timestamp_pattern = re.compile(r'^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)(?:\s+by\s+(\w+))?\]\s+(.+)$')
        
        # Known system action indicators
        system_indicators = [
            'Payment processed', 'Extension applied', 'Extension cancelled',
            'Status changed', 'Transaction redeemed', 'Balance after payment',
            'Extended', 'New maturity', 'Extension fee', 'Redemption completed'
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            match = timestamp_pattern.match(line)
            if match:
                # This is a timestamped entry
                timestamp_str = match.group(1)
                user_id = match.group(2) or "unknown"
                content = match.group(3)
                
                # Try to parse timestamp
                try:
                    timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M UTC").replace(tzinfo=UTC)
                except ValueError:
                    timestamp = datetime.now(UTC)
                
                # Determine if this looks like a system entry
                is_system = any(indicator in content for indicator in system_indicators)
                
                if is_system:
                    # Try to extract system entry data
                    action_type = NotesService._determine_action_type(content)
                    amount = NotesService._extract_amount(content)
                    
                    system_entries.append({
                        "timestamp": timestamp,
                        "action_type": action_type,
                        "staff_member": user_id,
                        "action_summary": content.split('.')[0].strip(),
                        "details": content if '.' in content else None,
                        "amount": amount
                    })
                else:
                    # This is a manual note
                    manual_notes.append(line)
            else:
                # This line doesn't match timestamp pattern
                # Could be continuation of previous entry or standalone note
                if manual_notes:
                    # Add to last manual note as continuation
                    manual_notes[-1] += f"\n{line}"
                else:
                    # Treat as manual note without timestamp
                    manual_notes.append(line)
        
        return manual_notes, system_entries
    
    @staticmethod
    def _determine_action_type(content: str) -> AuditActionType:
        """Determine action type from legacy note content."""
        content_lower = content.lower()
        
        if 'payment processed' in content_lower or 'payment of $' in content_lower:
            return AuditActionType.PAYMENT_PROCESSED
        elif 'extension applied' in content_lower or 'extended' in content_lower:
            return AuditActionType.EXTENSION_APPLIED
        elif 'extension cancelled' in content_lower:
            return AuditActionType.EXTENSION_CANCELLED
        elif 'status changed' in content_lower or 'status' in content_lower:
            return AuditActionType.STATUS_CHANGED
        elif 'redeemed' in content_lower or 'redemption' in content_lower:
            return AuditActionType.REDEMPTION_COMPLETED
        else:
            return AuditActionType.SYSTEM_NOTIFICATION
    
    @staticmethod
    def _extract_amount(content: str) -> Optional[int]:
        """Extract monetary amount from legacy note content."""
        # Look for patterns like $123, $1,234, etc.
        import re
        amount_pattern = re.compile(r'\$(\d{1,3}(?:,\d{3})*)')
        match = amount_pattern.search(content)
        
        if match:
            # Remove commas and convert to int
            amount_str = match.group(1).replace(',', '')
            try:
                return int(amount_str)
            except ValueError:
                pass
        
        return None
    
    @staticmethod
    async def migrate_transaction_notes(transaction: PawnTransaction) -> bool:
        """
        Migrate a transaction's legacy internal_notes to the new architecture.
        
        Args:
            transaction: PawnTransaction to migrate
            
        Returns:
            True if migration was successful, False otherwise
        """
        if not transaction.internal_notes:
            return True  # Nothing to migrate
        
        # Skip if already migrated (has manual_notes or system_audit_log)
        if transaction.manual_notes or transaction.system_audit_log:
            return True  # Already migrated
        
        try:
            manual_notes_list, system_entries_data = NotesService.parse_legacy_internal_notes(
                transaction.internal_notes
            )
            
            # Set manual notes
            if manual_notes_list:
                transaction.manual_notes = '\n'.join(manual_notes_list)
            
            # Create system audit entries
            if system_entries_data:
                audit_entries = []
                for entry_data in system_entries_data:
                    audit_entry = AuditEntry(
                        timestamp=entry_data['timestamp'],
                        action_type=entry_data['action_type'],
                        staff_member=entry_data['staff_member'],
                        action_summary=entry_data['action_summary'],
                        details=entry_data.get('details'),
                        amount=entry_data.get('amount')
                    )
                    audit_entries.append(audit_entry)
                
                transaction.system_audit_log = audit_entries
            
            # Save the migrated transaction
            await transaction.save()
            return True
            
        except Exception as e:
            # Log error in production, for now return False
            pass
            return False
    
    @staticmethod
    def get_notes_display_data(transaction: PawnTransaction) -> Dict[str, Any]:
        """
        Get structured data for notes display in UI.
        
        Args:
            transaction: PawnTransaction to get display data for
            
        Returns:
            Dictionary with separated notes data for UI display
        """
        return {
            "manual_notes": transaction.get_manual_notes_only(),
            "system_audit_summary": transaction.get_system_audit_summary(limit=10),
            "audit_entry_count": transaction.count_audit_entries(),
            "legacy_notes": transaction.internal_notes,
            "combined_display": transaction.get_combined_notes_display(max_length=1000)
        }
    
    @staticmethod
    def validate_notes_migration(transaction: PawnTransaction) -> Dict[str, Any]:
        """
        Validate that notes migration was successful.
        
        Args:
            transaction: PawnTransaction to validate
            
        Returns:
            Validation results dictionary
        """
        results = {
            "is_migrated": bool(transaction.manual_notes or transaction.system_audit_log),
            "has_legacy_notes": bool(transaction.internal_notes),
            "has_manual_notes": bool(transaction.manual_notes),
            "has_system_audit": bool(transaction.system_audit_log),
            "audit_count": transaction.count_audit_entries(),
            "legacy_length": len(transaction.internal_notes or ""),
            "manual_length": len(transaction.manual_notes or ""),
            "migration_needed": bool(transaction.internal_notes and 
                                   not (transaction.manual_notes or transaction.system_audit_log))
        }
        
        return results


# Singleton instance for easy import
notes_service = NotesService()