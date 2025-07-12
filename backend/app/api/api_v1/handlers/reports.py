# backend/app/api/api_v1/handlers/reports.py
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Dict, List, Any, Optional
from datetime import date, datetime, timedelta
from app.services.reports_service import ReportsService
from app.api.deps.user_deps import get_current_user
from app.models.user_model import User
from app.models.transaction_model import TransactionType
import logging
import io

logger = logging.getLogger(__name__)
reports_router = APIRouter()

@reports_router.get("/transactions", summary="Get transaction report")
async def get_transaction_report(
    start_date: date = Query(..., description="Start date for report"),
    end_date: date = Query(..., description="End date for report"),
    transaction_type: Optional[TransactionType] = Query(None, description="Filter by transaction type"),
    format: str = Query("json", regex="^(json|csv)$", description="Report format"),
    current_user: User = Depends(get_current_user)
):
    try:
        if format == "csv":
            csv_data = await ReportsService.get_transaction_report_csv(
                start_date, end_date, transaction_type
            )
            return StreamingResponse(
                io.StringIO(csv_data),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=transactions_{start_date}_{end_date}.csv"}
            )
        else:
            report = await ReportsService.get_transaction_report(
                start_date, end_date, transaction_type
            )
            return report
    except Exception as e:
        logger.error(f"Error generating transaction report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate transaction report"
        )

@reports_router.get("/inventory", summary="Get inventory report")
async def get_inventory_report(
    format: str = Query("json", regex="^(json|csv)$", description="Report format"),
    current_user: User = Depends(get_current_user)
):
    try:
        if format == "csv":
            csv_data = await ReportsService.get_inventory_report_csv()
            return StreamingResponse(
                io.StringIO(csv_data),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=inventory_{date.today()}.csv"}
            )
        else:
            report = await ReportsService.get_inventory_report()
            return report
    except Exception as e:
        logger.error(f"Error generating inventory report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate inventory report"
        )

@reports_router.get("/financial", summary="Get financial summary report")
async def get_financial_report(
    start_date: date = Query(..., description="Start date for report"),
    end_date: date = Query(..., description="End date for report"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        report = await ReportsService.get_financial_report(start_date, end_date)
        return report
    except Exception as e:
        logger.error(f"Error generating financial report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate financial report"
        )

@reports_router.get("/customer-activity", summary="Get customer activity report")
async def get_customer_activity_report(
    start_date: date = Query(..., description="Start date for report"),
    end_date: date = Query(..., description="End date for report"),
    min_transactions: int = Query(1, ge=1, description="Minimum number of transactions"),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    try:
        report = await ReportsService.get_customer_activity_report(
            start_date, end_date, min_transactions
        )
        return report
    except Exception as e:
        logger.error(f"Error generating customer activity report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate customer activity report"
        )

@reports_router.get("/aged-loans", summary="Get aged loans report")
async def get_aged_loans_report(
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    try:
        report = await ReportsService.get_aged_loans_report()
        return report
    except Exception as e:
        logger.error(f"Error generating aged loans report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate aged loans report"
        )

@reports_router.get("/daily-summary", summary="Get daily operations summary")
async def get_daily_summary_report(
    report_date: date = Query(default_factory=date.today, description="Date for daily report"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get comprehensive daily operations summary including cash flow, transactions, and performance metrics.
    """
    try:
        report = await ReportsService.get_daily_summary_report(report_date)
        return report
    except Exception as e:
        logger.error(f"Error generating daily summary report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate daily summary report"
        )

@reports_router.get("/performance-metrics", summary="Get business performance metrics")
async def get_performance_metrics(
    start_date: date = Query(..., description="Start date for metrics"),
    end_date: date = Query(..., description="End date for metrics"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get business performance metrics including loan volume, revenue, and customer trends.
    """
    try:
        report = await ReportsService.get_performance_metrics(start_date, end_date)
        return report
    except Exception as e:
        logger.error(f"Error generating performance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate performance metrics"
        )

@reports_router.get("/cash-flow", summary="Get cash flow report")
async def get_cash_flow_report(
    start_date: date = Query(..., description="Start date for cash flow"),
    end_date: date = Query(..., description="End date for cash flow"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get detailed cash flow report including loans disbursed, payments received, and net cash flow.
    """
    try:
        report = await ReportsService.get_cash_flow_report(start_date, end_date)
        return report
    except Exception as e:
        logger.error(f"Error generating cash flow report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate cash flow report"
        )

@reports_router.get("/export/pdf", summary="Export report as PDF")
async def export_report_pdf(
    report_type: str = Query(..., description="Type of report to export"),
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    current_user: User = Depends(get_current_user)
):
    """
    Export various reports as PDF format for printing and archiving.
    
    Supported report types:
    - daily-summary
    - financial
    - transaction
    - performance-metrics
    - cash-flow
    """
    try:
        pdf_buffer = await ReportsService.export_report_pdf(
            report_type=report_type,
            start_date=start_date,
            end_date=end_date,
            user=current_user
        )
        
        filename = f"{report_type}_report_{start_date or date.today()}.pdf"
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error exporting PDF report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export PDF report"
        )

@reports_router.get("/audit-trail", summary="Get audit trail report")
async def get_audit_trail_report(
    start_date: date = Query(..., description="Start date for audit trail"),
    end_date: date = Query(..., description="End date for audit trail"),
    user_id: Optional[str] = Query(None, description="Filter by specific user"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get audit trail report showing all user actions and system changes.
    Requires admin privileges.
    """
    try:
        # Check admin privileges
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Audit trail access requires admin privileges"
            )
        
        report = await ReportsService.get_audit_trail_report(
            start_date=start_date,
            end_date=end_date,
            user_id=user_id,
            action_type=action_type,
            entity_type=entity_type
        )
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating audit trail report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate audit trail report"
        )