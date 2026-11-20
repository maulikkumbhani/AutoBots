import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
import app.models  # Ensure all models are registered

from app.api.routes_market import router as market_router
from app.api.routes_indicators import router as indicators_router
from app.api.routes_replay import router as replay_router
from app.api.routes_predictions import router as predictions_router
from app.api.routes_analytics import router as analytics_router
from app.api.routes_paper_trading import router as paper_router
from app.api.routes_bot import router as bot_router
from app.api.routes_mt5 import router as mt5_router
from app.api.routes_mt4 import router as mt4_router
from app.api.routes_order_block import router as order_block_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start local database continuous background synchronization engine
    from app.execution.database_sync import db_sync_manager
    sync_task = asyncio.create_task(db_sync_manager.run_background_sync(interval_sec=2.0))

    # Always start auto-trading bot on startup by default (user can toggle/stop anytime)
    from app.execution.bot_runner import trading_bot
    await trading_bot.start()

    yield

    try:
        db_sync_manager.stop()
        sync_task.cancel()
    except Exception:
        pass

    try:
        await trading_bot.stop()
    except Exception:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Quantitative AI Market Intelligence, Point-in-Time Replay, and Paper Trading Platform",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(market_router, prefix=settings.API_V1_STR)
app.include_router(indicators_router, prefix=settings.API_V1_STR)
app.include_router(replay_router, prefix=settings.API_V1_STR)
app.include_router(predictions_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(paper_router, prefix=settings.API_V1_STR)
app.include_router(bot_router, prefix=settings.API_V1_STR)
app.include_router(mt5_router, prefix=settings.API_V1_STR)
app.include_router(mt4_router, prefix=settings.API_V1_STR)
app.include_router(order_block_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "platform": settings.PROJECT_NAME,
        "status": "operational",
        "api_docs": "/docs",
        "version": "1.0.0",
    }
