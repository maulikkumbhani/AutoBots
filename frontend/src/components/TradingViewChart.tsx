import React, { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import { Candle, IndicatorValues } from "../types";

interface Props {
  candles: Candle[];
  indicators?: IndicatorValues[];
  showEma9?: boolean;
  showEma20?: boolean;
  showEma50?: boolean;
  showBollinger?: boolean;
  showVolume?: boolean;
  signalMarkers?: Array<{
    time: string;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle';
    text: string;
  }>;
}

export const TradingViewChart: React.FC<Props> = ({
  candles,
  indicators = [],
  showEma9 = true,
  showEma20 = true,
  showEma50 = true,
  showBollinger = true,
  showVolume = true,
  signalMarkers = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Clean previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

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
      height: 440,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255, 255, 255, 0.08)",
      },
      crosshair: {
        vertLine: { color: "rgba(99, 102, 241, 0.4)", width: 1, style: 3 },
        horzLine: { color: "rgba(99, 102, 241, 0.4)", width: 1, style: 3 },
      },
    });

    chartRef.current = chart;

    // 1. Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Format candle data (timestamps converted to UNIX seconds)
    const formattedCandles = candles
      .map((c) => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .filter((c, idx, arr) => idx === 0 || c.time > arr[idx - 1].time)
      .sort((a, b) => (a.time as number) - (b.time as number));

    candleSeries.setData(formattedCandles);

    // 2. Volume series
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: "rgba(99, 102, 241, 0.35)",
        priceFormat: { type: "volume" },
        priceScaleId: "", // Overlay on separate subscale
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      const formattedVolume = candles
        .map((c) => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
        }))
        .filter((c, idx, arr) => idx === 0 || c.time > arr[idx - 1].time)
        .sort((a, b) => (a.time as number) - (b.time as number));

      volumeSeries.setData(formattedVolume);
    }

    // 3. Technical Indicator Overlays
    if (indicators && indicators.length > 0) {
      // Map indicator timestamps
      const sortedIndicators = [...indicators].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // EMA 9
      if (showEma9) {
        const ema9Series = chart.addLineSeries({
          color: "#a855f7", // Purple
          lineWidth: 1,
          title: "EMA 9",
        });
        const ema9Data = sortedIndicators
          .filter((ind) => ind.ema_9 != null)
          .map((ind) => ({
            time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
            value: ind.ema_9!,
          }));
        if (ema9Data.length > 0) ema9Series.setData(ema9Data);
      }

      // EMA 20
      if (showEma20) {
        const ema20Series = chart.addLineSeries({
          color: "#38bdf8", // Cyan / Blue
          lineWidth: 2,
          title: "EMA 20",
        });
        const ema20Data = sortedIndicators
          .filter((ind) => ind.ema_20 != null)
          .map((ind) => ({
            time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
            value: ind.ema_20!,
          }));
        if (ema20Data.length > 0) ema20Series.setData(ema20Data);
      }

      // EMA 50
      if (showEma50) {
        const ema50Series = chart.addLineSeries({
          color: "#f59e0b", // Amber
          lineWidth: 2,
          title: "EMA 50",
        });
        const ema50Data = sortedIndicators
          .filter((ind) => ind.ema_50 != null)
          .map((ind) => ({
            time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
            value: ind.ema_50!,
          }));
        if (ema50Data.length > 0) ema50Series.setData(ema50Data);
      }

      // Bollinger Bands
      if (showBollinger) {
        const bbUpperSeries = chart.addLineSeries({
          color: "rgba(236, 72, 153, 0.65)", // Pink
          lineWidth: 1,
          lineStyle: 2, // Dashed
          title: "BB Upper",
        });
        const bbLowerSeries = chart.addLineSeries({
          color: "rgba(236, 72, 153, 0.65)",
          lineWidth: 1,
          lineStyle: 2,
          title: "BB Lower",
        });
        const upperData = sortedIndicators
          .filter((ind) => ind.bb_upper != null)
          .map((ind) => ({
            time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
            value: ind.bb_upper!,
          }));
        const lowerData = sortedIndicators
          .filter((ind) => ind.bb_lower != null)
          .map((ind) => ({
            time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
            value: ind.bb_lower!,
          }));
        if (upperData.length > 0) bbUpperSeries.setData(upperData);
        if (lowerData.length > 0) bbLowerSeries.setData(lowerData);
      }
    }

    // 4. Signal Markers
    if (signalMarkers.length > 0) {
      const formattedMarkers = signalMarkers.map((m) => ({
        time: Math.floor(new Date(m.time).getTime() / 1000) as any,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }));
      candleSeries.setMarkers(formattedMarkers);
    }

    chart.timeScale().fitContent();

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, indicators, showEma9, showEma20, showEma50, showBollinger, showVolume, signalMarkers]);

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
        </div>
      </div>
      <div ref={chartContainerRef} style={{ width: "100%", height: "440px" }} />
    </div>
  );
};
