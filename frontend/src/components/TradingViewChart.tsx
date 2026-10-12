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
    position: "aboveBar" | "belowBar";
    color: string;
    shape: "arrowUp" | "arrowDown" | "circle";
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
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const isFirstLoadRef = useRef(true);

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

  // Smooth data update without chart recreation
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || candles.length === 0) return;

    // Sort and format candle timestamps
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

    candleSeriesRef.current.setData(formattedCandles);

    // Volume
    if (volumeSeriesRef.current) {
      if (showVolume) {
        const formattedVolume = candles
          .map((c) => ({
            time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
            value: c.volume,
            color: c.close >= c.open ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
          }))
          .filter((c, idx, arr) => idx === 0 || c.time > arr[idx - 1].time)
          .sort((a, b) => (a.time as number) - (b.time as number));
        volumeSeriesRef.current.setData(formattedVolume);
      } else {
        volumeSeriesRef.current.setData([]);
      }
    }

    // Indicators
    const sortedIndicators = [...indicators].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (ema9SeriesRef.current) {
      ema9SeriesRef.current.setData(
        showEma9
          ? sortedIndicators
              .filter((ind) => ind.ema_9 != null)
              .map((ind) => ({
                time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
                value: ind.ema_9!,
              }))
          : []
      );
    }

    if (ema20SeriesRef.current) {
      ema20SeriesRef.current.setData(
        showEma20
          ? sortedIndicators
              .filter((ind) => ind.ema_20 != null)
              .map((ind) => ({
                time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
                value: ind.ema_20!,
              }))
          : []
      );
    }

    if (ema50SeriesRef.current) {
      ema50SeriesRef.current.setData(
        showEma50
          ? sortedIndicators
              .filter((ind) => ind.ema_50 != null)
              .map((ind) => ({
                time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
                value: ind.ema_50!,
              }))
          : []
      );
    }

    if (bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
      if (showBollinger) {
        bbUpperSeriesRef.current.setData(
          sortedIndicators
            .filter((ind) => ind.bb_upper != null)
            .map((ind) => ({
              time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
              value: ind.bb_upper!,
            }))
        );
        bbLowerSeriesRef.current.setData(
          sortedIndicators
            .filter((ind) => ind.bb_lower != null)
            .map((ind) => ({
              time: Math.floor(new Date(ind.timestamp).getTime() / 1000) as any,
              value: ind.bb_lower!,
            }))
        );
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }

    // Signal Markers
    if (candleSeriesRef.current) {
      const formattedMarkers = signalMarkers.map((m) => ({
        time: Math.floor(new Date(m.time).getTime() / 1000) as any,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }));
      candleSeriesRef.current.setMarkers(formattedMarkers);
    }

    // Only fit content on initial load so user zoom is maintained
    if (isFirstLoadRef.current) {
      chartRef.current.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }
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
