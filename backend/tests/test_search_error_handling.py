"""
Comprehensive tests for search error handling scenarios

Tests cover:
1. API endpoint error handling 
2. Unified search service error handling
3. Input validation errors
4. Business rule violations
5. Database connectivity issues
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.app import app
from app.services.unified_search_service import UnifiedSearchService
from app.schemas.pawn_transaction_schema import UnifiedSearchRequest, UnifiedSearchType


class TestSearchErrorHandling:
    
    def test_invalid_search_parameters(self, client, created_staff_user):
        """Test handling of invalid search parameters"""
        # Mock authentication
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            # Test with invalid search type
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": "PW000001",
                    "search_type": "invalid_type",  # Invalid search type
                    "page": 1,
                    "page_size": 10
                }
            )
            
            assert response.status_code == 422  # Pydantic validation error
            assert "validation error" in str(response.json()) or "Input should be" in str(response.json())
    
    def test_empty_search_text(self, client, created_staff_user):
        """Test handling of empty search text"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": "",  # Empty search text
                    "search_type": "auto_detect",
                    "page": 1,
                    "page_size": 10
                }
            )
            
            assert response.status_code == 422  # Pydantic validation error for empty search text
            assert "validation error" in str(response.json()) or "at least 1 character" in str(response.json())
    
    def test_search_text_too_long(self, client, created_staff_user):
        """Test handling of extremely long search text"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            long_search_text = "a" * 1000  # Very long search text
            
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": long_search_text,
                    "search_type": "auto_detect",
                    "page": 1,
                    "page_size": 10
                }
            )
            
            assert response.status_code == 422  # Pydantic validation error for text too long
    
    def test_invalid_page_parameters(self, client, created_staff_user):
        """Test handling of invalid pagination parameters"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            # Test negative page number
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": "PW000001",
                    "search_type": "auto_detect",
                    "page": -1,  # Invalid page number
                    "page_size": 10
                }
            )
            
            assert response.status_code == 422  # Pydantic validation error for negative page
    
    def test_invalid_page_size(self, client, created_staff_user):
        """Test handling of invalid page size"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            # Test page size too large
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": "PW000001",
                    "search_type": "auto_detect",
                    "page": 1,
                    "page_size": 1000  # Too large
                }
            )
            
            assert response.status_code == 422  # Pydantic validation error for page size too large
    
    @patch('app.services.unified_search_service.UnifiedSearchService.search_transactions')
    def test_search_service_failure(self, mock_search, client, created_staff_user):
        """Test handling of search service internal failure"""
        # Mock search service to raise exception
        mock_search.side_effect = Exception("Database connection failed")
        
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            response = client.post(
                "/api/v1/pawn-transaction/search",
                json={
                    "search_text": "PW000001",
                    "search_type": "auto_detect",
                    "page": 1,
                    "page_size": 10
                }
            )
            
            assert response.status_code == 500
            assert "Search failed" in response.json()["detail"]
    
    def test_phone_number_format_validation(self, client, created_staff_user):
        """Test phone number format validation for customer transactions"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            # Test invalid phone number format
            response = client.get(
                "/api/v1/pawn-transaction/customer/123",  # Invalid phone format
                params={"page": 1, "page_size": 10}
            )
            
            assert response.status_code == 422  # Pydantic validation error
            assert "validation error" in str(response.json()) or "Invalid phone" in str(response.json())


