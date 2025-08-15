"""
Security Validator Module

Provides security validation utilities to prevent dangerous code patterns
and ensure secure coding practices across the application.
"""

import ast
import re
from typing import Any, List, Optional, Dict
import structlog

# Configure logger
security_validator_logger = structlog.get_logger("security_validator")


class SecurityValidator:
    """Security validation utilities for preventing dangerous code patterns"""
    
    # Dangerous functions that should never be used with user input
    DANGEROUS_FUNCTIONS = {
        'eval', 'exec', 'compile', '__import__',
        'getattr', 'setattr', 'hasattr', 'delattr'
    }
    
    # Dangerous modules/functions for command execution
    COMMAND_EXECUTION_PATTERNS = {
        'os.system', 'subprocess.call', 'subprocess.run', 'subprocess.Popen',
        'os.popen', 'os.execv', 'os.spawnl'
    }
    
    # Unsafe deserialization patterns
    UNSAFE_DESERIALIZATION = {
        'pickle.loads', 'pickle.load', 'marshal.loads', 'marshal.load',
        'yaml.load'  # should use yaml.safe_load
    }
    
    @staticmethod
    def validate_sort_field(sort_field: str, allowed_fields: List[str]) -> bool:
        """
        Validate that sort field is in allowed list.
        
        Args:
            sort_field: Field name to sort by
            allowed_fields: List of allowed field names
            
        Returns:
            True if valid, False otherwise
        """
        if not sort_field or not isinstance(sort_field, str):
            return False
            
        # Check if field is in allowed list
        if sort_field not in allowed_fields:
            security_validator_logger.warning(
                "Invalid sort field attempted",
                sort_field=sort_field,
                allowed_fields=allowed_fields
            )
            return False
            
        # Additional checks for injection attempts
        if re.search(r'[^a-zA-Z0-9_]', sort_field):
            security_validator_logger.warning(
                "Potentially malicious sort field",
                sort_field=sort_field,
                reason="contains non-alphanumeric characters"
            )
            return False
            
        return True
    
    @staticmethod
    def safe_getattr(obj: Any, attr_name: str, default: Any = None, allowed_attrs: Optional[List[str]] = None) -> Any:
        """
        Safe attribute access with validation.
        
        Args:
            obj: Object to get attribute from
            attr_name: Attribute name
            default: Default value if attribute not found
            allowed_attrs: List of allowed attribute names
            
        Returns:
            Attribute value or default
            
        Raises:
            SecurityError: If attribute access is not allowed
        """
        if not isinstance(attr_name, str):
            raise SecurityError("Attribute name must be a string")
            
        # Check if attribute is in allowed list
        if allowed_attrs and attr_name not in allowed_attrs:
            raise SecurityError(f"Access to attribute '{attr_name}' is not allowed")
            
        # Check for dangerous attribute patterns
        if attr_name.startswith('_') or attr_name.startswith('__'):
            raise SecurityError(f"Access to private/magic attribute '{attr_name}' is not allowed")
            
        # Check for injection attempts
        if re.search(r'[^a-zA-Z0-9_]', attr_name):
            raise SecurityError(f"Invalid characters in attribute name: '{attr_name}'")
            
        return getattr(obj, attr_name, default)
    
    @staticmethod
    def validate_json_data(data: str) -> bool:
        """
        Validate that data is safe JSON (not Python code).
        
        Args:
            data: String data to validate
            
        Returns:
            True if safe JSON, False otherwise
        """
        try:
            # Try to parse as JSON first
            import json
            json.loads(data)
            return True
        except json.JSONDecodeError:
            pass
            
        try:
            # Check if it's a safe literal using AST
            ast.literal_eval(data)
            # If we get here, it's a Python literal but not JSON
            security_validator_logger.warning(
                "Data appears to be Python literal, not JSON",
                data_preview=data[:100] + "..." if len(data) > 100 else data
            )
            return False
        except (ValueError, SyntaxError):
            security_validator_logger.warning(
                "Data is neither JSON nor safe Python literal",
                data_preview=data[:100] + "..." if len(data) > 100 else data
            )
            return False
    
    @staticmethod
    def scan_code_for_dangerous_patterns(code: str, filename: str = "unknown") -> List[Dict[str, Any]]:
        """
        Scan code for dangerous security patterns.
        
        Args:
            code: Source code to scan
            filename: Filename for reporting
            
        Returns:
            List of security issues found
        """
        issues = []
        lines = code.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line_stripped = line.strip()
            
            # Check for eval/exec usage
            if re.search(r'\b(eval|exec)\s*\(', line_stripped):
                issues.append({
                    'type': 'CRITICAL',
                    'pattern': 'eval/exec usage',
                    'line': line_num,
                    'code': line_stripped,
                    'file': filename,
                    'message': 'Use of eval() or exec() can lead to code injection'
                })
            
            # Check for unsafe pickle usage
            if re.search(r'pickle\.loads?\s*\(', line_stripped):
                # Check if it's from user input or external source
                if any(keyword in line_stripped.lower() for keyword in ['request', 'input', 'user', 'external']):
                    issues.append({
                        'type': 'HIGH',
                        'pattern': 'unsafe deserialization',
                        'line': line_num,
                        'code': line_stripped,
                        'file': filename,
                        'message': 'Pickle deserialization of untrusted data can lead to RCE'
                    })
            
            # Check for command execution
            for pattern in SecurityValidator.COMMAND_EXECUTION_PATTERNS:
                if pattern in line_stripped:
                    issues.append({
                        'type': 'HIGH',
                        'pattern': 'command execution',
                        'line': line_num,
                        'code': line_stripped,
                        'file': filename,
                        'message': f'Use of {pattern} can lead to command injection'
                    })
            
            # Check for unsafe YAML loading
            if 'yaml.load(' in line_stripped and 'safe_load' not in line_stripped:
                issues.append({
                    'type': 'HIGH',
                    'pattern': 'unsafe yaml loading',
                    'line': line_num,
                    'code': line_stripped,
                    'file': filename,
                    'message': 'Use yaml.safe_load() instead of yaml.load()'
                })
        
        return issues


class SecurityError(Exception):
    """Custom exception for security-related errors"""
    pass


# Validation decorators
def validate_sort_field_decorator(allowed_fields: List[str]):
    """
    Decorator to validate sort field parameters.
    
    Args:
        allowed_fields: List of allowed field names for sorting
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Look for sort_by in kwargs
            if 'sort_by' in kwargs:
                if not SecurityValidator.validate_sort_field(kwargs['sort_by'], allowed_fields):
                    raise SecurityError(f"Invalid sort field: {kwargs['sort_by']}")
            
            # Look for filters object with sort_by attribute
            for arg in args:
                if hasattr(arg, 'sort_by'):
                    if not SecurityValidator.validate_sort_field(arg.sort_by, allowed_fields):
                        raise SecurityError(f"Invalid sort field: {arg.sort_by}")
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Pydantic validator functions
def validate_sort_field_pydantic(field_value: str, allowed_fields: List[str]) -> str:
    """
    Pydantic validator for sort fields.
    
    Args:
        field_value: The sort field value
        allowed_fields: List of allowed field names
        
    Returns:
        Validated field value
        
    Raises:
        ValueError: If field is not valid
    """
    if not SecurityValidator.validate_sort_field(field_value, allowed_fields):
        raise ValueError(f"Sort field '{field_value}' is not allowed. Allowed fields: {allowed_fields}")
    return field_value