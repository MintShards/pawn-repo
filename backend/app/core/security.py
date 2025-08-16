"""
Security Module

Centralized security functions for PIN hashing and verification using bcrypt.
Provides a secure, salted hashing mechanism for user PINs.
"""

import warnings
from passlib.context import CryptContext

# Suppress the bcrypt version warning
warnings.filterwarnings("ignore", message=".*error reading bcrypt version.*")

# Bcrypt context for PIN hashing
pin_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_pin(pin: str) -> str:
    """
    Hash a PIN using bcrypt with automatic salt generation.
    
    Args:
        pin: The plain text PIN to hash
        
    Returns:
        The bcrypt hashed PIN string
        
    Example:
        >>> hashed = get_pin("1234")
        >>> hashed.startswith("$2b$")
        True
    """
    return pin_context.hash(pin)


def verify_pin(pin: str, hashed_pin: str) -> bool:
    """
    Verify a plain text PIN against its bcrypt hash.
    
    Args:
        pin: The plain text PIN to verify
        hashed_pin: The bcrypt hashed PIN to verify against
        
    Returns:
        True if the PIN matches the hash, False otherwise
        
    Example:
        >>> hashed = get_pin("1234")
        >>> verify_pin("1234", hashed)
        True
        >>> verify_pin("5678", hashed)
        False
    """
    return pin_context.verify(pin, hashed_pin)