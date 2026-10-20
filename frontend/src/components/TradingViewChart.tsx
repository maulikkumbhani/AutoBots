import React, { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, IPriceLine } from "lightweight-charts";
import { Candle, IndicatorValues } from "../types";

interface Props {
  symbol?: string;
  candles: Candle[];
  indicators?: IndicatorValues[];
  showEma9?: boolean;
  showEma20?: boolean;
  showEma50?: boolean;
  showBollinger?: boolean;
  showVolume?: boolean;
  targetPrice?: number | null;
  stopLossPrice?: number | null;
  entryPrice?: number | null;
  targetHitTime?: string | null;
  priceVelocity?: number | null;
  signalMarkers?: Array<{
    time: string;
    position: "aboveBar" | "belowBar";
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle";
    text: string;
  }>;
}

export const TradingViewChart: React.FC<Props> = ({
  symbol = "NIFTY 50",
  candles,
  indicators = [],
  showEma9 = true,
  showEma20 = true,
  showEma50 = true,
  showBollinger = true,
  showVolume = true,
  targetPrice = null,
  stopLossPrice = null,
  entryPrice = null,
  targetHitTime = null,
  priceVelocity = null,
  signalMarkers = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const stopLossLineRef = useRef<IPriceLine | null>(null);
  const entryLineRef = useRef<IPriceLine | null>(null);
  const isFirstLoadRef = useRef(true);
  const lastSymbolRef = useRef(symbol);

  // Initialize chart instance once
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#080b11" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      width: container.clientWidth,
      height: 450,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "rgba(255, 255, 255, 0.08)",
        rightOffset: 20, // 20 bars of whitespace on the right so future target lines and labels are clearly legible
        fixRightEdge: false, // Allow comfortable future space margin
        fixLeftEdge: false,
        shiftVisibleRangeOnNewBar: true,
        // Format bottom time scale ticks in Indian Standard Time (IST)
        tickMarkFormatter: (time: number, tickMarkType: number) => {
          const d = new Date(time * 1000);
          if (tickMarkType < 2) {
            return d.toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              month: "short",
              year: "2-digit",
            });
          }
          if (tickMarkType === 2) {
            return d.toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
            });
          }
          return d.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
        },
      },
      localization: {
        locale: "en-IN",
        dateFormat: "yyyy-MM-dd",
        // Format crosshair tooltip time in Indian Standard Time (IST) with millisecond precision
        timeFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const ms = String(d.getMilliseconds()).padStart(3, "0");
          return (
            d.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }) + `.${ms} IST`
          );
        },
        dateFormatter: (time: number) => {
          const d = new Date(time * 1000);
          return d.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        },
      },
      crosshair: {
        vertLine: { color: "rgba(99, 102, 241, 0.5)", width: 1, style: 3 },
        horzLine: { color: "rgba(99, 102, 241, 0.5)", width: 1, style: 3 },
      },
    });

    chartRef.current = chart;

    // Candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Volume series
    const vol = chart.addHistogramSeries({
      color: "rgba(99, 102, 241, 0.35)",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    vol.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = vol;

    // Overlays
    ema9SeriesRef.current = chart.addLineSeries({
      color: "#a855f7",
      lineWidth: 1,
      title: "EMA 9",
    });

    ema20SeriesRef.current = chart.addLineSeries({
      color: "#38bdf8",
      lineWidth: 2,
      title: "EMA 20",
    });

    ema50SeriesRef.current = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      title: "EMA 50",
    });

    bbUpperSeriesRef.current = chart.addLineSeries({
      color: "rgba(236, 72, 153, 0.65)",
      lineWidth: 1,
      lineStyle: 2,
      title: "BB Upper",
    });

    bbLowerSeriesRef.current = chart.addLineSeries({
      color: "rgba(236, 72, 153, 0.65)",
      lineWidth: 1,
      lineStyle: 2,
      title: "BB Lower",
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Update price precision when switching between Forex and stocks/crypto
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const isForex =
      symbol.toUpperCase().includes("GBP") ||
      symbol.toUpperCase().includes("EUR") ||
      symbol.toUpperCase().includes("USD/");
    candleSeriesRef.current.applyOptions({
      priceFormat: isForex
        ? { type: "price", precision: 4, minMove: 0.0001 }
        : { type: "price", precision: 2, minMove: 0.01 },
    });
  }, [symbol]);

  // Smooth data update and strict deduplication
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || candles.length === 0) return;

    // Parse, sort strictly ascending by timestamp, and remove duplicate bars
    const rawCandles = candles
      .map((c) => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
      }))
      .filter((c) => !isNaN(c.time) && !isNaN(c.close) && c.close > 0)
      .sort((a, b) => (a.time as number) - (b.time as number));

    const formattedCandles: Array<{ time: any; open: number; high: number; low: number; close: number }> = [];
    const formattedVolume: Array<{ time: any; value: number; color: string }> = [];

    for (const c of rawCandles) {
      if (formattedCandles.length === 0 || (c.time as number) > (formattedCandles[formattedCandles.length - 1].time as number)) {
        formattedCandles.push({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
        formattedVolume.push({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
        });
      }
    }

    candleSeriesRef.current.setData(formattedCandles);

    // Volume
    if (volumeSeriesRef.current) {
      if (showVolume) {
        volumeSeriesRef.current.setData(formattedVolume);
      } else {
        volumeSeriesRef.current.setData([]);
      }
    }

    // Indicators
    const sortedIndicators = [...indicators]
      .map((ind) => ({
        ...ind,
        time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
      }))
      .filter((ind) => !isNaN(ind.time))
      .sort((a, b) => (a.time as number) - (b.time as number));

    // Deduplicate indicator timestamps
    const dedupedInd: typeof sortedIndicators = [];
    for (const ind of sortedIndicators) {
      if (dedupedInd.length === 0 || (ind.time as number) > (dedupedInd[dedupedInd.length - 1].time as number)) {
        dedupedInd.push(ind);
      }
    }

    if (ema9SeriesRef.current) {
      ema9SeriesRef.current.setData(
        showEma9
          ? dedupedInd
              .filter((ind) => ind.ema_9 != null)
              .map((ind) => ({ time: ind.time, value: ind.ema_9! }))
          : []
      );
    }

    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData(
        showEma20
          ? dedupedInd
              .filter((ind) => ind.ema_20 != null)
              .map((ind) => ({ time: ind.time, value: ind.ema_20! }))
          : []
      );
    }

    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.setData(
        showEma50
          ? dedupedInd
              .filter((ind) => ind.ema_50 != null)
              .map((ind) => ({ time: ind.time, value: ind.ema_50! }))
          : []
      );
    }

    if (bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
      if (showBollinger) {
        bbUpperSeriesRef.current.setData(
          dedupedInd
            .filter((ind) => ind.bb_upper != null)
            .map((ind) => ({ time: ind.time, value: ind.bb_upper! }))
        );
        bbLowerSeriesRef.current.setData(
          dedupedInd
            .filter((ind) => ind.bb_lower != null)
            .map((ind) => ({ time: ind.time, value: ind.bb_lower! }))
        );
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }

    // Signal Markers
    if (candleSeriesRef.current) {
      const formattedMarkers = signalMarkers
        .map((m) => ({
          time: Math.floor(new Date(m.time).getTime() / 1000) as any,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      candleSeriesRef.current.setMarkers(formattedMarkers);
    }

    // Fit content when symbol changes or on first load, keeping comfortable 20 bars future right offset
    if (isFirstLoadRef.current || lastSymbolRef.current !== symbol) {
      chartRef.current.timeScale().fitContent();
      chartRef.current.timeScale().applyOptions({ rightOffset: 20 });
      isFirstLoadRef.current = false;
      lastSymbolRef.current = symbol;
    }
  }, [candles, indicators, showEma9, showEma20, showEma50, showBollinger, showVolume, signalMarkers, symbol]);

  // Synchronize dynamic AI Target, Stop-Loss, and Entry horizontal price corridor lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove existing target line if any
    if (targetLineRef.current) {
      try {
        candleSeriesRef.current.removePriceLine(targetLineRef.current);
      } catch (e) {
        // ignore
      }
      targetLineRef.current = null;
    }
    if (targetPrice && targetPrice > 0) {
      let etaLabel = "";
      if (targetHitTime) {
        try {
          const d = new Date(targetHitTime);
          if (!isNaN(d.getTime())) {
            const timeStr = d.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            etaLabel = ` [ETA ${timeStr} IST]`;
          }
        } catch {
          // ignore
        }
      }
      targetLineRef.current = candleSeriesRef.current.createPriceLine({
        price: targetPrice,
        color: "#10b981",
        lineWidth: 2,
        lineStyle: 1, // 1 = Dashed
        axisLabelVisible: true,
        title: `AI TARGET${etaLabel}`,
      });
    }

    // Remove existing stop-loss line if any
    if (stopLossLineRef.current) {
      try {
        candleSeriesRef.current.removePriceLine(stopLossLineRef.current);
      } catch (e) {
        // ignore
      }
      stopLossLineRef.current = null;
    }
    if (stopLossPrice && stopLossPrice > 0) {
      stopLossLineRef.current = candleSeriesRef.current.createPriceLine({
        price: stopLossPrice,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: 1, // 1 = Dashed
        axisLabelVisible: true,
        title: "AI STOP-LOSS",
      });
    }

    // Remove existing entry line if any
    if (entryLineRef.current) {
      try {
        candleSeriesRef.current.removePriceLine(entryLineRef.current);
      } catch (e) {
        // ignore
      }
      entryLineRef.current = null;
    }
    if (entryPrice && entryPrice > 0) {
      entryLineRef.current = candleSeriesRef.current.createPriceLine({
        price: entryPrice,
        color: "#6366f1",
        lineWidth: 1,
        lineStyle: 2, // 2 = Dotted
        axisLabelVisible: true,
        title: "AI ENTRY",
      });
    }

    return () => {
      if (candleSeriesRef.current) {
        if (targetLineRef.current) {
          try { candleSeriesRef.current.removePriceLine(targetLineRef.current); } catch (e) {}
          targetLineRef.current = null;
        }
        if (stopLossLineRef.current) {
          try { candleSeriesRef.current.removePriceLine(stopLossLineRef.current); } catch (e) {}
          stopLossLineRef.current = null;
        }
        if (entryLineRef.current) {
          try { candleSeriesRef.current.removePriceLine(entryLineRef.current); } catch (e) {}
          entryLineRef.current = null;
        }
      }
    };
  }, [targetPrice, stopLossPrice, entryPrice, targetHitTime, candles.length]);

  return (
    <div className="chart-container-wrapper">
      <div className="chart-header-bar">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="color-dot" style={{ background: "#a855f7" }}></span>
            <span>EMA 9</span>
          </div>
          <div className="legend-item">
            <span className="color-dot" style={{ background: "#38bdf8" }}></span>
            <span>EMA 20</span>
          </div>
          <div className="legend-item">
            <span className="color-dot" style={{ background: "#f59e0b" }}></span>
            <span>EMA 50</span>
          </div>
          <div className="legend-item">
            <span className="color-dot" style={{ background: "#ec4899" }}></span>
            <span>Bollinger Bands</span>
          </div>
          {targetPrice && (
            <div className="legend-item" style={{ color: "#10b981", fontWeight: 700 }}>
              <span className="color-dot" style={{ background: "#10b981" }}></span>
              <span>
                Target: {targetPrice.toFixed(symbol.includes("/") ? 4 : 2)}
                {targetHitTime && (() => {
                  try {
                    const d = new Date(targetHitTime);
                    if (isNaN(d.getTime())) return null;
                    return (
                      <span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--accent-primary)", background: "rgba(99, 102, 241, 0.15)", padding: "1px 6px", borderRadius: "3px", fontFamily: "var(--font-mono)" }}>
                        ETA {d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST
                      </span>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </span>
            </div>
          )}
          {stopLossPrice && (
            <div className="legend-item" style={{ color: "#ef4444", fontWeight: 700 }}>
              <span className="color-dot" style={{ background: "#ef4444" }}></span>
              <span>SL: {stopLossPrice.toFixed(symbol.includes("/") ? 4 : 2)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-dim)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(99, 102, 241, 0.15)", padding: "2px 8px", borderRadius: "4px", color: "var(--accent-primary)", fontWeight: 600 }}>
            IST (UTC+5:30) • Millisecond Precision
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>Future Offset: +20 Bars</span>
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: "100%", height: "450px" }} />
    </div>
  );
};
