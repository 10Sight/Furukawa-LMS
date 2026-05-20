import React, { useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';
import { BarChart as IconBar, PieChart as IconPie } from "lucide-react";
import { Button } from "@/components/ui/button";

// Initialize 3D module
if (typeof highcharts3d === 'function' && !Highcharts.Chart.prototype.add3DDecoration) {
    highcharts3d(Highcharts);
}

const COLORS = [
    '#0077c2', '#0a114d', '#f29100', '#94a3b8', '#8b5cf6',
    '#0ea5e9', '#1e293b', '#fbbf24', '#64748b', '#a855f7',
    '#3b82f6', '#1e1b4b', '#d97706', '#475569', '#7c3aed',
    '#0284c7', '#0f172a', '#b45309', '#334155', '#6d28d9'
];

const DPRQualityChart = ({ data, theme }) => {
    const [chartType, setChartType] = useState('bar');

    // Pie chart shows share of defects per line
    const pieData = useMemo(() => {
        return data.map(item => ({
            name: item.name,
            y: item.defectQty || 0,
            productionQty: item.productionQty || 0,
            ppm: item.ppm || 0
        }));
    }, [data]);

    const getBarOptions = () => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 450,
            style: { fontFamily: 'inherit' }
        },
        title: { text: '' },
        xAxis: {
            categories: data.map(item => item.name),
            labels: { 
                rotation: -45,
                align: 'right',
                autoRotation: false,
                style: { color: '#64748b', fontSize: '10px' } 
            },
            lineWidth: 0,
            tickWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Quantities', style: { color: '#64748b' } },
                labels: { style: { color: '#64748b' } },
                gridLineColor: theme.border === 'border-gray-800' ? '#334155' : '#f1f5f9'
            },
            {
                title: { text: 'PPM', style: { color: '#f59e0b', fontWeight: 'bold' } },
                labels: { style: { color: '#f59e0b' } },
                opposite: true,
                gridLineWidth: 0
            }
        ],
        tooltip: {
            shared: true,
            useHTML: true,
            backgroundColor: theme.card === 'bg-white' ? '#ffffff' : '#1e293b',
            borderColor: '#e2e8f0',
            borderRadius: 12,
            style: { color: theme.textMain === 'text-gray-900' ? '#0f172a' : '#f8fafc' }
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0,
                borderRadius: 4,
                dataLabels: {
                    enabled: true,
                    style: { fontSize: '10px', fontWeight: 'bold' }
                }
            },
            spline: {
                dataLabels: {
                    enabled: true,
                    format: '{y} PPM',
                    y: -15,
                    style: { fontSize: '11px', fontWeight: '800', color: '#f59e0b', textOutline: '2px white' }
                },
                marker: {
                    radius: 5,
                    lineWidth: 2,
                    lineColor: '#f59e0b',
                    fillColor: 'white'
                }
            }
        },
        series: [
            {
                name: 'Production Qty',
                data: data.map(item => item.productionQty),
                color: {
                    linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 },
                    stops: [
                        [0, '#818cf8'],
                        [1, '#6366f1']
                    ]
                },
                yAxis: 0
            },
            {
                name: 'Defect Qty',
                data: data.map(item => item.defectQty),
                color: {
                    linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 },
                    stops: [
                        [0, '#fb7185'],
                        [1, '#ef4444']
                    ]
                },
                yAxis: 0
            },
            {
                name: 'PPM',
                type: 'spline',
                data: data.map(item => item.ppm),
                color: '#f59e0b',
                lineWidth: 4,
                shadow: {
                    color: 'rgba(245, 158, 11, 0.4)',
                    width: 10,
                    offsetX: 0,
                    offsetY: 0
                },
                yAxis: 1
            }
        ],
        legend: {
            align: 'right',
            verticalAlign: 'top',
            itemStyle: { color: '#64748b', fontSize: '12px' }
        },
        credits: { enabled: false }
    });

    const getPieOptions = () => ({
        chart: {
            type: 'pie',
            options3d: {
                enabled: true,
                alpha: 0,
                beta: 0
            },
            backgroundColor: 'transparent',
            height: 600
        },
        title: { text: '' },
        tooltip: {
            headerFormat: '<span style="font-size: 12px; font-weight: bold">{point.key}</span><br/>',
            pointFormat: 'Defects: <b>{point.y}</b> ({point.percentage:.1f}%)<br/>Production: <b>{point.productionQty}</b><br/>PPM: <b style="color: #f59e0b">{point.ppm}</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                innerSize: 0,
                colors: COLORS,
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    style: { color: '#64748b', fontSize: '11px' }
                },
                point: {
                    events: {
                        mouseOver: function () {
                            this.slice();
                        },
                        mouseOut: function () {
                            this.slice();
                        }
                    }
                },
                states: {
                    hover: {
                        brightness: 0.1
                    }
                }
            }
        },
        series: [{
            name: 'Quality Share',
            data: pieData
        }],
        credits: { enabled: false }
    });

    return (
        <div className={`p-6 rounded-xl border ${theme.border} ${theme.card} shadow-sm w-full transition-all duration-300`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className={`text-lg font-bold tracking-tight ${theme.textMain}`}>Quality (Defect Summary)</h3>
                    <p className={`text-sm ${theme.textMuted}`}>Internal defect trends, production vs. rejects, and PPM rate</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100/80 p-1.5 rounded-xl self-start md:self-center">
                    <Button 
                        variant={chartType === 'bar' ? 'secondary' : 'ghost'} 
                        size="sm"
                        onClick={() => setChartType('bar')}
                        className={`h-8 rounded-lg ${chartType === 'bar' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                    >
                        <IconBar className="w-3.5 h-3.5 mr-2" />
                        Bar Chart
                    </Button>
                    <Button 
                        variant={chartType === 'pie' ? 'secondary' : 'ghost'} 
                        size="sm"
                        onClick={() => setChartType('pie')}
                        className={`h-8 rounded-lg ${chartType === 'pie' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                    >
                        <IconPie className="w-3.5 h-3.5 mr-2" />
                        Pie Chart
                    </Button>
                </div>
            </div>

            <div className={`flex flex-col ${chartType === 'pie' ? 'lg:flex-row' : ''} gap-6`}>
                <div className="flex-1 min-w-0">
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={chartType === 'bar' ? getBarOptions() : getPieOptions()}
                    />
                </div>

                {chartType === 'pie' && data.length > 0 && (
                    <div className="lg:w-[450px] flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="text-xs font-bold uppercase text-gray-400 mb-2 px-1">Defect Breakdown</div>
                        {data.map((item, idx) => (
                            <div 
                                key={idx} 
                                className={`p-3 rounded-xl border ${theme.border} bg-gray-50/50 flex justify-between items-center hover:bg-gray-50 transition-colors shadow-sm`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" 
                                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                    ></div>
                                    <span className={`text-[11px] font-bold truncate ${theme.textMain}`}>{item.name}</span>
                                </div>
                                <div className="flex gap-4 shrink-0 ml-2">
                                    <div className="text-right">
                                        <div className="text-sm font-black text-red-600">{item.defectQty}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase">Defects</div>
                                    </div>
                                    <div className="text-right border-l pl-4 border-gray-200">
                                        <div className="text-sm font-black text-gray-600">{item.productionQty}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase">Prod</div>
                                    </div>
                                    <div className="text-right border-l pl-4 border-gray-200">
                                        <div className="text-sm font-black text-amber-600">{item.ppm}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase">PPM</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DPRQualityChart;
