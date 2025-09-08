"""
Unified Search Service

Centralized search functionality for pawn transactions with intelligent search type detection,
optimized MongoDB aggregation pipelines, and comprehensive caching strategy.
"""

# Standard library imports
import re
import hashlib
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any
from enum import Enum

# Third-party imports
import structlog
from bson import ObjectId
from bson.decimal128 import Decimal128
import copy

# Local imports
from app.models.pawn_transaction_model import PawnTransaction
from app.core.redis_cache import BusinessCache
from app.core.timezone_utils import utc_to_user_timezone
from app.schemas.pawn_transaction_schema import UnifiedSearchType

# Configure logger
logger = structlog.get_logger("unified_search")


# Use the SearchType from schema for consistency
SearchType = UnifiedSearchType


class SearchResult:
    """Structured search result with metadata"""
    
    def __init__(self, transactions: List[Dict], search_metadata: Dict):
        self.transactions = transactions
        self.search_metadata = search_metadata
        # Use the actual total count from search metadata, not just the current page count
        self.total_count = search_metadata.get("total_count", len(transactions))
    
    def to_dict(self):
        return {
            "transactions": self.transactions,
            "total_count": self.total_count,
            "search_metadata": self.search_metadata
        }


class UnifiedSearchService:
    """
    Unified search service for all transaction-related search operations.
    
    Provides intelligent search type detection, optimized MongoDB aggregation pipelines,
    comprehensive caching, and consistent search results across all search types.
    """
    
    @staticmethod
    def detect_search_type(search_text: str) -> SearchType:
        """
        Automatically detect search intent from user input.
        
        Args:
            search_text: Raw search input from user
            
        Returns:
            SearchType: Detected search type for optimal routing
        """
        if not search_text:
            return SearchType.FULL_TEXT
        
        search_text = search_text.strip()
        
        # Remove common prefixes for pattern matching
        clean_text = search_text.lstrip('#').upper()
        
        # Extension ID patterns (must be checked BEFORE transaction ID to avoid conflicts)
        # Supports: EX000001, ex000001, Ex000001, eX000001, ex1
        if re.match(r'^EX\d{1,6}$', clean_text):
            logger.debug(f"🔍 SEARCH TYPE: Detected EXTENSION_ID for '{search_text}'")
            return SearchType.EXTENSION_ID
        
        # Transaction ID patterns (PW prefix optional, supports PW000001, pw1, 1, 001)
        # Must be 1-6 digits after optional PW prefix
        if re.match(r'^PW\d{1,6}$', clean_text) or re.match(r'^\d{1,6}$', search_text):
            logger.debug(f"🔍 SEARCH TYPE: Detected TRANSACTION_ID for '{search_text}'")
            return SearchType.TRANSACTION_ID
        
        # Phone number patterns (7-15 digits only)
        if re.match(r'^\d{7,15}$', search_text):
            logger.debug(f"🔍 SEARCH TYPE: Detected PHONE_NUMBER for '{search_text}'")
            return SearchType.PHONE_NUMBER
        
        # Customer name patterns (contains letters and spaces)
        if re.match(r'^[a-zA-Z\s\'-]{2,}$', search_text):
            logger.debug(f"🔍 SEARCH TYPE: Detected CUSTOMER_NAME for '{search_text}'")
            return SearchType.CUSTOMER_NAME
        
        # Default to full text search
        logger.debug(f"🔍 SEARCH TYPE: Defaulting to FULL_TEXT for '{search_text}'")
        return SearchType.FULL_TEXT
    
    @staticmethod
    def build_match_conditions(search_text: str, search_type: SearchType) -> Dict:
        """
        Build MongoDB match conditions based on search type.
        
        Args:
            search_text: The search text
            search_type: Detected or specified search type
            
        Returns:
            Dict: MongoDB match conditions for aggregation pipeline
        """
        search_text = search_text.strip()
        
        if search_type == SearchType.TRANSACTION_ID:
            # Handle transaction ID search with formatted_id lookup
            # Supports: PW000001, Pw000001, pw000001, PW1, Pw1, pW1, 1, 001
            clean_id = search_text.lstrip('#').upper()
            if clean_id.startswith('PW'):
                # Extract number part and zero-pad it
                number_part = clean_id[2:]  # Remove 'PW'
                clean_id = f"PW{number_part.zfill(6)}"
            else:
                # No PW prefix, add it and zero-pad
                clean_id = f"PW{clean_id.zfill(6)}"
            
            return {"formatted_id": clean_id}
        
        elif search_type == SearchType.EXTENSION_ID:
            # Extension ID search requires joining with extensions collection
            # Supports: EX000001, ex000001, Ex000001, eX000001, ex1
            clean_id = search_text.lstrip('#').upper()
            if clean_id.startswith('EX'):
                # Extract number part and zero-pad it
                number_part = clean_id[2:]  # Remove 'EX'
                clean_id = f"EX{number_part.zfill(6)}"
            else:
                # No EX prefix, add it and zero-pad
                clean_id = f"EX{clean_id.zfill(6)}"
            
            # We'll handle this in the aggregation pipeline with a lookup
            return {"_extension_search": clean_id}  # Special marker for extension search
        
        elif search_type == SearchType.PHONE_NUMBER:
            return {"customer_id": search_text}
        
        elif search_type == SearchType.CUSTOMER_NAME:
            # Customer name search requires joining with customers collection
            return {"_customer_name_search": search_text.lower()}  # Special marker
        
        else:  # FULL_TEXT
            # Multi-field text search (storage location and loan amount searching removed)
            search_regex = {"$regex": re.escape(search_text), "$options": "i"}
            return {
                "$or": [
                    {"internal_notes": search_regex},
                    {"formatted_id": search_regex}
                ]
            }
    
    @staticmethod
    def build_search_pipeline(
        search_text: str, 
        search_type: SearchType, 
        include_extensions: bool = True,
        include_items: bool = True,
        include_customer: bool = True
    ) -> List[Dict]:
        """
        Build optimized MongoDB aggregation pipeline based on search type.
        
        Args:
            search_text: The search text
            search_type: Detected or specified search type
            include_extensions: Whether to include extension data
            include_items: Whether to include item data  
            include_customer: Whether to include customer data
            
        Returns:
            List[Dict]: MongoDB aggregation pipeline
        """
        pipeline = []
        match_conditions = UnifiedSearchService.build_match_conditions(search_text, search_type)
        
        # Handle special search types that require lookups before matching
        if search_type == SearchType.EXTENSION_ID:
            # For extension ID search, we need to find transactions with matching extensions
            extension_id = match_conditions["_extension_search"]
            pipeline.extend([
                {
                    "$lookup": {
                        "from": "extensions",
                        "localField": "transaction_id",
                        "foreignField": "transaction_id",
                        "as": "temp_extensions"
                    }
                },
                {
                    "$match": {
                        "temp_extensions.formatted_id": extension_id
                    }
                },
                {
                    "$unset": "temp_extensions"  # Remove temporary field
                }
            ])
        
        elif search_type == SearchType.CUSTOMER_NAME:
            # For customer name search, lookup customers first
            customer_search = match_conditions["_customer_name_search"]
            pipeline.extend([
                {
                    "$lookup": {
                        "from": "customers",
                        "localField": "customer_id",
                        "foreignField": "phone_number",
                        "as": "temp_customer"
                    }
                },
                {
                    "$match": {
                        "$or": [
                            {
                                "$expr": {
                                    "$regexMatch": {
                                        "input": {"$toLower": {"$arrayElemAt": ["$temp_customer.first_name", 0]}},
                                        "regex": re.escape(customer_search)
                                    }
                                }
                            },
                            {
                                "$expr": {
                                    "$regexMatch": {
                                        "input": {"$toLower": {"$arrayElemAt": ["$temp_customer.last_name", 0]}},
                                        "regex": re.escape(customer_search)
                                    }
                                }
                            }
                        ]
                    }
                },
                {
                    "$unset": "temp_customer"  # Remove temporary field
                }
            ])
        
        else:
            # Standard match for other search types
            if "_extension_search" not in match_conditions and "_customer_name_search" not in match_conditions:
                pipeline.append({"$match": match_conditions})
        
        # Customer lookup (almost always needed for display)
        if include_customer:
            pipeline.extend([
                {
                    "$lookup": {
                        "from": "customers",
                        "localField": "customer_id",
                        "foreignField": "phone_number",
                        "as": "customer_info"
                    }
                },
                {
                    "$addFields": {
                        "customer_name": {
                            "$cond": {
                                "if": {"$gt": [{"$size": "$customer_info"}, 0]},
                                "then": {
                                    "$concat": [
                                        {"$arrayElemAt": ["$customer_info.first_name", 0]},
                                        " ",
                                        {"$arrayElemAt": ["$customer_info.last_name", 0]}
                                    ]
                                },
                                "else": "Unknown Customer"
                            }
                        }
                    }
                }
            ])
        
        # Extension lookup (when needed)
        if include_extensions:
            pipeline.append({
                "$lookup": {
                    "from": "extensions",
                    "localField": "transaction_id",
                    "foreignField": "transaction_id",
                    "as": "extensions"
                }
            })
        
        # Items lookup (when needed)
        if include_items:
            pipeline.append({
                "$lookup": {
                    "from": "pawn_items",
                    "localField": "transaction_id",
                    "foreignField": "transaction_id",
                    "as": "items"
                }
            })
        
        # Sort by relevance and recency
        pipeline.append({
            "$sort": {
                "updated_at": -1,  # Most recently updated first
                "pawn_date": -1    # Then by pawn date
            }
        })
        
        # Note: Pagination will be handled in the search method itself
        
        return pipeline
    
    @staticmethod
    def _convert_objectids_to_strings(data: Any) -> Any:
        """
        Recursively convert all ObjectId and Decimal128 instances to strings for JSON serialization.
        
        Args:
            data: Data structure that may contain ObjectIds or Decimal128
            
        Returns:
            Data structure with ObjectIds and Decimal128 converted to strings
        """
        if isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, Decimal128):
            # Convert Decimal128 to regular decimal string
            return str(data.to_decimal())
        elif isinstance(data, dict):
            return {key: UnifiedSearchService._convert_objectids_to_strings(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [UnifiedSearchService._convert_objectids_to_strings(item) for item in data]
        else:
            return data
    
    @staticmethod
    def _generate_cache_key(
        search_text: str,
        search_type: SearchType,
        include_extensions: bool,
        include_items: bool,
        include_customer: bool,
        client_timezone: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> str:
        """Generate cache key for search results"""
        key_data = f"{search_text}:{search_type}:{include_extensions}:{include_items}:{include_customer}:{client_timezone or 'UTC'}:{page}:{page_size}"
        return f"unified_search:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    @staticmethod
    async def search_transactions(
        search_text: str,
        search_type: SearchType = SearchType.AUTO_DETECT,
        include_extensions: bool = True,
        include_items: bool = True,
        include_customer: bool = True,
        client_timezone: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> SearchResult:
        """
        Unified search endpoint for all transaction search operations.
        
        Args:
            search_text: User's search input
            search_type: Search type (auto-detected if not specified)
            include_extensions: Whether to include extension data
            include_items: Whether to include item data
            include_customer: Whether to include customer data
            client_timezone: User's timezone for date formatting
            page: Page number for pagination
            page_size: Number of results per page
            
        Returns:
            SearchResult: Structured search results with metadata
            
        Raises:
            Exception: If search execution fails
        """
        start_time = datetime.now(UTC)
        
        try:
            # Auto-detect search type if needed
            if search_type == SearchType.AUTO_DETECT:
                search_type = UnifiedSearchService.detect_search_type(search_text)
            
            # Generate cache key
            cache_key = UnifiedSearchService._generate_cache_key(
                search_text, search_type, include_extensions, include_items, include_customer, client_timezone, page, page_size
            )
            
            # Check cache first
            cached_result = await BusinessCache.get(cache_key)
            if cached_result is not None:
                logger.info("🎯 UNIFIED SEARCH: Cache hit", 
                           search_text=search_text[:50], 
                           search_type=search_type,
                           cache_key=cache_key[:16])
                return SearchResult(
                    transactions=cached_result["transactions"],
                    search_metadata={
                        **cached_result["search_metadata"],
                        "cache_hit": True,
                        "execution_time_ms": 0  # Cache hit
                    }
                )
            
            # Build and execute search pipeline
            pipeline = UnifiedSearchService.build_search_pipeline(
                search_text, search_type, include_extensions, include_items, include_customer
            )
            
            logger.info("🔍 UNIFIED SEARCH: Executing aggregation pipeline",
                        search_text=search_text[:50],
                        search_type=search_type,
                        pipeline_stages=len(pipeline),
                        page=page,
                        page_size=page_size,
                        skip_records=(page - 1) * page_size)
            
            # Create two pipelines: one for total count and one for paginated results
            count_pipeline = copy.deepcopy(pipeline)
            count_pipeline.append({"$count": "total"})
            
            # Add pagination to the main pipeline
            pagination_pipeline = copy.deepcopy(pipeline)
            skip_count = (page - 1) * page_size
            pagination_pipeline.extend([
                {"$skip": skip_count},
                {"$limit": page_size}
            ])
            
            logger.info("📄 PAGINATION: Adding skip/limit to pipeline",
                       page=page,
                       page_size=page_size,
                       skip_count=skip_count,
                       pagination_stages=len([{"$skip": skip_count}, {"$limit": page_size}]))
            
            # Execute both aggregations concurrently
            count_result = await PawnTransaction.aggregate(count_pipeline).to_list()
            paginated_results = await PawnTransaction.aggregate(pagination_pipeline).to_list()
            
            # Extract total count
            total_count = count_result[0]['total'] if count_result else 0
            
            # Process results for frontend consumption
            processed_results = []
            for result in paginated_results if paginated_results else []:
                # Convert MongoDB document to dict and handle ObjectIds
                if isinstance(result, dict):
                    result_dict = result
                else:
                    result_dict = result.model_dump() if hasattr(result, 'model_dump') else dict(result)
                
                # Convert all ObjectId fields to strings for JSON serialization
                result_dict = UnifiedSearchService._convert_objectids_to_strings(result_dict)
                
                # Format dates for client timezone
                if client_timezone:
                    for date_field in ['pawn_date', 'maturity_date', 'grace_period_end', 'updated_at', 'created_at']:
                        if date_field in result_dict and result_dict[date_field]:
                            result_dict[date_field] = utc_to_user_timezone(
                                result_dict[date_field], client_timezone
                            ).isoformat()
                
                processed_results.append(result_dict)
            
            execution_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
            
            # Prepare search metadata
            search_metadata = {
                "search_type": search_type,
                "search_text": search_text,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "has_more": total_count > (page * page_size),
                "execution_time_ms": round(execution_time, 2),
                "cache_hit": False,
                "pipeline_stages": len(pipeline)
            }
            
            # Cache results (30-second TTL for searches)
            cache_data = {
                "transactions": processed_results,
                "search_metadata": search_metadata
            }
            await BusinessCache.set(cache_key, cache_data, ttl_seconds=30)
            
            logger.info("✅ UNIFIED SEARCH: Search completed",
                       search_text=search_text[:50],
                       search_type=search_type,
                       results_count=len(processed_results),
                       total_count=total_count,
                       execution_time_ms=execution_time)
            
            return SearchResult(
                transactions=processed_results,
                search_metadata=search_metadata
            )
            
        except Exception as e:
            execution_time = (datetime.now(UTC) - start_time).total_seconds() * 1000
            logger.error("❌ UNIFIED SEARCH: Search failed",
                        search_text=search_text[:50],
                        search_type=search_type,
                        execution_time_ms=execution_time,
                        error=str(e))
            raise
    
    @staticmethod
    async def invalidate_search_caches(pattern: str = "unified_search:*"):
        """
        Invalidate search caches when transaction data changes.
        
        Args:
            pattern: Cache key pattern to invalidate
        """
        try:
            await BusinessCache.invalidate_by_pattern(pattern)
            logger.info("🗑️ UNIFIED SEARCH: Cache invalidated", pattern=pattern)
        except Exception as e:
            logger.error("❌ UNIFIED SEARCH: Cache invalidation failed", 
                        pattern=pattern, error=str(e))