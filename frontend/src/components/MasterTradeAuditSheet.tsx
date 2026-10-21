import React, { useState, useEffect, useCallback } from "react";
import {
  fetchMasterAuditJournal,
  getMasterAuditCSVExportUrl,
  clearMasterAuditStore,
  MasterAuditResponse,
  MasterAuditRecord,
} from "../api";
import { Download, RefreshCw, Shield, CheckCircle2, XCircle, TrendingUp, Filter, FileSpreadsheet, Trash2 } from "lucide-react";

interface MasterTradeAuditSheetProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const MasterTradeAuditSheet: React.FC<MasterTradeAuditSheetProps> = ({ onSelectSymbol }) => {
  const [data, setData] = useState<MasterAuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("ALL");
  const [selectedModel, setSelectedModel] = useState<string>("ALL");
  const [selectedResult, setSelectedResult] = useState<string>("ALL");
  const [clearingStore, setClearingStore] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMasterAuditJournal({
        period: selectedPeriod,
        symbol: selectedSymbol,
        model: selectedModel,
        result: selectedResult,
      });
      setData(res);
    } catch (err: any) {
      console.error("Failed to load master audit journal:", err);
      setError(err?.message || "Failed to load master audit journal");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedSymbol, selectedModel, selectedResult]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const symbolList = [
    "ALL",
    "NIFTY 50",
    "BANKNIFTY",
    "GOLD",
    "SILVER",
    "USD/INR",
    "RELIANCE",
    "TCS",
    "CRUDE OIL",
  ];

  const modelList = [
    "ALL",
    "QLIB_GBDT",
    "HIGH_VOLUME_SCALPER",
    "PATCHTST_TRANSFORMER",
    "FINRL_PPO",
    "STATISTICAL",
    "ENSEMBLE",
  ];

  const formatPnL = (val: number, symbol: string) => {
    const isUSD = (symbol.includes("USD") && !symbol.includes("INR")) || symbol === "GOLD" || symbol === "SILVER" || symbol.includes("CRUDE");
    const sym = isUSD ? "$" : "₹";
    const prefix = val > 0 ? `+${sym}` : val < 0 ? `-${sym}` : sym;
    const abs = Math.abs(val);
    return `${prefix}${abs.toLocaleString(isUSD ? "en-US" : "en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPrice = (val: number, symbol: string) => {
    if (!val) return "0.00";
    const isUSD = (symbol.includes("USD") && !symbol.includes("INR")) || symbol === "GOLD" || symbol === "SILVER" || symbol.includes("CRUDE");
    const sym = isUSD ? "$" : "₹";
    return `${sym}${val.toLocaleString(isUSD ? "en-US" : "en-IN", { minimumFractionDigits: 2, maximumFractionDigits: val > 10 ? 2 : 4 })}`;
  };

  return (
    <div className="audit-sheet-container">
      {/* Permanent Archive Assurance Banner */}
      <div className="audit-permanent-banner">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.5)",
              padding: "10px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={22} color="#818cf8" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "#fff", letterSpacing: "0.4px" }}>
                PERMANENT TRADE & PREDICTION AUDIT ARCHIVE
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                🔒 IMMUTABLE
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
              Every Buy/Sell execution, target price, model prediction, and P&L is permanently stored on server disk.
              <strong> Even when active website blotters are cleared or reset</strong>, your complete historical audit ledger remains preserved for backtesting and analysis.
            </p>
          </div>
        </div>

        {/* Export to CSV & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <a
            href={getMasterAuditCSVExportUrl()}
            download="AutoBots_Master_Trade_Prediction_Audit.csv"
            className="btn-export-csv"
            title="Download CSV spreadsheet for Excel or Google Sheets"
          >
            <Download size={14} />
            <span>Export to Excel / CSV Sheet</span>
          </a>

          <button
            onClick={loadData}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            onClick={async () => {
              if (!window.confirm("Are you sure you want to clear the Master Audit Journal? All records will be reset.")) return;
              setClearingStore(true);
              try {
                await clearMasterAuditStore();
                await loadData();
              } catch (e: any) {
                alert("Failed to reset store: " + e?.message);
              } finally {
                setClearingStore(false);
              }
            }}
            disabled={clearingStore}
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--bearish-red)",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Reset Master Audit Store (clears all old records)"
          >
            <Trash2 size={13} />
            <span>{clearingStore ? "Resetting..." : "Reset Store"}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric HUD Cards */}
      <div className="kpi-cards-grid">
        <div className="kpi-metric-card">
          <div className="kpi-label">Permanent Trades Archived</div>
          <div className="kpi-value" style={{ color: "#38bdf8" }}>
            {data?.summary.total_historical_trades ?? 0}
          </div>
          <div className="kpi-footer">
            <span>Disk-Backed Master File</span>
            <span style={{ color: "#10b981" }}>Protected</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Long-Term Win Rate %</div>
          <div
            className="kpi-value"
            style={{
              color:
                (data?.summary.win_rate_pct ?? 0) >= 60
                  ? "var(--bullish-green)"
                  : (data?.summary.win_rate_pct ?? 0) > 0
                  ? "#f59e0b"
                  : "var(--text-muted)",
            }}
          >
            {(data?.summary.win_rate_pct ?? 0).toFixed(1)}%
          </div>
          <div className="kpi-footer">
            <span>
              Wins: <strong style={{ color: "#10b981" }}>{data?.summary.win_count ?? 0}</strong> • Losses: <strong style={{ color: "#ef4444" }}>{data?.summary.loss_count ?? 0}</strong>
            </span>
            <span>Audited</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Prediction Target Hit Rate %</div>
          <div
            className="kpi-value"
            style={{
              color: (data?.summary.target_hit_rate_pct ?? 0) >= 60 ? "#818cf8" : "var(--text-muted)",
            }}
          >
            {(data?.summary.target_hit_rate_pct ?? 0).toFixed(1)}%
          </div>
          <div className="kpi-footer">
            <span>Targets Reached: {data?.summary.target_hit_count ?? 0}</span>
            <span>Forecast Success</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Cumulative Realized P&L</div>
          <div
            className="kpi-value"
            style={{
              color: (data?.summary.net_realized_pnl ?? 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
            }}
          >
            {data?.summary.net_realized_pnl !== undefined
              ? formatPnL(data.summary.net_realized_pnl, "INR")
              : "₹0.00"}
          </div>
          <div className="kpi-footer">
            <span>Profit Factor: {data?.summary.profit_factor ?? 1.0}x</span>
            <span>Avg: {formatPnL(data?.summary.avg_trade_pnl ?? 0, "INR")}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="audit-toolbar">
        {/* Period Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
            Period:
          </span>
          <div className="period-pill-group">
            {["ALL", "DAY", "WEEK", "MONTH", "YEAR"].map((p) => (
              <button
                key={p}
                className={`period-pill-btn ${selectedPeriod === p ? "active" : ""}`}
                onClick={() => setSelectedPeriod(p)}
              >
                {p === "ALL" ? "All-Time" : p === "DAY" ? "Today" : p === "WEEK" ? "Week" : p === "MONTH" ? "Month" : "Year"}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters: Symbol, Model, Result */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Symbol Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Stock:</span>
            <select
              className="symbol-select-control"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{ padding: "5px 8px", fontSize: "11px" }}
            >
              {symbolList.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All Stocks / Assets" : s}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Model:</span>
            <select
              className="symbol-select-control"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ padding: "5px 8px", fontSize: "11px" }}
            >
              {modelList.map((m) => (
                <option key={m} value={m}>
                  {m === "ALL" ? "All Models" : m}
                </option>
              ))}
            </select>
          </div>

          {/* Result Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Result:</span>
            <select
              className="symbol-select-control"
              value={selectedResult}
              onChange={(e) => setSelectedResult(e.target.value)}
              style={{ padding: "5px 8px", fontSize: "11px" }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="WIN">Wins Only (Profit)</option>
              <option value="LOSS">Losses Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quantitative Model Attribution Summary Strip */}
      {data?.model_attribution && data.model_attribution.length > 0 && (
        <div
          style={{
            background: "rgba(10, 14, 22, 0.7)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
            🧠 Quantitative Model Predictive Attribution ({data.model_attribution.length} Models Evaluated)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {data.model_attribution.map((ma) => (
              <div
                key={ma.model}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#a5b4fc" }}>{ma.model}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: ma.win_rate >= 60 ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {ma.win_rate}% Win
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-dim)" }}>
                  <span>{ma.total} Trades ({ma.wins}W / {ma.total - ma.wins}L)</span>
                  <span style={{ fontWeight: 700, color: ma.pnl >= 0 ? "#10b981" : "#ef4444" }}>
                    {formatPnL(ma.pnl, "INR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spreadsheet Table View */}
      <div className="glass-card" style={{ padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
              <FileSpreadsheet size={16} color="#10b981" />
              <span>Master Execution & Prediction Log ({data?.records?.length || 0} Records)</span>
            </h3>
            <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
              Full chronological audit trail with predicted targets vs actual fills. Click any stock to view live interactive chart.
            </p>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            ⚡ Loading permanent audit sheet from disk...
          </div>
        ) : error ? (
          <div style={{ padding: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#fca5a5" }}>
            ⚠️ Error: {error}
          </div>
        ) : (
          <div className="audit-sheet-table-wrap">
            <table className="audit-sheet-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Date & Time (IST)</th>
                  <th>Symbol</th>
                  <th>Category</th>
                  <th>Action</th>
                  <th>Qty</th>
                  <th>Entry Price</th>
                  <th>Predicted Target</th>
                  <th>Stop Loss</th>
                  <th>Actual Exit</th>
                  <th>Duration</th>
                  <th>Realized P&L</th>
                  <th>Result</th>
                  <th>Model Used</th>
                  <th>Target Hit?</th>
                </tr>
              </thead>
              <tbody>
                {!data?.records || data.records.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ textAlign: "center", padding: "30px", color: "var(--text-dim)" }}>
                      No live trade executions recorded yet. Real Buy/Sell trades from the 24/7 server AutoBot and manual orders will permanently journal here as they execute.
                    </td>
                  </tr>
                ) : (
                  data.records.map((rec: MasterAuditRecord) => {
                    const isWin = rec.trade_result === "WIN" || rec.realized_pnl > 0;
                    const isTargetHit = rec.prediction_outcome === "TARGET_HIT" || rec.exit_reason === "TAKE_PROFIT";

                    return (
                      <tr key={rec.audit_id}>
                        {/* Audit ID */}
                        <td style={{ color: "var(--text-dim)", fontSize: "11px" }}>
                          {rec.audit_id}
                        </td>

                        {/* Timestamp IST */}
                        <td style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          {rec.timestamp_ist}
                        </td>

                        {/* Symbol */}
                        <td style={{ fontWeight: 800, color: "var(--text-main)" }}>
                          <span
                            onClick={() => onSelectSymbol && onSelectSymbol(rec.symbol)}
                            style={{ cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.2)" }}
                            title="Click to view chart"
                          >
                            {rec.symbol}
                          </span>
                        </td>

                        {/* Category */}
                        <td>
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(255, 255, 255, 0.06)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {rec.asset_category}
                          </span>
                        </td>

                        {/* Action */}
                        <td>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: rec.action === "BUY" || rec.action === "LONG" ? "rgba(16, 185, 129, 0.2)" : "rgba(225, 29, 72, 0.2)",
                              color: rec.action === "BUY" || rec.action === "LONG" ? "#10b981" : "#f43f5e",
                            }}
                          >
                            {rec.action}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td style={{ color: "var(--text-muted)" }}>
                          {rec.quantity}
                        </td>

                        {/* Entry Price */}
                        <td style={{ color: "var(--text-main)", fontWeight: 600 }}>
                          {formatPrice(rec.entry_price, rec.symbol)}
                        </td>

                        {/* Predicted Target */}
                        <td style={{ color: "#38bdf8", fontWeight: 600 }}>
                          {formatPrice(rec.predicted_target_price, rec.symbol)}
                        </td>

                        {/* Stop Loss */}
                        <td style={{ color: "#f87171" }}>
                          {formatPrice(rec.stop_loss, rec.symbol)}
                        </td>

                        {/* Actual Exit */}
                        <td style={{ color: "var(--text-main)", fontWeight: 700 }}>
                          {formatPrice(rec.exit_price, rec.symbol)}
                        </td>

                        {/* Duration */}
                        <td style={{ color: "var(--text-dim)", fontSize: "11px" }}>
                          {rec.duration_seconds}s
                        </td>

                        {/* Realized P&L */}
                        <td style={{ fontWeight: 800, color: isWin ? "var(--bullish-green)" : "var(--bearish-red)" }}>
                          {formatPnL(rec.realized_pnl, rec.symbol)}
                          <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.85 }}>
                            ({rec.realized_return_pct > 0 ? "+" : ""}{rec.realized_return_pct}%)
                          </span>
                        </td>

                        {/* Result Badge */}
                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isWin ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                              color: isWin ? "#10b981" : "#ef4444",
                            }}
                          >
                            {isWin ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {rec.trade_result}
                          </span>
                        </td>

                        {/* Model Used */}
                        <td style={{ color: "#a5b4fc", fontSize: "11px" }}>
                          {rec.prediction_model}
                        </td>

                        {/* Target Hit? */}
                        <td>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isTargetHit
                                ? "rgba(16, 185, 129, 0.2)"
                                : rec.exit_reason === "STOP_LOSS"
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(245, 158, 11, 0.2)",
                              color: isTargetHit
                                ? "#10b981"
                                : rec.exit_reason === "STOP_LOSS"
                                ? "#f87171"
                                : "#fbbf24",
                            }}
                          >
                            {isTargetHit
                              ? "✓ TARGET HIT"
                              : rec.exit_reason === "STOP_LOSS"
                              ? "✗ SL HIT"
                              : rec.prediction_outcome}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default MasterTradeAuditSheet;
