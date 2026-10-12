import React from "react";
import { PortfolioSummary, Position } from "../types";
import { Wallet, ShieldAlert, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Props {
  portfolio: PortfolioSummary | null;
  positions: Position[];
}

export const PortfolioBlotter: React.FC<Props> = ({ portfolio, positions }) => {
  const openPositions = positions.filter((p) => p.status === "OPEN");
  const closedPositions = positions.filter((p) => p.status === "CLOSED");

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Wallet size={16} color="var(--accent-primary)" />
          <span>Paper Portfolio & Position Blotter</span>
        </div>
        <span className="pill-badge pill-neutral">SIMULATED VIRTUAL CASH</span>
      </div>

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

      {/* Open Positions Table */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
          Active Open Positions ({openPositions.length})
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
                    <td>₹{pos.entry_price.toFixed(2)}</td>
                    <td>₹{pos.current_price.toFixed(2)}</td>
                    <td style={{ color: "var(--bearish-red)" }}>₹{pos.stop_loss ? pos.stop_loss.toFixed(2) : "-"}</td>
                    <td style={{ color: "var(--bullish-green)" }}>₹{pos.take_profit ? pos.take_profit.toFixed(2) : "-"}</td>
                    <td style={{ fontSize: "10px" }}>
                      +{pos.max_favorable_excursion.toFixed(1)} / -{pos.max_adverse_excursion.toFixed(1)}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: pos.unrealized_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {pos.unrealized_pnl >= 0 ? "+" : ""}₹{pos.unrealized_pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "14px", background: "rgba(255, 255, 255, 0.01)", borderRadius: "6px" }}>
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
          <div style={{ overflowX: "auto", maxHeight: "180px" }}>
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
                    <td>₹{pos.entry_price.toFixed(2)}</td>
                    <td>₹{pos.current_price.toFixed(2)}</td>
                    <td>
                      <span className="pill-badge pill-neutral" style={{ fontSize: "10px" }}>
                        {pos.close_reason || "MANUAL"}
                      </span>
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: pos.realized_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {pos.realized_pnl >= 0 ? "+" : ""}₹{pos.realized_pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "14px", background: "rgba(255, 255, 255, 0.01)", borderRadius: "6px" }}>
            No completed paper trades yet.
          </div>
        )}
      </div>
    </div>
  );
};
