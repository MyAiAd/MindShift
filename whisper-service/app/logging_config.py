"""
Structured logging configuration for Whisper service.

Provides consistent logging format with request IDs for tracing.
"""

import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict
import uuid

# Request context for tracing
_request_context: Dict[str, str] = {}


def set_request_id(request_id: str):
    """Set request ID for current request context."""
    _request_context['request_id'] = request_id


def get_request_id() -> str:
    """Get request ID for current request, or generate new one."""
    if 'request_id' not in _request_context:
        _request_context['request_id'] = str(uuid.uuid4())[:8]
    return _request_context['request_id']


def clear_request_context():
    """Clear request context (call at end of request)."""
    _request_context.clear()


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging."""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'request_id': get_request_id(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'extra'):
            log_data.update(record.extra)
        
        return json.dumps(log_data)


def configure_logging(
    level: str = "INFO",
    log_file: str = None,
    json_format: bool = False
):
    """
    Configure logging for the application.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Path to log file (None for console only)
        json_format: Use JSON structured logging (for production)
    """
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    logger.handlers = []
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    if json_format:
        console_handler.setFormatter(StructuredFormatter())
    else:
        console_handler.setFormatter(
            logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        )
    
    logger.addHandler(console_handler)
    
    # File handler (production)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(StructuredFormatter())
        logger.addHandler(file_handler)
    
    return logger


# Example usage in FastAPI middleware:
# from app.logging_config import set_request_id, clear_request_context
#
# @app.middleware("http")
# async def logging_middleware(request: Request, call_next):
#     request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
#     set_request_id(request_id)
#     
#     response = await call_next(request)
#     response.headers["X-Request-ID"] = request_id
#     
#     clear_request_context()
#     return response