class TestUnifiedSearchServiceErrors:
    
    @pytest.mark.asyncio
    async def test_search_with_invalid_search_type(self):
        """Test unified search with invalid search type"""
        # This should actually be caught by Pydantic validation
        # before reaching the service, so let's test a service-level error instead
        with pytest.raises(Exception):  # Service level validation
            await UnifiedSearchService.search_transactions(
                "PW000001",
                "invalid_enum_value",  # This bypasses Pydantic to test service level
                1,
                10
            )
    
    @pytest.mark.asyncio
    @patch('app.models.pawn_transaction_model.PawnTransaction.aggregate')
    async def test_database_connection_error(self, mock_aggregate):
        """Test handling of database connection errors"""
        # Mock database connection failure
        mock_aggregate.side_effect = Exception("Connection to database failed")
        
        search_request = UnifiedSearchRequest(
            search_text="PW000001",
            search_type=UnifiedSearchType.AUTO_DETECT,
            page=1,
            page_size=10
        )
        
        with pytest.raises(Exception) as exc_info:
            await UnifiedSearchService.search_transactions(
                search_request.search_text,
                search_request.search_type,
                search_request.page,
                search_request.page_size
            )
        
        assert "Connection to database failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    @patch('app.models.pawn_transaction_model.PawnTransaction.aggregate')
    async def test_timeout_error(self, mock_aggregate):
        """Test handling of database timeout errors"""
        # Mock database timeout
        mock_aggregate.side_effect = TimeoutError("Query timeout exceeded")
        
        search_request = UnifiedSearchRequest(
            search_text="5551234567",
            search_type=UnifiedSearchType.PHONE_NUMBER,
            page=1,
            page_size=10
        )
        
        with pytest.raises(Exception):
            await UnifiedSearchService.search_transactions(
                search_request.search_text,
                search_request.search_type,
                search_request.page,
                search_request.page_size
            )
    
    @pytest.mark.asyncio
    async def test_empty_search_results_handling(self):
        """Test proper handling of empty search results"""
        with patch('app.models.pawn_transaction_model.PawnTransaction.aggregate') as mock_aggregate:
            # Mock empty results - create an async iterator that returns empty list
            async def async_iter():
                return iter([])
            
            mock_aggregate.return_value = AsyncMock()
            mock_aggregate.return_value.__aiter__ = async_iter
            
            result = await UnifiedSearchService.search_transactions(
                "PW999999",  # Non-existent transaction
                UnifiedSearchType.TRANSACTION_ID,
                page=1,
                page_size=10
            )
            
            assert result.total_count == 0
            assert len(result.transactions) == 0
            assert result.search_metadata.search_type == "transaction_id"
            assert result.search_metadata.search_text == "PW999999"
    
    @pytest.mark.asyncio  
    async def test_malformed_phone_number_search(self):
        """Test search with malformed phone numbers"""
        invalid_phones = [
            "123",  # Too short
            "12345678901234567890",  # Too long
            "abc1234567",  # Contains letters
            "555-123-4567",  # Contains dashes
            "555 123 4567",  # Contains spaces
            "(555) 123-4567",  # Formatted phone
        ]
        
        for invalid_phone in invalid_phones:
            # Should not detect as phone number, should fall back to full_text
            search_type = UnifiedSearchService.detect_search_type(invalid_phone)
            assert search_type != "phone_number"
    
    @pytest.mark.asyncio
    async def test_special_characters_handling(self):
        """Test handling of search text with special characters"""
        special_chars_text = "@#$%^&*(){}[]|\\:;\"'<>,.?/~`"
        
        # Should not crash and should handle gracefully
        search_type = UnifiedSearchService.detect_search_type(special_chars_text)
        assert search_type == "full_text"
        
        # Search should complete without errors
        with patch('app.models.pawn_transaction_model.PawnTransaction.aggregate') as mock_aggregate:
            # Create proper async iterator
            async def async_iter():
                return iter([])
            
            mock_aggregate.return_value = AsyncMock()
            mock_aggregate.return_value.__aiter__ = async_iter
            
            result = await UnifiedSearchService.search_transactions(
                special_chars_text,
                UnifiedSearchType.FULL_TEXT,
                page=1,
                page_size=10
            )
            
            assert result.total_count == 0
            assert len(result.transactions) == 0


