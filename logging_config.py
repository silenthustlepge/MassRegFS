
import sys
from loguru import logger

def setup_logging():
    """
    Configures the Loguru logger for the application.
    """
    logger.remove()  # Remove default handler to avoid duplicate logs
    
    # Console logger with a specific format and colorization
    logger.add(
        sys.stderr,
        level="INFO",
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
        backtrace=True,  # Show full stack trace on exceptions
        diagnose=True,   # Add exception values for easier debugging
    )
    
    # You could also add a file logger here if needed
    # logger.add("file_{time}.log", level="DEBUG", rotation="10 MB")

    logger.info("Logger initialized")

setup_logging()

# Expose the logger instance to be imported by other modules
__all__ = ["logger"]

    