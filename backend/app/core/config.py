import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "WriteUp Pro"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "writeuppro-super-secure-production-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Institution Defaults
    INSTITUTION_NAME: str = "Imperial Institute of Engineering & Technology"
    INSTITUTION_CODE: str = "IIET-ACAD"
    ACADEMIC_YEAR: str = "2026-27"
    
    # Academic Rubric Constraints
    ASSIGNMENT_MAX_MARKS: float = 10.0
    EXPERIMENT_MAX_MARKS: float = 15.0
    
    # Integrity Monitoring Policies
    BLOCK_PASTE_DEFAULT: bool = True
    BLOCK_EXTERNAL_DROP: bool = True
    LOG_FOCUS_SWITCH: bool = True
    TYPING_BURST_THRESHOLD_MS: int = 30
    TYPING_BURST_MIN_KEYS: int = 15
    
    # Database
    DATABASE_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "writeuppro.db")

settings = Settings()