class TestSearchTypeDetection:
    
    def test_transaction_id_detection(self):
        """Test transaction ID format detection"""
        valid_formats = [
            "PW000001", "Pw000001", "pw000001",
            "PW1", "Pw1", "pW1", "1", "001"
        ]
        
        for format_str in valid_formats:
            search_type = UnifiedSearchService.detect_search_type(format_str)
            assert search_type == "transaction_id", f"Failed for format: {format_str}"
    
    def test_extension_id_detection(self):
        """Test extension ID format detection"""
        valid_formats = [
            "EX000001", "ex000001", "Ex000001", "eX000001", "ex1"
        ]
        
        for format_str in valid_formats:
            search_type = UnifiedSearchService.detect_search_type(format_str)
            assert search_type == "extension_id", f"Failed for format: {format_str}"
    
    def test_phone_number_detection(self):
        """Test phone number format detection"""
        valid_phones = [
            "5551234567",  # 10 digits
            "15551234567",  # 11 digits with country code
            "1234567",  # 7 digits (minimum)
            "123456789012345"  # 15 digits (maximum)
        ]
        
        for phone in valid_phones:
            search_type = UnifiedSearchService.detect_search_type(phone)
            assert search_type == "phone_number", f"Failed for phone: {phone}"
    
    def test_invalid_formats_fallback_to_full_text(self):
        """Test that invalid formats fall back to full text search"""
        invalid_formats = [
            "John Doe",  # Customer name
            "555-123-4567",  # Formatted phone
            "ABC123",  # Invalid transaction format
            "12345678901234567890",  # Too long for phone
            "123",  # Too short for phone
            "@#$%",  # Special characters
        ]
        
        for invalid_format in invalid_formats:
            search_type = UnifiedSearchService.detect_search_type(invalid_format)
            assert search_type == "full_text", f"Should fallback to full_text for: {invalid_format}"


class TestCacheErrorHandling:
    
    @pytest.mark.asyncio
    @patch('app.services.unified_search_service.BusinessCache.get')
    @patch('app.services.unified_search_service.BusinessCache.set')
    async def test_cache_failure_graceful_degradation(self, mock_cache_set, mock_cache_get):
        """Test that cache failures don't prevent search from working"""
        # Mock cache failures
        mock_cache_get.side_effect = Exception("Cache server unavailable")
        mock_cache_set.side_effect = Exception("Cache server unavailable")
        
        # Mock successful database query
        with patch('app.models.pawn_transaction_model.PawnTransaction.aggregate') as mock_aggregate:
            # Create proper async iterator
            async def async_iter():
                return iter([])
            
            mock_aggregate.return_value = AsyncMock()
            mock_aggregate.return_value.__aiter__ = async_iter
            
            # Search should still work despite cache failures
            result = await UnifiedSearchService.search_transactions(
                "PW000001",
                UnifiedSearchType.TRANSACTION_ID,
                page=1,
                page_size=10
            )
            
            # Should return valid result structure
            assert result.total_count == 0
            assert len(result.transactions) == 0
            assert result.search_metadata is not None
            assert result.search_metadata.cache_hit is False
    
    @pytest.mark.asyncio
    @patch('app.services.unified_search_service.BusinessCache.invalidate_by_pattern')
    async def test_cache_invalidation_error_handling(self, mock_invalidate):
        """Test cache invalidation error handling"""
        # Mock cache invalidation failure
        mock_invalidate.side_effect = Exception("Cache invalidation failed")
        
        # Should not raise exception
        try:
            await UnifiedSearchService.invalidate_search_caches()
        except Exception as e:
            pytest.fail(f"Cache invalidation should handle errors gracefully, but raised: {e}")


class TestRateLimitingErrorHandling:
    
    def test_rate_limiting_response(self, client, created_staff_user):
        """Test rate limiting error response format"""
        with patch('app.api.deps.user_deps.get_current_user', return_value=created_staff_user):
            with patch('app.core.rate_limiter.check_rate_limit') as mock_rate_limit:
                # Mock rate limit exceeded
                mock_rate_limit.side_effect = HTTPException(
                    status_code=429, 
                    detail="Rate limit exceeded. Please try again later."
                )
                
                response = client.post(
                    "/api/v1/pawn-transaction/search",
                    json={
                        "search_text": "PW000001",
                        "search_type": "auto_detect",
                        "page": 1,
                        "page_size": 10
                    }
                )
                
                assert response.status_code == 429
                assert "Rate limit exceeded" in response.json()["detail"]