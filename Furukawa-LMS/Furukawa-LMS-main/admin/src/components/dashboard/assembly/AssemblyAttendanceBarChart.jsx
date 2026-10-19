import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { AXIS_TICK, GRID_STROKE, renderBarValueLabel } from "./assemblyChartUtils.jsx";
import { SeriesLegend, AttendanceTooltip, WrappedNameTick } from "./assemblyChartShared.jsx";

// Each bar past the first two (Total + Present) widens its group by this much
const EXTRA_BAR_WIDTH = 36;

// Grouped Total / Present bars shared by the Section-wise Summary and the section cards.
// series comes from getBarSeries, so the bars, legend, tooltip and table stay in step.
const AssemblyAttendanceBarChart = ({
    rows,
    series,
    shift,
    shiftKeys,
    nameLabel,
    groupWidth,
    height,
    labelCharsPerLine,
    labelMaxLines,
}) => {
    const widthPerGroup = groupWidth + Math.max(series.length - 2, 0) * EXTRA_BAR_WIDTH;
    const xAxisHeight = 16 + labelMaxLines * 14;

    return (
        <>
            <div className="mt-4 w-full overflow-x-auto pb-1">
                <div style={{ width: '100%', minWidth: Math.max(320, rows.length * widthPerGroup), height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 24, right: 8, left: -8, bottom: 4 }} barGap={2} barCategoryGap="16%">
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                            <XAxis
                                dataKey="name"
                                interval={0}
                                tick={<WrappedNameTick charsPerLine={labelCharsPerLine} maxLines={labelMaxLines} />}
                                height={xAxisHeight}
                                tickLine={false}
                                axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: '#f1f5f9' }}
                                content={<AttendanceTooltip nameLabel={nameLabel} shift={shift} shiftKeys={shiftKeys} />}
                            />
                            {series.map(item => (
                                <Bar
                                    key={item.dataKey}
                                    dataKey={item.dataKey}
                                    name={item.label}
                                    fill={item.color}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={40}
                                    minPointSize={item.hideZeroLabel ? 0 : 2}
                                >
                                    <LabelList dataKey={item.dataKey} content={renderBarValueLabel(item.hideZeroLabel)} />
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="mt-2">
                <SeriesLegend series={series} />
            </div>
        </>
    );
};

export default AssemblyAttendanceBarChart;
