import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { max, min } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";
import { arc, PieArcDatum, pie } from "d3-shape";
import { Colors } from "../constants/Colors";

type BarDatum = {
  label: string;
  value: number;
};

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

type D3BarChartProps = {
  data: BarDatum[];
  width: number;
  height?: number;
  valuePrefix?: string;
  formatValue?: (value: number) => string;
};

type D3DonutChartProps = {
  data: DonutDatum[];
  width: number;
  height?: number;
};

const axisColor = "#D7E5DD";
const labelColor = Colors.textSecondary;

const compactNumber = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (absolute >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(Math.round(value));
};

export function D3BarChart({
  data,
  width,
  height = 240,
  valuePrefix = "",
  formatValue = compactNumber,
}: D3BarChartProps) {
  const cleanData = data.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? item.value : 0,
  }));
  const margin = { top: 34, right: 10, bottom: 42, left: 42 };
  const innerWidth = Math.max(1, width - margin.left - margin.right);
  const innerHeight = Math.max(1, height - margin.top - margin.bottom);
  const minValue = Math.min(0, min(cleanData, (item) => item.value) || 0);
  const maxValue = Math.max(0, max(cleanData, (item) => item.value) || 0);
  const yDomainMax = maxValue === minValue ? maxValue + 1 : maxValue;
  const yDomainMin = maxValue === minValue ? minValue - 1 : minValue;
  const xScale = scaleBand<string>()
    .domain(cleanData.map((item) => item.label))
    .range([0, innerWidth])
    .padding(0.34);
  const yScale = scaleLinear()
    .domain([yDomainMin, yDomainMax])
    .nice()
    .range([innerHeight, 0]);
  const ticks = yScale.ticks(4);
  const zeroY = yScale(0);

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        <G x={margin.left} y={margin.top}>
          {ticks.map((tick) => {
            const y = yScale(tick);
            return (
              <G key={tick}>
                <Line
                  x1={0}
                  x2={innerWidth}
                  y1={y}
                  y2={y}
                  stroke={axisColor}
                  strokeDasharray="4 6"
                />
                <SvgText
                  x={-10}
                  y={y + 4}
                  textAnchor="end"
                  fill={labelColor}
                  fontSize={9}
                >
                  {compactNumber(tick)}
                </SvgText>
              </G>
            );
          })}

          <Line x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} stroke="#AFCABA" />

          {cleanData.map((item) => {
            const x = xScale(item.label) || 0;
            const y = yScale(Math.max(item.value, 0));
            const barHeight = Math.abs(yScale(item.value) - zeroY);
            const barY = item.value >= 0 ? y : zeroY;
            const labelY = item.value >= 0 ? barY - 8 : barY + barHeight + 14;
            return (
              <G key={item.label}>
                <Rect
                  x={x}
                  y={barY}
                  width={xScale.bandwidth()}
                  height={Math.max(2, barHeight)}
                  rx={7}
                  fill={item.value >= 0 ? Colors.secondary : Colors.error}
                />
                <SvgText
                  x={x + xScale.bandwidth() / 2}
                  y={labelY}
                  textAnchor="middle"
                  fill={Colors.textPrimary}
                  fontSize={9}
                  fontWeight="700"
                >
                  {formatValue(item.value)}
                </SvgText>
                <SvgText
                  x={x + xScale.bandwidth() / 2}
                  y={innerHeight + 28}
                  textAnchor="middle"
                  fill={labelColor}
                  fontSize={10}
                >
                  {item.label.slice(0, 8)}
                </SvgText>
              </G>
            );
          })}
        </G>

        {valuePrefix ? (
          <SvgText x={10} y={16} fill={labelColor} fontSize={10} fontWeight="700">
            {valuePrefix}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export function D3DonutChart({ data, width, height = 240 }: D3DonutChartProps) {
  const cleanData = data.filter((item) => item.value > 0);
  const chartSize = Math.min(width, height);
  const radius = Math.max(40, chartSize / 2 - 18);
  const innerRadius = radius * 0.58;
  const total = cleanData.reduce((sum, item) => sum + item.value, 0);
  const arcs = pie<DonutDatum>()
    .value((item) => item.value)
    .sort(null)(cleanData);
  const arcPath = arc<PieArcDatum<DonutDatum>>()
    .innerRadius(innerRadius)
    .outerRadius(radius)
    .cornerRadius(5);

  return (
    <View style={styles.donutLayout}>
      <Svg width={chartSize} height={height}>
        <G x={chartSize / 2} y={height / 2}>
          {arcs.map((slice) => (
            <Path
              key={slice.data.label}
              d={arcPath(slice) || ""}
              fill={slice.data.color}
              stroke={Colors.surface}
              strokeWidth={3}
            />
          ))}
          <Circle r={innerRadius - 5} fill={Colors.surface} />
          <SvgText
            x={0}
            y={-4}
            textAnchor="middle"
            fill={Colors.textPrimary}
            fontSize={26}
            fontWeight="800"
          >
            {total}
          </SvgText>
          <SvgText x={0} y={18} textAnchor="middle" fill={labelColor} fontSize={12}>
            usuarios
          </SvgText>
        </G>
      </Svg>

      <View style={styles.legend}>
        {cleanData.map((item) => {
          const percentage = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>
                {item.value} ({percentage}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    alignItems: "center",
    width: "100%",
  },
  donutLayout: {
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  legend: {
    gap: 8,
    width: "100%",
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  legendSwatch: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: Colors.textPrimary,
    flex: 1,
    fontWeight: "700",
  },
  legendValue: {
    color: Colors.textSecondary,
  },
});
