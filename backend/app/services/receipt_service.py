"""
Receipt PDF Generation Service

Handles generating professional PDF receipts for pawn transactions.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

from ..models.transaction_model import Transaction
from ..models.customer_model import Customer
from ..models.item_model import Item
from ..models.user_model import User
from ..core.config import settings


class ReceiptService:
    """Service for generating pawn shop receipts."""
    
    def __init__(self):
        self.page_width = letter[0]
        self.page_height = letter[1]
        self.margin = 0.75 * inch
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Set up custom paragraph styles for receipts."""
        self.styles.add(ParagraphStyle(
            name='ReceiptTitle',
            parent=self.styles['Title'],
            fontSize=18,
            spaceAfter=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1A365D')
        ))
        
        self.styles.add(ParagraphStyle(
            name='ReceiptHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceBefore=6,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#2D3748')
        ))
        
        self.styles.add(ParagraphStyle(
            name='ReceiptSubheader',
            parent=self.styles['Heading3'],
            fontSize=12,
            spaceBefore=4,
            spaceAfter=4,
            textColor=colors.HexColor('#4A5568')
        ))
        
        self.styles.add(ParagraphStyle(
            name='ReceiptBody',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceBefore=2,
            spaceAfter=2
        ))
        
        self.styles.add(ParagraphStyle(
            name='ReceiptSmall',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#718096')
        ))
    
    async def generate_transaction_receipt(
        self,
        transaction: Transaction,
        customer: Customer,
        items: List[Item],
        user: User,
        receipt_type: str = "customer"  # "customer" or "storage"
    ) -> BytesIO:
        """
        Generate a PDF receipt for a pawn transaction.
        
        Args:
            transaction: Transaction object
            customer: Customer object
            items: List of Item objects
            user: User who processed the transaction
            receipt_type: Type of receipt ("customer" or "storage")
        
        Returns:
            BytesIO: PDF receipt data
        """
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=self.margin,
            leftMargin=self.margin,
            topMargin=self.margin,
            bottomMargin=self.margin
        )
        
        # Build the receipt content
        story = []
        
        # Header
        story.extend(self._build_header(receipt_type))
        story.append(Spacer(1, 12))
        
        # Transaction info
        story.extend(self._build_transaction_info(transaction, customer, user))
        story.append(Spacer(1, 12))
        
        # Items table
        story.extend(self._build_items_table(items))
        story.append(Spacer(1, 12))
        
        # Financial summary
        story.extend(self._build_financial_summary(transaction))
        story.append(Spacer(1, 12))
        
        # Payment history (if any)
        # Note: This would need payment data passed in
        story.extend(self._build_payment_history(transaction))
        story.append(Spacer(1, 12))
        
        # Important dates and terms
        story.extend(self._build_terms_and_dates(transaction))
        story.append(Spacer(1, 12))
        
        # Footer
        story.extend(self._build_footer(receipt_type))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _build_header(self, receipt_type: str) -> List[Any]:
        """Build receipt header section."""
        elements = []
        
        # Shop name and logo
        elements.append(Paragraph(
            "PAWN REPO",
            self.styles['ReceiptTitle']
        ))
        
        elements.append(Paragraph(
            "Professional Pawnshop Management",
            self.styles['ReceiptHeader']
        ))
        
        # Receipt type
        receipt_title = "CUSTOMER RECEIPT" if receipt_type == "customer" else "STORAGE COPY"
        elements.append(Paragraph(
            receipt_title,
            self.styles['ReceiptSubheader']
        ))
        
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        
        return elements
    
    def _build_transaction_info(
        self, 
        transaction: Transaction, 
        customer: Customer, 
        user: User
    ) -> List[Any]:
        """Build transaction information section."""
        elements = []
        
        # Transaction details table
        data = [
            ["Transaction #:", str(transaction.transaction_number)],
            ["Date:", transaction.pawn_date.strftime("%m/%d/%Y %I:%M %p")],
            ["Customer:", f"{customer.first_name} {customer.last_name}"],
            ["Phone:", customer.phone],
            ["Processed by:", f"{user.first_name} {user.last_name} (#{user.user_number})"],
        ]
        
        table = Table(data, colWidths=[2*inch, 3*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(table)
        return elements
    
    def _build_items_table(self, items: List[Item]) -> List[Any]:
        """Build items table section."""
        elements = []
        
        elements.append(Paragraph(
            "PAWNED ITEMS",
            self.styles['ReceiptSubheader']
        ))
        
        # Items table headers
        data = [["#", "Description", "Serial Number"]]
        
        # Add items
        for item in items:
            serial = item.serial_number if item.serial_number else "N/A"
            data.append([
                str(item.item_number),
                item.description[:50] + ("..." if len(item.description) > 50 else ""),
                serial
            ])
        
        table = Table(data, colWidths=[0.5*inch, 3.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2E8F0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#2D3748')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')])
        ]))
        
        elements.append(table)
        return elements
    
    def _build_financial_summary(self, transaction: Transaction) -> List[Any]:
        """Build financial summary section."""
        elements = []
        
        elements.append(Paragraph(
            "LOAN DETAILS",
            self.styles['ReceiptSubheader']
        ))
        
        # Calculate values
        loan_amount = float(transaction.loan_amount)
        monthly_interest = float(transaction.monthly_interest)
        current_balance = float(transaction.current_balance)
        
        data = [
            ["Loan Amount:", f"${loan_amount:.2f}"],
            ["Monthly Interest:", f"${monthly_interest:.2f}"],
            ["Current Balance:", f"${current_balance:.2f}"],
        ]
        
        table = Table(data, colWidths=[2*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            # Highlight current balance
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FED7D7')),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#C53030')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        
        elements.append(table)
        return elements
    
    def _build_payment_history(self, transaction: Transaction) -> List[Any]:
        """Build payment history section (placeholder for now)."""
        elements = []
        
        # This would be implemented when payment data is available
        elements.append(Paragraph(
            "PAYMENT HISTORY",
            self.styles['ReceiptSubheader']
        ))
        
        elements.append(Paragraph(
            "No payments recorded yet.",
            self.styles['ReceiptSmall']
        ))
        
        return elements
    
    def _build_terms_and_dates(self, transaction: Transaction) -> List[Any]:
        """Build terms and important dates section."""
        elements = []
        
        elements.append(Paragraph(
            "IMPORTANT DATES & TERMS",
            self.styles['ReceiptSubheader']
        ))
        
        data = [
            ["Pawn Date:", transaction.pawn_date.strftime("%m/%d/%Y")],
            ["Maturity Date:", transaction.maturity_date.strftime("%m/%d/%Y")],
            ["Grace Period Ends:", transaction.grace_end_date.strftime("%m/%d/%Y")],
            ["Status:", transaction.status.value.upper()],
        ]
        
        if transaction.storage_location:
            data.append(["Storage Location:", transaction.storage_location])
        
        table = Table(data, colWidths=[2*inch, 2*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(table)
        
        # Terms text
        terms_text = """
        <b>TERMS & CONDITIONS:</b><br/>
        • Loan period: 90 days from pawn date<br/>
        • Grace period: 7 additional days (97 total)<br/>
        • Interest accrues monthly on remaining balance<br/>
        • Partial payments accepted anytime<br/>
        • Items forfeit after grace period expires<br/>
        • Extensions available before forfeiture<br/>
        • Bring this receipt for all transactions
        """
        
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(terms_text, self.styles['ReceiptSmall']))
        
        return elements
    
    def _build_footer(self, receipt_type: str) -> List[Any]:
        """Build receipt footer section."""
        elements = []
        
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        elements.append(Spacer(1, 6))
        
        footer_text = f"""
        Thank you for your business!<br/>
        This is your official {'receipt' if receipt_type == 'customer' else 'storage copy'}.<br/>
        Generated on {datetime.now().strftime('%m/%d/%Y at %I:%M %p')}
        """
        
        elements.append(Paragraph(
            footer_text,
            self.styles['ReceiptSmall']
        ))
        
        return elements
    
    async def generate_payment_receipt(
        self,
        transaction: Transaction,
        customer: Customer,
        payment_amount: Decimal,
        new_balance: Decimal,
        user: User
    ) -> BytesIO:
        """Generate a receipt for a payment transaction."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=self.margin,
            leftMargin=self.margin,
            topMargin=self.margin,
            bottomMargin=self.margin
        )
        
        story = []
        
        # Header
        story.append(Paragraph("PAWN REPO", self.styles['ReceiptTitle']))
        story.append(Paragraph("PAYMENT RECEIPT", self.styles['ReceiptHeader']))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Spacer(1, 12))
        
        # Payment details
        data = [
            ["Transaction #:", str(transaction.transaction_number)],
            ["Payment Date:", datetime.now().strftime("%m/%d/%Y %I:%M %p")],
            ["Customer:", f"{customer.first_name} {customer.last_name}"],
            ["Payment Amount:", f"${float(payment_amount):.2f}"],
            ["Previous Balance:", f"${float(transaction.current_balance):.2f}"],
            ["New Balance:", f"${float(new_balance):.2f}"],
            ["Processed by:", f"{user.first_name} {user.last_name} (#{user.user_number})"],
        ]
        
        table = Table(data, colWidths=[2*inch, 2*inch])
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            # Highlight payment amount
            ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#C6F6D5')),
            ('TEXTCOLOR', (0, 3), (-1, 3), colors.HexColor('#22543D')),
            # Highlight new balance
            ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#FED7D7') if float(new_balance) > 0 else colors.HexColor('#C6F6D5')),
        ]))
        
        story.append(table)
        story.append(Spacer(1, 12))
        
        # Status message
        if float(new_balance) == 0:
            status_msg = "<b>LOAN FULLY PAID - ITEMS READY FOR PICKUP</b>"
            story.append(Paragraph(status_msg, self.styles['ReceiptHeader']))
        else:
            status_msg = f"Remaining balance: ${float(new_balance):.2f}"
            story.append(Paragraph(status_msg, self.styles['ReceiptBody']))
        
        # Footer
        story.append(Spacer(1, 12))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
        story.append(Paragraph(
            f"Payment processed on {datetime.now().strftime('%m/%d/%Y at %I:%M %p')}",
            self.styles['ReceiptSmall']
        ))
        
        doc.build(story)
        buffer.seek(0)
        return buffer


# Service instance
receipt_service = ReceiptService()