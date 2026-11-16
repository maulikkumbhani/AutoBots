import React from "react";
import { X, Clock, CheckCircle2, AlertCircle, Calendar, ArrowUpRight } from "lucide-react";
import { MarketSessionsOverview, MarketSessionItem } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionsData: MarketSessionsOverview | null;
  onSelectSymbol: (symbol: string) => void;
}

export const MarketSessionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sessionsData,
  onSelectSymbol,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111827",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "850px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "#f3f4f6",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: 0,
              }}
            >
              <Clock size={20} color="#10b981" />
              Global Market Opening & Closing Schedules
            </h2>
            <p style={{ fontSize: "12px", color: "#9ca3af", margin: "4px 0 0 0" }}>
              Live real-time session tracking across Indian Equities, MCX/COMEX Commodities, Forex & 24/7 Crypto
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "none",
              color: "#9ca3af",
              borderRadius: "6px",
              padding: "6px",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Clocks & Overview Strip */}
        <div
          style={{
            padding: "16px 24px",
            background: "rgba(0, 0, 0, 0.2)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase" }}>Current IST Time</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#60a5fa", fontFamily: "var(--font-mono)" }}>
                {sessionsData?.current_time_ist || "Syncing..."}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase" }}>Current UTC Time</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#d1d5db", fontFamily: "var(--font-mono)" }}>
                {sessionsData?.current_time_utc || "Syncing..."}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <CheckCircle2 size={13} />
              {sessionsData?.open_count || 0} Markets Live
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <AlertCircle size={13} />
              {sessionsData?.closed_count || 0} Markets Closed
            </span>
          </div>
        </div>

        {/* Sessions Table */}
        <div style={{ padding: "16px 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left", color: "#9ca3af" }}>
                <th style={{ padding: "8px 10px" }}>Asset / Symbol</th>
                <th style={{ padding: "8px 10px" }}>Exchange</th>
                <th style={{ padding: "8px 10px" }}>Market Status</th>
                <th style={{ padding: "8px 10px" }}>Active Schedule / Countdown</th>
                <th style={{ padding: "8px 10px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                sessionsData.sessions.map((item: MarketSessionItem) => (
                  <tr
                    key={item.symbol}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{item.symbol}</span>
                        {item.symbol.includes("XAU") && (
                          <span style={{ fontSize: "10px", background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", padding: "1px 5px", borderRadius: "4px" }}>
                            MT5 Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>{item.name}</div>
                    </td>
                    <td style={{ padding: "10px", color: "#d1d5db" }}>
                      <div>{item.exchange}</div>
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>{item.class}</div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: item.is_open ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                          color: item.status_color,
                          border: `1px solid ${item.is_open ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: item.status_color,
                          }}
                        />
                        {item.status_badge}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: 600, color: item.is_open ? "#34d399" : "#fb7185" }}>
                        {item.timing_label}
                      </div>
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>
                        {item.session_status}
                      </div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <button
                        onClick={() => {
                          onSelectSymbol(item.symbol);
                          onClose();
                        }}
                        style={{
                          padding: "5px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "6px",
                          background: "rgba(99, 102, 241, 0.2)",
                          border: "1px solid rgba(99, 102, 241, 0.4)",
                          color: "#818cf8",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        Chart <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#9ca3af" }}>
                    Loading market sessions data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "11px",
            color: "#9ca3af",
          }}
        >
          <span>AutoBots Engine automatically pauses trade entries on closed markets and resumes on market open.</span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              background: "#374151",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

