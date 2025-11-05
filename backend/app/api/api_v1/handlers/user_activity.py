"""
User Activity Log API Handlers

API endpoints for retrieving user activity logs and statistics.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import StreamingResponse
from datetime import datetime
import csv
import io

from app.models.user_activity_log_model import (
    UserActivityLog,
    UserActivityType,
    ActivitySeverity
)
from app.schemas.user_activity_log_schema import (
    UserActivityLogResponse,
    UserActivityLogListResponse,
    UserActivityLogFilters,
    UserActivityStatsResponse
)
from app.models.user_model import User
from app.api.deps.user_deps import get_current_active_user
from beanie.operators import In, And, Or, GTE, LTE, RegEx
from app.core.timezone_utils import utc_to_user_timezone


router = APIRouter()


# IMPORTANT: More specific routes must come before parameterized routes
# Place /stats/summary and /export/csv BEFORE /{user_id} to avoid path conflicts


@router.get("/stats/summary")
async def get_activity_stats_summary(
    current_user: User = Depends(get_current_active_user),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """
    Get global activity statistics summary.

    - **Admin**: Can view global stats
    - **Staff**: Can only view their own stats
    """
    # Build query
    query_conditions = []

    # Permission check: staff can only view their own logs
    if current_user.role != "admin":
        query_conditions.append(UserActivityLog.user_id == current_user.user_id)

    if start_date:
        query_conditions.append(GTE(UserActivityLog.timestamp, start_date))

    if end_date:
        query_conditions.append(LTE(UserActivityLog.timestamp, end_date))

    # Get all logs
    if query_conditions:
        logs = await UserActivityLog.find(And(*query_conditions)).to_list()
    else:
        logs = await UserActivityLog.find_all().to_list()

    # Calculate statistics
    total_activities = len(logs)
    total_users = len(set(log.user_id for log in logs))

    # Count by severity (with null checks and proper boolean comparison)
    critical_count = sum(1 for log in logs if log.severity and log.severity == ActivitySeverity.CRITICAL)
    error_count = sum(1 for log in logs if log.severity and log.severity == ActivitySeverity.ERROR)
    warning_count = sum(1 for log in logs if log.severity and log.severity == ActivitySeverity.WARNING)
    info_count = sum(1 for log in logs if log.severity and log.severity == ActivitySeverity.INFO)

    # Count success/failures (using 'is' operator for boolean comparison)
    success_count = sum(1 for log in logs if log.is_success is True)
    failure_count = sum(1 for log in logs if log.is_success is False)

    # Most active users (top 5)
    user_activity_count = {}
    for log in logs:
        user_activity_count[log.user_id] = user_activity_count.get(log.user_id, 0) + 1

    most_active_users = sorted(
        user_activity_count.items(),
        key=lambda x: x[1],
        reverse=True
    )[:5]

    # Activity by type
    activities_by_type = {}
    for log in logs:
        activity_type = log.activity_type.value
        activities_by_type[activity_type] = activities_by_type.get(activity_type, 0) + 1

    # Get most common activities (top 5)
    most_common_activities = sorted(
        activities_by_type.items(),
        key=lambda x: x[1],
        reverse=True
    )[:5]

    return {
        "total_activities": total_activities,
        "total_users": total_users,
        "critical_count": critical_count,
        "error_count": error_count,
        "warning_count": warning_count,
        "info_count": info_count,
        "success_count": success_count,
        "failure_count": failure_count,
        "most_active_users": [{"user_id": user, "count": count} for user, count in most_active_users],
        "most_common_activities": [{"activity_type": activity, "count": count} for activity, count in most_common_activities]
    }


@router.get("/export/csv")
async def export_activity_logs_csv(
    current_user: User = Depends(get_current_active_user),
    user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    activity_types: Optional[List[UserActivityType]] = Query(None),
    severities: Optional[List[ActivitySeverity]] = Query(None),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_success: Optional[bool] = None,
    search: Optional[str] = None
):
    """
    Export activity logs to CSV with advanced filtering.

    - **Admin**: Can export all activity logs with optional filtering
    - **Staff**: Can only export their own activity logs
    """
    # Build query conditions
    query_conditions = []

    # Permission check: staff can only export their own logs
    if current_user.role != "admin":
        query_conditions.append(UserActivityLog.user_id == current_user.user_id)
    elif user_id:
        query_conditions.append(UserActivityLog.user_id == user_id)

    if target_user_id:
        query_conditions.append(UserActivityLog.target_user_id == target_user_id)

    if activity_types:
        query_conditions.append(In(UserActivityLog.activity_type, activity_types))

    if severities:
        query_conditions.append(In(UserActivityLog.severity, severities))

    if start_date:
        query_conditions.append(GTE(UserActivityLog.timestamp, start_date))

    if end_date:
        query_conditions.append(LTE(UserActivityLog.timestamp, end_date))

    if is_success is not None:
        query_conditions.append(UserActivityLog.is_success == is_success)

    if search:
        search_conditions = [
            RegEx(UserActivityLog.description, search, "i"),
            RegEx(UserActivityLog.details, search, "i")
        ]
        query_conditions.append(Or(*search_conditions))

    # Execute query
    if query_conditions:
        query = UserActivityLog.find(And(*query_conditions))
    else:
        query = UserActivityLog.find_all()

    # Get all logs (no pagination for export)
    logs = await query.sort(-UserActivityLog.timestamp).to_list()

    # Create CSV in memory with UTF-8 BOM for Excel compatibility
    output = io.StringIO()
    output.write('\ufeff')  # UTF-8 BOM for Excel
    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)  # Proper spacing in Excel

    # Write enhanced header with better readability and spacing
    writer.writerow([
        ' Date ',
        ' Time ',
        ' Staff Member ',
        ' Action Taken ',
        ' Priority ',
        ' Result ',
        ' What Happened ',
        ' Additional Notes ',
        ' Affected User ',
        ' Transaction # ',
        ' Customer Phone ',
        ' Device Used ',
        ' Error Details ',
        ' Extra Information '
    ])

    # Helper function to format activity type for readability
    def format_activity_type(activity_type):
        if not activity_type:
            return ''
        # Convert snake_case to Title Case
        return activity_type.value.replace('_', ' ').title()

    # Helper function to format severity with emoji
    def format_severity(severity):
        if not severity:
            return ''
        severity_map = {
            'info': 'ℹ️ Routine',
            'low': '🔵 Low Priority',
            'medium': '🟡 Important',
            'high': '🟠 Urgent',
            'critical': '🔴 Critical'
        }
        return severity_map.get(severity.value.lower(), severity.value.title())

    # Helper function to format metadata
    def format_metadata(log):
        if not hasattr(log, 'metadata') or not log.metadata:
            return ''
        # Convert metadata dict to readable key=value pairs with friendly labels
        metadata_parts = []
        for key, value in log.metadata.items():
            if key not in ['old_', 'new_']:  # Skip internal prefixes
                # Make keys more readable
                friendly_key = key.replace('_', ' ').title()
                metadata_parts.append(f"{friendly_key}: {value}")
        return ' | '.join(metadata_parts) if metadata_parts else ''

    # Helper function to add spacing to cell values
    def pad_cell(value, min_width=2):
        """Add padding to cell values for better spacing in Excel"""
        if not value:
            return ''
        str_value = str(value)
        # Add space padding on both sides if value is short
        if len(str_value) < min_width:
            return f" {str_value} "
        # Add minimal padding for readability
        return f" {str_value} "

    # Write data rows with enhanced formatting and spacing
    for log in logs:
        # Convert UTC timestamp to user timezone and split into date and time
        date_str = ''
        time_str = ''
        if log.timestamp:
            # Convert to user timezone for proper date display
            user_time = utc_to_user_timezone(log.timestamp)
            date_str = user_time.strftime('%Y-%m-%d')
            time_str = user_time.strftime('%H:%M:%S')

        writer.writerow([
            pad_cell(date_str),
            pad_cell(time_str),
            pad_cell(log.user_id or ''),
            pad_cell(format_activity_type(log.activity_type)),
            pad_cell(format_severity(log.severity)),
            pad_cell('✅ Success' if log.is_success else '❌ Failed' if log.is_success is not None else ''),
            pad_cell(log.description or ''),
            pad_cell(log.details or ''),
            pad_cell(log.target_user_id or ''),
            pad_cell(log.target_transaction_id or ''),
            pad_cell(log.target_customer_phone or ''),
            pad_cell((log.user_agent[:50] + '...') if log.user_agent and len(log.user_agent) > 50 else (log.user_agent or '')),
            pad_cell(log.error_message or ''),
            pad_cell(format_metadata(log))
        ])

    # Get CSV content
    csv_content = output.getvalue()
    output.close()

    # Generate filename with timestamp
    from datetime import datetime as dt
    filename = f"activity_logs_{dt.now().strftime('%Y%m%d_%H%M%S')}.csv"

    # Return CSV as streaming response
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/{user_id}", response_model=UserActivityLogListResponse)
async def get_user_activity_logs(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    activity_types: Optional[List[UserActivityType]] = Query(None),
    severities: Optional[List[ActivitySeverity]] = Query(None),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_success: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100)
):
    """
    Get activity logs for a specific user.

    - **Admin**: Can view any user's activity logs
    - **Staff**: Can only view their own activity logs
    """
    # Permission check: staff can only view their own logs
    if current_user.role != "admin" and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own activity logs"
        )

    # Build query
    query_conditions = [UserActivityLog.user_id == user_id]

    if activity_types:
        query_conditions.append(In(UserActivityLog.activity_type, activity_types))

    if severities:
        query_conditions.append(In(UserActivityLog.severity, severities))

    if start_date:
        query_conditions.append(GTE(UserActivityLog.timestamp, start_date))

    if end_date:
        query_conditions.append(LTE(UserActivityLog.timestamp, end_date))

    if is_success is not None:
        query_conditions.append(UserActivityLog.is_success == is_success)

    if search:
        # Search in description and details
        search_conditions = [
            RegEx(UserActivityLog.description, search, "i"),
            RegEx(UserActivityLog.details, search, "i")
        ]
        query_conditions.append(Or(*search_conditions))

    # Execute query with pagination
    query = UserActivityLog.find(And(*query_conditions))

    # Get total count
    total = await query.count()

    # Calculate pagination
    skip = (page - 1) * per_page
    pages = (total + per_page - 1) // per_page

    # Get logs
    logs = await query.sort(-UserActivityLog.timestamp).skip(skip).limit(per_page).to_list()

    return UserActivityLogListResponse(
        logs=[UserActivityLogResponse(**log.model_dump()) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/", response_model=UserActivityLogListResponse)
async def list_activity_logs(
    current_user: User = Depends(get_current_active_user),
    user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    activity_types: Optional[List[UserActivityType]] = Query(None),
    severities: Optional[List[ActivitySeverity]] = Query(None),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_success: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100)
):
    """
    List activity logs with advanced filtering.

    - **Admin**: Can view all activity logs with optional user filtering
    - **Staff**: Can only view their own activity logs
    """
    # Build query conditions
    query_conditions = []

    # Permission check: staff can only view their own logs
    if current_user.role != "admin":
        query_conditions.append(UserActivityLog.user_id == current_user.user_id)
    elif user_id:
        query_conditions.append(UserActivityLog.user_id == user_id)

    if target_user_id:
        query_conditions.append(UserActivityLog.target_user_id == target_user_id)

    if activity_types:
        query_conditions.append(In(UserActivityLog.activity_type, activity_types))

    if severities:
        query_conditions.append(In(UserActivityLog.severity, severities))

    if start_date:
        query_conditions.append(GTE(UserActivityLog.timestamp, start_date))

    if end_date:
        query_conditions.append(LTE(UserActivityLog.timestamp, end_date))

    if is_success is not None:
        query_conditions.append(UserActivityLog.is_success == is_success)

    if search:
        search_conditions = [
            RegEx(UserActivityLog.description, search, "i"),
            RegEx(UserActivityLog.details, search, "i")
        ]
        query_conditions.append(Or(*search_conditions))

    # Execute query
    if query_conditions:
        query = UserActivityLog.find(And(*query_conditions))
    else:
        query = UserActivityLog.find_all()

    # Get total count
    total = await query.count()

    # Calculate pagination
    skip = (page - 1) * per_page
    pages = (total + per_page - 1) // per_page

    # Get logs
    logs = await query.sort(-UserActivityLog.timestamp).skip(skip).limit(per_page).to_list()

    return UserActivityLogListResponse(
        logs=[UserActivityLogResponse(**log.model_dump()) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/{user_id}/stats", response_model=UserActivityStatsResponse)
async def get_user_activity_stats(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """
    Get activity statistics for a user.

    - **Admin**: Can view any user's statistics
    - **Staff**: Can only view their own statistics
    """
    # Permission check
    if current_user.role != "admin" and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own activity statistics"
        )

    # Build query
    query_conditions = [UserActivityLog.user_id == user_id]

    if start_date:
        query_conditions.append(GTE(UserActivityLog.timestamp, start_date))

    if end_date:
        query_conditions.append(LTE(UserActivityLog.timestamp, end_date))

    # Get all logs for the user
    logs = await UserActivityLog.find(And(*query_conditions)).to_list()

    # Calculate statistics
    total_activities = len(logs)

    # Count by activity type
    activities_by_type = {}
    for log in logs:
        activity_type = log.activity_type.value
        activities_by_type[activity_type] = activities_by_type.get(activity_type, 0) + 1

    # Count by severity
    activities_by_severity = {}
    for log in logs:
        severity = log.severity.value
        activities_by_severity[severity] = activities_by_severity.get(severity, 0) + 1

    # Count logins
    total_logins = sum(1 for log in logs if log.activity_type == UserActivityType.LOGIN_SUCCESS)
    failed_logins = sum(1 for log in logs if log.activity_type == UserActivityType.LOGIN_FAILED)

    # Get last activity and last login
    last_activity = None
    last_login = None

    if logs:
        # Logs are already sorted by timestamp descending
        sorted_logs = sorted(logs, key=lambda x: x.timestamp, reverse=True)
        last_activity = sorted_logs[0].timestamp

        # Find last successful login
        for log in sorted_logs:
            if log.activity_type == UserActivityType.LOGIN_SUCCESS:
                last_login = log.timestamp
                break

    # Get recent activities (last 10)
    recent_activities = sorted(logs, key=lambda x: x.timestamp, reverse=True)[:10]

    return UserActivityStatsResponse(
        total_activities=total_activities,
        total_logins=total_logins,
        failed_logins=failed_logins,
        last_activity=last_activity,
        last_login=last_login,
        activities_by_type=activities_by_type,
        activities_by_severity=activities_by_severity,
        recent_activities=[UserActivityLogResponse(**log.model_dump()) for log in recent_activities]
    )
