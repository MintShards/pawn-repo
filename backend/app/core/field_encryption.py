"""
Field-Level Encryption Service

Provides encryption and decryption for sensitive customer data fields.
Uses AES-256 encryption with secure key management for PII protection.
"""

import base64
import hashlib
import secrets
from typing import Optional, Dict, Any, Union
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.padding import PKCS7
import structlog

# Configure logger
encryption_logger = structlog.get_logger("field_encryption")


class EncryptionConfig:
    """Encryption configuration constants"""
    
    # Encryption settings
    KEY_SIZE = 32  # AES-256 key size in bytes
    IV_SIZE = 16   # AES block size for IV
    SALT_SIZE = 16 # Salt size for key derivation
    ITERATIONS = 100000  # PBKDF2 iterations
    
    # Encrypted field markers
    ENCRYPTED_PREFIX = "enc:"
    FIELD_SEPARATOR = "|"
    
    # Sensitive field names that should be encrypted
    SENSITIVE_FIELDS = {
        "email",
        "notes", 
        "internal_notes",
        "address_line_1",
        "address_line_2", 
        "city",
        "state",
        "zip_code",
        "ssn",
        "drivers_license"
    }


class FieldEncryptionError(Exception):
    """Field encryption related errors"""
    pass


class FieldEncryptionService:
    """Service for field-level encryption of sensitive data"""
    
    def __init__(self, master_key: str):
        """
        Initialize field encryption service.
        
        Args:
            master_key: Master key for encryption (should be 32+ characters)
        """
        if not master_key or len(master_key) < 32:
            raise FieldEncryptionError("Master key must be at least 32 characters")
        
        self.master_key = master_key.encode('utf-8')
        encryption_logger.info("Field encryption service initialized")
    
    def _derive_key(self, salt: bytes) -> bytes:
        """
        Derive encryption key from master key using PBKDF2.
        
        Args:
            salt: Salt for key derivation
            
        Returns:
            Derived encryption key
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=EncryptionConfig.KEY_SIZE,
            salt=salt,
            iterations=EncryptionConfig.ITERATIONS,
        )
        return kdf.derive(self.master_key)
    
    def encrypt_field(self, plaintext: str) -> str:
        """
        Encrypt a sensitive field value.
        
        Args:
            plaintext: Plain text value to encrypt
            
        Returns:
            Encrypted value with metadata (base64 encoded)
        """
        if not plaintext:
            return plaintext
        
        try:
            # Generate random salt and IV
            salt = secrets.token_bytes(EncryptionConfig.SALT_SIZE)
            iv = secrets.token_bytes(EncryptionConfig.IV_SIZE)
            
            # Derive encryption key
            key = self._derive_key(salt)
            
            # Encrypt the data
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            encryptor = cipher.encryptor()
            
            # Apply PKCS7 padding
            padder = PKCS7(128).padder()  # AES block size is 128 bits
            padded_data = padder.update(plaintext.encode('utf-8'))
            padded_data += padder.finalize()
            
            # Perform encryption
            encrypted_data = encryptor.update(padded_data)
            encrypted_data += encryptor.finalize()
            
            # Combine salt, iv, and encrypted data
            combined = salt + iv + encrypted_data
            
            # Base64 encode and add prefix
            encoded = base64.b64encode(combined).decode('ascii')
            result = f"{EncryptionConfig.ENCRYPTED_PREFIX}{encoded}"
            
            encryption_logger.debug(
                "Field encrypted",
                original_length=len(plaintext),
                encrypted_length=len(result)
            )
            
            return result
            
        except Exception as e:
            encryption_logger.error("Encryption failed", error=str(e))
            raise FieldEncryptionError(f"Failed to encrypt field: {str(e)}")
    
    def decrypt_field(self, encrypted_value: str) -> str:
        """
        Decrypt a sensitive field value.
        
        Args:
            encrypted_value: Encrypted value to decrypt
            
        Returns:
            Decrypted plain text value
        """
        if not encrypted_value:
            return encrypted_value
        
        # Check if value is actually encrypted
        if not encrypted_value.startswith(EncryptionConfig.ENCRYPTED_PREFIX):
            return encrypted_value  # Not encrypted, return as-is
        
        try:
            # Remove prefix and decode
            encoded_data = encrypted_value[len(EncryptionConfig.ENCRYPTED_PREFIX):]
            combined = base64.b64decode(encoded_data.encode('ascii'))
            
            # Extract salt, iv, and encrypted data
            salt = combined[:EncryptionConfig.SALT_SIZE]
            iv = combined[EncryptionConfig.SALT_SIZE:EncryptionConfig.SALT_SIZE + EncryptionConfig.IV_SIZE]
            encrypted_data = combined[EncryptionConfig.SALT_SIZE + EncryptionConfig.IV_SIZE:]
            
            # Derive encryption key
            key = self._derive_key(salt)
            
            # Decrypt the data
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            decryptor = cipher.decryptor()
            
            padded_data = decryptor.update(encrypted_data)
            padded_data += decryptor.finalize()
            
            # Remove PKCS7 padding
            unpadder = PKCS7(128).unpadder()
            plaintext_bytes = unpadder.update(padded_data)
            plaintext_bytes += unpadder.finalize()
            
            result = plaintext_bytes.decode('utf-8')
            
            encryption_logger.debug(
                "Field decrypted",
                encrypted_length=len(encrypted_value),
                decrypted_length=len(result)
            )
            
            return result
            
        except Exception as e:
            encryption_logger.error("Decryption failed", error=str(e))
            raise FieldEncryptionError(f"Failed to decrypt field: {str(e)}")
    
    def encrypt_document_fields(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive fields in a document.
        
        Args:
            document: Document dictionary
            
        Returns:
            Document with sensitive fields encrypted
        """
        if not document:
            return document
        
        encrypted_doc = document.copy()
        encrypted_count = 0
        
        for field_name, field_value in document.items():
            if (field_name in EncryptionConfig.SENSITIVE_FIELDS and 
                isinstance(field_value, str) and 
                field_value and
                not field_value.startswith(EncryptionConfig.ENCRYPTED_PREFIX)):
                
                try:
                    encrypted_doc[field_name] = self.encrypt_field(field_value)
                    encrypted_count += 1
                except FieldEncryptionError as e:
                    encryption_logger.warning(
                        "Failed to encrypt field",
                        field=field_name,
                        error=str(e)
                    )
                    # Keep original value if encryption fails
                    encrypted_doc[field_name] = field_value
        
        if encrypted_count > 0:
            encryption_logger.info(
                "Document fields encrypted",
                total_fields=len(document),
                encrypted_fields=encrypted_count
            )
        
        return encrypted_doc
    
    def decrypt_document_fields(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt sensitive fields in a document.
        
        Args:
            document: Document dictionary with encrypted fields
            
        Returns:
            Document with sensitive fields decrypted
        """
        if not document:
            return document
        
        decrypted_doc = document.copy()
        decrypted_count = 0
        
        for field_name, field_value in document.items():
            if (field_name in EncryptionConfig.SENSITIVE_FIELDS and 
                isinstance(field_value, str) and 
                field_value and
                field_value.startswith(EncryptionConfig.ENCRYPTED_PREFIX)):
                
                try:
                    decrypted_doc[field_name] = self.decrypt_field(field_value)
                    decrypted_count += 1
                except FieldEncryptionError as e:
                    encryption_logger.warning(
                        "Failed to decrypt field",
                        field=field_name,
                        error=str(e)
                    )
                    # Keep encrypted value if decryption fails
                    decrypted_doc[field_name] = "[ENCRYPTED]"
        
        if decrypted_count > 0:
            encryption_logger.debug(
                "Document fields decrypted",
                total_fields=len(document),
                decrypted_fields=decrypted_count
            )
        
        return decrypted_doc
    
    def is_field_encrypted(self, field_value: str) -> bool:
        """
        Check if a field value is encrypted.
        
        Args:
            field_value: Field value to check
            
        Returns:
            True if field is encrypted, False otherwise
        """
        return (isinstance(field_value, str) and 
                field_value.startswith(EncryptionConfig.ENCRYPTED_PREFIX))
    
    def get_encryption_status(self, document: Dict[str, Any]) -> Dict[str, bool]:
        """
        Get encryption status for all sensitive fields in a document.
        
        Args:
            document: Document to check
            
        Returns:
            Dictionary mapping field names to encryption status
        """
        status = {}
        
        for field_name in EncryptionConfig.SENSITIVE_FIELDS:
            if field_name in document:
                field_value = document[field_name]
                status[field_name] = self.is_field_encrypted(field_value)
            else:
                status[field_name] = None  # Field not present
        
        return status


# Global encryption service instance
encryption_service: Optional[FieldEncryptionService] = None


def initialize_field_encryption(master_key: str):
    """
    Initialize global field encryption service.
    
    Args:
        master_key: Master key for encryption
    """
    global encryption_service
    
    try:
        encryption_service = FieldEncryptionService(master_key)
        encryption_logger.info("Field encryption service initialized globally")
        return encryption_service
    except Exception as e:
        encryption_logger.error("Failed to initialize field encryption service", error=str(e))
        raise


def get_encryption_service() -> Optional[FieldEncryptionService]:
    """Get global encryption service instance"""
    return encryption_service


# Utility functions for common operations
async def encrypt_customer_data(customer_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Encrypt sensitive fields in customer data.
    
    Args:
        customer_data: Customer data dictionary
        
    Returns:
        Customer data with encrypted sensitive fields
    """
    service = get_encryption_service()
    if not service:
        encryption_logger.warning("Encryption service not available, data not encrypted")
        return customer_data
    
    return service.encrypt_document_fields(customer_data)


async def decrypt_customer_data(customer_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Decrypt sensitive fields in customer data.
    
    Args:
        customer_data: Customer data dictionary with encrypted fields
        
    Returns:
        Customer data with decrypted sensitive fields
    """
    service = get_encryption_service()
    if not service:
        encryption_logger.warning("Encryption service not available, returning encrypted data")
        return customer_data
    
    return service.decrypt_document_fields(customer_data)


def generate_master_key() -> str:
    """
    Generate a cryptographically secure master key.
    
    Returns:
        Base64-encoded master key (44 characters)
    """
    key_bytes = secrets.token_bytes(32)  # 256 bits
    master_key = base64.b64encode(key_bytes).decode('ascii')
    
    encryption_logger.info("Master key generated", key_length=len(master_key))
    
    return master_key