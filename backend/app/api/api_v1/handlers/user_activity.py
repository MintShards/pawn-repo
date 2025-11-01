"""
User Activity Log API Handlers

API endpoints for retrieving user activity logs and statistics.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from datetime import datetime

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
