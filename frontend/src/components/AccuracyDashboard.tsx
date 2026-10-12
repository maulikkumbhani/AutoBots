import React from "react";
import { AccuracyDashboardData } from "../types";
import { BarChart3, Target, CheckCheck, HelpCircle, ShieldAlert } from "lucide-react";

interface Props {
  accuracyData: AccuracyDashboardData | null;
}

export const AccuracyDashboard: React.FC<Props> = ({ accuracyData }) => {
  if (!accuracyData) {
    return (
      <div className="glass-card">
        <div style={{ color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
          Loading statistical accuracy dashboard...
        </div>
      </div>
    );
  }

  const { aggregate_metrics, by_regime, methodology } = accuracyData;
  const ci = aggregate_metrics.confidence_interval_95;

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <Target size={16} color="var(--accent-primary)" />
          <span>Prediction Accuracy & Statistical Calibration</span>
        </div>
        <span className="pill-badge pill-neutral">WILSON 95% CI CALIBRATED</span>
      </div>

      {/* Aggregate Accuracy Stats */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Directional Accuracy</div>
          <div className="stat-value" style={{ color: "var(--bullish-green)" }}>
            {aggregate_metrics.accuracy_pct != null ? `${aggregate_metrics.accuracy_pct}%` : "N/A"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            (Sample N = {aggregate_metrics.fully_evaluated})
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">95% Wilson Score CI</div>
          <div className="stat-value" style={{ fontSize: "14px", color: "var(--text-main)" }}>
            {ci ? `[${ci[0]}%, ${ci[1]}%]` : "N/A"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            Statistically Unbiased Interval
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Brier Calibration Score</div>
          <div className="stat-value" style={{ color: "var(--neutral-blue)" }}>
            {aggregate_metrics.brier_score_mean != null ? aggregate_metrics.brier_score_mean : "N/A"}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            Lower is better (0.0 to 2.0)
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">Unresolved Forecasts</div>
          <div className="stat-value" style={{ color: "var(--warning-amber)" }}>
            {aggregate_metrics.unresolved}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
            Excluded from denominator
          </div>
        </div>
      </div>

      {/* Small sample warning */}
      {aggregate_metrics.sample_size_warning && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "11px",
            color: "var(--warning-amber)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <ShieldAlert size={14} />
          <span>Small Sample Notice: Evaluated sample size (N = {aggregate_metrics.fully_evaluated}) is below 30. Wilson intervals reflect wider uncertainty.</span>
        </div>
      )}

      {/* Direction & Precision/Recall Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
            Accuracy by Predicted Direction
          </div>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Sample (N)</th>
                <th>Accuracy</th>
                <th>95% CI</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(aggregate_metrics.by_direction).map(([dir, data]) => (
                <tr key={dir}>
                  <td style={{ fontWeight: 700 }}>{dir}</td>
                  <td>{data.sample_size}</td>
                  <td style={{ color: (data.accuracy_pct || 0) >= 60 ? "var(--bullish-green)" : "inherit" }}>
                    {data.accuracy_pct != null ? `${data.accuracy_pct}%` : "-"}
                  </td>
                  <td style={{ fontSize: "10px" }}>
                    {data.confidence_interval_95 ? `[${data.confidence_interval_95[0]}%, ${data.confidence_interval_95[1]}%]` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
            Precision, Recall & F1
          </div>
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1 Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(aggregate_metrics.precision_recall_f1).map(([dir, data]) => (
                <tr key={dir}>
                  <td style={{ fontWeight: 700 }}>{dir}</td>
                  <td>{data.precision_pct}%</td>
                  <td>{data.recall_pct}%</td>
                  <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{data.f1_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regime Breakdown */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
          Accuracy by Market Regime
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
          {Object.entries(by_regime).map(([regime, data]) => (
            <div key={regime} className="stat-box" style={{ background: "rgba(10, 14, 22, 0.7)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>{regime}</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", marginTop: "4px" }}>
                {data.accuracy_pct != null ? `${data.accuracy_pct}%` : "N/A"}
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>N = {data.fully_evaluated}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
