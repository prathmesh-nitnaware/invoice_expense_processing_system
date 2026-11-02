import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

logger = logging.getLogger(__name__)

db_url = settings.DATABASE_URL

if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# If SQLite is specified, use SQLite directly
if "sqlite" in db_url:
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # Test PostgreSQL connection with 1-second timeout
    try:
        test_engine = create_engine(db_url, connect_args={"connect_timeout": 1})
        with test_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = test_engine
        logger.info("Successfully connected to PostgreSQL.")
    except Exception as e:
        logger.warning(
            f"PostgreSQL connection failed ({e}). "
            "Falling back to local SQLite database 'invoice_dev.db'."
        )
        sqlite_url = "sqlite:///./invoice_dev.db"
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import backend.app.models  # Register models
    Base.metadata.create_all(bind=engine)
