import pytest
import httpx
from app.main import app


@pytest.mark.asyncio
async def test_api_instruments():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/markets/instruments")
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 5
        symbols = [item["symbol"] for item in data]
        assert "NIFTY 50" in symbols
        assert "^GSPC" in symbols
        assert "AAPL" in symbols


@pytest.mark.asyncio
async def test_api_accuracy_dashboard():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/analytics/accuracy-dashboard")
        assert res.status_code == 200
        data = res.json()
        assert "aggregate_metrics" in data
        assert data["aggregate_metrics"]["fully_evaluated"] > 0
        assert "by_instrument" in data
        assert "methodology" in data


@pytest.mark.asyncio
async def test_api_paper_portfolio():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/paper/portfolio")
        assert res.status_code == 200
        data = res.json()
        assert data["current_cash"] == 1_000_000.0
        assert data["currency"] == "INR"


@pytest.mark.asyncio
async def test_api_replay_execution():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "symbol": "NIFTY 50",
            "cutoff_timestamp": "2026-10-05T14:30:00Z",
            "horizon": "60m",
            "model_type": "STATISTICAL",
        }
        res = await client.post("/api/v1/replay/execute", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["symbol"] == "NIFTY 50"
        assert data["as_of_price"] > 0
        assert data["forecast"] is not None
        assert data["forecast"]["direction"] in ["up", "down", "sideways", "uncertain"]
