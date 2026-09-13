'use client';

/**
 * RAKSHAK AI — Shared Chart Components
 * All charts built with Recharts, styled to match the dark/light dashboard aesthetic.
 */

import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line, Area, AreaChart,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── Colour Palette ──────────────────────────────────────────────────────────

export const RISK_COLORS = {
    Critical: '#dc2626',
    High: '#f59e0b',
    Medium: '#3b82f6',
    Low: '#10b981',
};

export const STATUS_COLORS: Record<string, string> = {
    Alert: '#dc2626',
    'In-Transit': '#0284c7',
    Scheduled: '#9333ea',
    Completed: '#10b981',
    Cancelled: '#64748b',
    Active: '#10b981',
    Inactive: '#94a3b8',
};


const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: '0.8rem',
    color: '#f1f5f9',
};

const legendStyle = { fontSize: '0.75rem', color: '#94a3b8' };

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
    name?: string;
    value?: string | number;
    color?: string;
    fill?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div style={tooltipStyle}>
            {label && <div style={{ padding: '6px 10px 4px', fontWeight: 700, color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{label}</div>}
            <div style={{ padding: '6px 10px 8px' }}>
                {payload.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: i > 0 ? 4 : 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#94a3b8' }}>{p.name}:</span>
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── 1. Severity Donut ────────────────────────────────────────────────────────

interface SeverityDonutProps {
    critical: number;
    high: number;
    medium: number;
    low: number;
    title?: string;
    size?: number;
}

export function SeverityDonut({ critical, high, medium, low, title = 'Alert Breakdown', size = 180 }: SeverityDonutProps) {
    const data = [
        { name: 'Critical', value: critical, color: RISK_COLORS.Critical },
        { name: 'High', value: high, color: RISK_COLORS.High },
        { name: 'Medium', value: medium, color: RISK_COLORS.Medium },
        { name: 'Low', value: low, color: RISK_COLORS.Low },
    ].filter(d => d.value > 0);

    const total = critical + high + medium + low;

    if (total === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: size, color: '#64748b' }}>
                <span style={{ fontSize: '2rem' }}>✓</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>No alerts</span>
            </div>
        );
    }

    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 4, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={size}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={size * 0.25}
                        outerRadius={size * 0.38}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                    >
                        {data.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        formatter={(value) => <span style={legendStyle}>{value}</span>}
                        iconSize={8}
                        iconType="circle"
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 2. Risk Score Bar Chart ──────────────────────────────────────────────────

interface RiskBarEntry { label: string; score: number; }

interface RiskBarsProps {
    data: RiskBarEntry[];
    title?: string;
    height?: number;
    horizontal?: boolean;
}

export function RiskBars({ data, title, height = 200, horizontal = false }: RiskBarsProps) {
    const colored = data.map(d => ({
        ...d,
        fill: d.score >= 75 ? RISK_COLORS.Critical : d.score >= 55 ? RISK_COLORS.High : d.score >= 35 ? RISK_COLORS.Medium : RISK_COLORS.Low,
    }));

    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={colored} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: horizontal ? 60 : 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    {horizontal ? (
                        <>
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} />
                        </>
                    ) : (
                        <>
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                        </>
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" name="Risk Score" radius={[4, 4, 0, 0]}>
                        {colored.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 3. Fleet Status Distribution (Donut) ────────────────────────────────────

interface FleetStatusDonutProps {
    statusCounts: Record<string, number>;
    title?: string;
    size?: number;
}

export function FleetStatusDonut({ statusCounts, title = 'Fleet Status', size = 180 }: FleetStatusDonutProps) {
    const data = Object.entries(statusCounts)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#64748b' }));

    if (data.length === 0) return null;

    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 4, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={size}>
                <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={size * 0.24} outerRadius={size * 0.37} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={legendStyle}>{v}</span>} iconSize={8} iconType="circle" />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 4. Risk Timeline (Area Chart) ───────────────────────────────────────────

interface TimelinePoint { time: string; risk: number; label?: string; }

interface RiskTimelineProps {
    data: TimelinePoint[];
    title?: string;
    height?: number;
    color?: string;
}

export function RiskTimeline({ data, title, height = 160, color = '#3b82f6' }: RiskTimelineProps) {
    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`grad_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone" dataKey="risk" name="Risk Score"
                        stroke={color} strokeWidth={2}
                        fill={`url(#grad_${color.replace('#', '')})`}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 5. Company Fleet Bar Chart (horizontal) ──────────────────────────────────

interface CompanyBarEntry { name: string; trucks: number; trips: number; active: number; }

interface CompanyFleetBarsProps {
    data: CompanyBarEntry[];
    title?: string;
    height?: number;
}

export function CompanyFleetBars({ data, title, height = 260 }: CompanyFleetBarsProps) {
    const truncated = data.slice(0, 8).map(d => ({
        ...d,
        name: d.name.length > 14 ? d.name.substring(0, 13) + '…' : d.name,
    }));

    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={truncated} layout="vertical" margin={{ top: 4, right: 24, left: 70, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={65} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={legendStyle}>{v}</span>} iconSize={8} />
                    <Bar dataKey="trucks" name="Total Trucks" fill="#3b82f6" radius={[0, 3, 3, 0]} barSize={9} />
                    <Bar dataKey="active" name="Active Trucks" fill="#10b981" radius={[0, 3, 3, 0]} barSize={9} />
                    <Bar dataKey="trips" name="Total Trips" fill="#8b5cf6" radius={[0, 3, 3, 0]} barSize={9} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 6. Multi-Line Comparison (trips over time) ───────────────────────────────

interface MultiLineEntry { label: string;[key: string]: string | number; }

export function MultiLineChart({ data, lines, title, height = 180 }: {
    data: MultiLineEntry[];
    lines: { key: string; color: string; label: string }[];
    title?: string;
    height?: number;
}) {
    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={legendStyle}>{v}</span>} iconSize={8} />
                    {lines.map(l => (
                        <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={{ r: 3, fill: l.color }} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 7. Radar Chart (AI Agent Scores) ────────────────────────────────────────

interface RadarEntry { subject: string; score: number; }

export function AgentRadar({ data, title, size = 260 }: { data: RadarEntry[]; title?: string; size?: number }) {
    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 12, textTransform: 'uppercase', width: '100%' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={size}>
                <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                    <PolarGrid
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={1}
                        gridType="polygon"
                    />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                        axisLine={false}
                        tickCount={5}
                    />
                    <Radar
                        name="Factor Score"
                        dataKey="score"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.4}
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 8. Mini Sparkline (inline) ───────────────────────────────────────────────

export function Sparkline({ data, color = '#3b82f6', height = 40 }: { data: number[]; color?: string; height?: number }) {
    const pts = data.map((v, i) => ({ i, v }));
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={`spark_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark_${color.replace('#', '')})`} dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ─── 9. Stacked Bar (alert types over time) ───────────────────────────────────

export function AlertStackedBar({ data, title, height = 180 }: {
    data: { label: string; Critical: number; High: number; Medium: number; Low: number }[];
    title?: string;
    height?: number;
}) {
    return (
        <div>
            {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>{title}</div>}
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend formatter={(v) => <span style={legendStyle}>{v}</span>} iconSize={8} />
                    <Bar dataKey="Critical" stackId="a" fill={RISK_COLORS.Critical} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="High" stackId="a" fill={RISK_COLORS.High} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Medium" stackId="a" fill={RISK_COLORS.Medium} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Low" stackId="a" fill={RISK_COLORS.Low} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
