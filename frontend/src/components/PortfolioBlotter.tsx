import React, { useState } from "react";
import { PortfolioSummary, Position } from "../types";
import { closeAllPositions, closeSinglePosition, resetPaperTrading } from "../api";
import { Wallet, XCircle, RotateCcw, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  portfolio: PortfolioSummary | null;
  positions: Position[];
  onRefresh?: () => void;
}

export const PortfolioBlotter: React.FC<Props> = ({ portfolio, positions, onRefresh }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const openPositions = positions.filter((p) => p.status === "OPEN");
  const closedPositions = positions.filter((p) => p.status === "CLOSED");

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleCloseAll = async () => {
    if (openPositions.length === 0) return;
    setLoadingAction("close-all");
    try {
      const res = await closeAllPositions();
      showFeedback(`Successfully closed ${res.closed_count} positions (Realized P&L: ₹${res.realized_pnl})`);
      onRefresh?.();
    } catch (err: any) {
      showFeedback(err?.message || "Failed to close positions", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseSingle = async (posId: number) => {
    setLoadingAction(`close-${posId}`);
    try {
      const res = await closeSinglePosition(posId);
      showFeedback(`Position #${posId} closed (Realized P&L: ₹${res.realized_pnl})`);
      onRefresh?.();
    } catch (err: any) {
      showFeedback(err?.message || "Failed to close position", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetTrades = async () => {
    if (!window.confirm("Are you sure you want to reset your paper portfolio cash and wipe all trade history?")) return;
    setLoadingAction("reset");
    try {
      await resetPaperTrading();
      showFeedback("Paper trading portfolio and history reset to ₹1,000,000 cash.");
      onRefresh?.();
    } catch (err: any) {
      showFeedback(err?.message || "Failed to reset paper trading", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header" style={{ flexWrap: "wrap", gap: "8px" }}>
        <div className="card-title">
          <Wallet size={16} color="var(--accent-primary)" />
          <span>Paper Portfolio & Position Blotter</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Reset All Trades Button */}
          <button
            className="btn btn-outline"
            style={{ fontSize: "11px", padding: "4px 8px", borderColor: "rgba(255, 255, 255, 0.15)" }}
            onClick={handleResetTrades}
            disabled={loadingAction === "reset"}
            title="Wipe and reset simulated paper portfolio to ₹1,000,000"
          >
            <RotateCcw size={12} className={loadingAction === "reset" ? "animate-spin" : ""} />
            <span>Reset All Trades</span>
          </button>
          <span className="pill-badge pill-neutral">SIMULATED VIRTUAL CASH</span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {feedbackMsg && (
        <div
          style={{
            margin: "0 0 12px 0",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: feedbackMsg.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${feedbackMsg.type === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: feedbackMsg.type === "success" ? "var(--bullish-green)" : "var(--bearish-red)",
          }}
        >
          {feedbackMsg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Portfolio Overview */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total Equity</div>
          <div className="stat-value">
            {portfolio ? `₹${portfolio.equity.toLocaleString()}` : "₹1,000,000"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Available Cash</div>
          <div className="stat-value">
            {portfolio ? `₹${portfolio.current_cash.toLocaleString()}` : "₹1,000,000"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Realized P&L</div>
          <div
            className="stat-value"
            style={{
              color: (portfolio?.realized_pnl || 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
            }}
          >
            {portfolio ? `${portfolio.realized_pnl >= 0 ? "+" : ""}₹${portfolio.realized_pnl.toLocaleString()}` : "₹0"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Fees & Slippage</div>
          <div className="stat-value" style={{ color: "var(--warning-amber)" }}>
            ₹{portfolio ? (portfolio.total_fees_paid + portfolio.total_slippage_paid).toFixed(2) : "0.00"}
          </div>
        </div>
      </div>

      {/* Open Positions Table with Close All Button */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
            Active Open Positions ({openPositions.length})
          </div>

          {openPositions.length > 0 && (
            <button
              className="btn btn-outline"
              style={{
                fontSize: "11px",
                padding: "3px 10px",
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "var(--bearish-red)",
                background: "rgba(239, 68, 68, 0.1)",
              }}
              onClick={handleCloseAll}
              disabled={loadingAction === "close-all"}
              title="Liquidate all open trades at market price"
            >
              <XCircle size={13} className={loadingAction === "close-all" ? "animate-spin" : ""} />
              <span>Close All Trades ({openPositions.length})</span>
            </button>
          )}
        </div>

        {openPositions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>Stop Loss</th>
                  <th>Target TP</th>
                  <th>MFE / MAE</th>
                  <th>Unrealized P&L</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos) => (
                  <tr key={pos.id}>
                    <td style={{ fontWeight: 700 }}>{pos.symbol}</td>
                    <td>
                      <span className={`pill-badge ${pos.side === "LONG" ? "pill-bullish" : "pill-bearish"}`}>
                        {pos.side}
                      </span>
                    </td>
                    <td>{pos.quantity}</td>
                    <td>₹{(pos.entry_price ?? 0).toFixed(pos.symbol.includes("/") ? 4 : 2)}</td>
                    <td>₹{(pos.current_price ?? 0).toFixed(pos.symbol.includes("/") ? 4 : 2)}</td>
                    <td style={{ color: "var(--bearish-red)" }}>
                      {pos.stop_loss ? `₹${pos.stop_loss.toFixed(pos.symbol.includes("/") ? 4 : 2)}` : "-"}
                    </td>
                    <td style={{ color: "var(--bullish-green)" }}>
                      {pos.take_profit ? `₹${pos.take_profit.toFixed(pos.symbol.includes("/") ? 4 : 2)}` : "-"}
                    </td>
                    <td style={{ fontSize: "10px" }}>
                      +{(pos.max_favorable_excursion ?? 0).toFixed(1)} / -{(pos.max_adverse_excursion ?? 0).toFixed(1)}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: (pos.unrealized_pnl ?? 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {(pos.unrealized_pnl ?? 0) >= 0 ? "+" : ""}₹{(pos.unrealized_pnl ?? 0).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{
                          fontSize: "10px",
                          padding: "2px 8px",
                          borderColor: "rgba(239, 68, 68, 0.3)",
                          color: "var(--bearish-red)",
                        }}
                        onClick={() => handleCloseSingle(pos.id)}
                        disabled={loadingAction === `close-${pos.id}`}
                        title="Close this specific trade"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-dim)",
              textAlign: "center",
              padding: "14px",
              background: "rgba(255, 255, 255, 0.01)",
              borderRadius: "6px",
            }}
          >
            No open positions currently active.
          </div>
        )}
      </div>

      {/* Closed Positions Ledger */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
          Closed Trades History ({closedPositions.length})
        </div>
        {closedPositions.length > 0 ? (
          <div style={{ overflowX: "auto", maxHeight: "200px" }}>
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Exit Reason</th>
                  <th>Realized Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.slice().reverse().map((pos) => (
                  <tr key={pos.id}>
                    <td style={{ fontWeight: 700 }}>{pos.symbol}</td>
                    <td>
                      <span className={`pill-badge ${pos.side === "LONG" ? "pill-bullish" : "pill-bearish"}`}>
                        {pos.side}
                      </span>
                    </td>
                    <td>₹{(pos.entry_price ?? 0).toFixed(pos.symbol.includes("/") ? 4 : 2)}</td>
                    <td>₹{(pos.current_price ?? 0).toFixed(pos.symbol.includes("/") ? 4 : 2)}</td>
                    <td>
                      <span className="pill-badge pill-neutral" style={{ fontSize: "10px" }}>
                        {pos.close_reason || "MANUAL"}
                      </span>
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: (pos.realized_pnl ?? 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {(pos.realized_pnl ?? 0) >= 0 ? "+" : ""}₹{(pos.realized_pnl ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-dim)",
              textAlign: "center",
              padding: "14px",
              background: "rgba(255, 255, 255, 0.01)",
              borderRadius: "6px",
            }}
          >
            No completed paper trades yet.
          </div>
        )}
      </div>
    </div>
  );
};
