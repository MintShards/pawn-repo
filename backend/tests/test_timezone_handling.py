"""
Test timezone handling functionality.

Tests dynamic timezone detection, conversion utilities, and business logic
with different timezone contexts.
"""

import pytest
from datetime import datetime, UTC
from zoneinfo import ZoneInfo

from app.core.timezone_utils import (
    validate_and_get_timezone,
    get_user_now,
    utc_to_user_timezone,
    user_timezone_to_utc,
    get_months_between_user_timezone,
    format_user_datetime,
    add_months_user_timezone
)


class TestTimezoneUtils:
    """Test timezone utility functions."""
    
    def test_validate_and_get_timezone_valid(self):
        """Test timezone detection with valid timezone."""
        tz = validate_and_get_timezone("America/New_York")
        assert str(tz) == "America/New_York"
    
    def test_validate_and_get_timezone_invalid(self):
        """Test timezone detection with invalid timezone."""
        tz = validate_and_get_timezone("Invalid/Timezone")
        assert str(tz) == "UTC"
    
    def test_validate_and_get_timezone_none(self):
        """Test timezone detection with None."""
        tz = validate_and_get_timezone(None)
        assert str(tz) == "UTC"
    
    def test_utc_to_user_timezone_conversion(self):
        """Test UTC to user timezone conversion."""
        utc_dt = datetime(2024, 6, 15, 12, 0, 0, tzinfo=UTC)  # June (EDT)
        local_dt = utc_to_user_timezone(utc_dt, "America/New_York")
        
        # June 15, 12:00 UTC = June 15, 8:00 AM EDT
        assert local_dt.hour == 8
        assert local_dt.day == 15
    
    def test_user_timezone_to_utc_conversion(self):
        """Test user timezone to UTC conversion."""
        # Create naive datetime (as if from user input)
        local_dt = datetime(2024, 6, 15, 8, 0, 0)  # 8 AM EDT
        utc_dt = user_timezone_to_utc(local_dt, "America/New_York")
        
        # 8 AM EDT = 12:00 UTC
        assert utc_dt.hour == 12
        assert utc_dt.tzinfo == UTC
    
    def test_months_between_timezone_aware(self):
        """Test month calculation with timezone awareness."""
        # Create dates in UTC
        start = datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
        end = datetime(2024, 3, 15, 12, 0, 0, tzinfo=UTC)
        
        # Should be 2 months (Jan 15 to Mar 15)
        months = get_months_between_user_timezone(start, end, "America/New_York")
        assert months == 2
    
    def test_format_user_datetime(self):
        """Test datetime formatting in user timezone."""
        utc_dt = datetime(2024, 6, 15, 12, 0, 0, tzinfo=UTC)
        formatted = format_user_datetime(utc_dt, "America/New_York")
        
        # Should show EDT time
        assert "EDT" in formatted or "EST" in formatted
        assert "2024-06-15" in formatted
        assert "08:00" in formatted
    
    def test_add_months_user_timezone(self):
        """Test adding months in user timezone."""
        base_date = datetime(2024, 1, 31, 12, 0, 0, tzinfo=UTC)
        result = add_months_user_timezone(base_date, 1, "America/New_York")
        
        # Jan 31 + 1 month = Feb 29 (2024 is leap year)
        result_local = utc_to_user_timezone(result, "America/New_York")
        assert result_local.month == 2
        assert result_local.day == 29  # Leap year
    
    def test_dst_transition_handling(self):
        """Test handling of DST transitions."""
        # Test spring forward (EST to EDT)
        spring = datetime(2024, 3, 10, 12, 0, 0, tzinfo=UTC)  # March 10, 2024
        spring_local = utc_to_user_timezone(spring, "America/New_York")
        
        # Test fall back (EDT to EST)  
        fall = datetime(2024, 11, 3, 12, 0, 0, tzinfo=UTC)  # November 3, 2024
        fall_local = utc_to_user_timezone(fall, "America/New_York")
        
        # Verify different offsets
        assert spring_local.utcoffset() != fall_local.utcoffset()


@pytest.mark.asyncio
class TestTimezoneIntegration:
    """Test timezone integration with business logic."""
    
    async def test_timezone_header_extraction(self):
        """Test timezone extraction from mock request."""
        # This would be tested with actual FastAPI test client
        # when integrated with API endpoints
        pass
    
    async def test_business_logic_with_timezone(self):
        """Test business logic calculations with different timezones."""
        # Test interest calculations across timezones
        utc_pawn_date = datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
        utc_current_date = datetime(2024, 3, 15, 12, 0, 0, tzinfo=UTC)
        
        # Test with different timezones
        timezones = ["America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"]
        
        for tz in timezones:
            months = get_months_between_user_timezone(utc_pawn_date, utc_current_date, tz)
            # Should be consistent across timezones for same UTC dates
            assert months == 2


if __name__ == "__main__":
    pytest.main([__file__])