'use client';

import { useEffect, useState, useRef, ComponentType } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import Link from 'next/link';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ComposedChart, Bar, Line, Cell, PieChart, Pie, BarChart, ReferenceLine,
    Legend,
} from 'recharts';
import styles from './page.module.css';
import { getFleetData, FleetVehicle } from '@/services/apiClient';
import { Leaf, ArrowRight, Wind, Recycle, ShieldCheck, Sprout, Cpu, Zap, Shield } from 'lucide-react';

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 85, damping: 18 } }
};
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const scaleIn = {
    hidden: { opacity: 0, scale: 0.88 },
    show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 100, damping: 14 } }
};

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '', prefix = '', decimals = 0 }: {
    value: number; suffix?: string; prefix?: string; decimals?: number;
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const mv = useMotionValue(0);
    const spring = useSpring(mv, { stiffness: 55, damping: 20 });
    const [display, setDisplay] = useState(0);
    useEffect(() => { if (inView) mv.set(value); }, [inView, value, mv]);
    useEffect(() => { const u = spring.on('change', v => setDisplay(parseFloat(v.toFixed(decimals)))); return u; }, [spring, decimals]);
    return <span ref={ref}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
interface ChartTipPayloadEntry {
    name?: string;
    value?: string | number;
    color?: string;
    fill?: string;
}

interface ChartTipProps {
    active?: boolean;
    payload?: ChartTipPayloadEntry[];
    label?: string;
    unit?: string;
}

function ChartTip({ active, payload, label, unit = '' }: ChartTipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', backdropFilter: 'blur(8px)',
        }}>
            {label && <div style={{ color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>{label}</div>}
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: i > 0 ? 4 : 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color ?? p.fill, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: '#94a3b8' }}>{p.name}:</span>
                    <span style={{ fontWeight: 800, color: '#f1f5f9' }}>{p.value}{unit}</span>
                </div>
            ))}
        </div>
    );
}

// ── SDG Badge pill ────────────────────────────────────────────────────────────
function SDGBadge({ number, color, title }: { number: string; color: string; title: string }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: color, borderRadius: 16, padding: '0.9rem 1.4rem',
            minWidth: 155, textAlign: 'center', gap: '0.4rem',
            boxShadow: `0 8px 24px ${color}55`,
        }}>
            <span style={{ fontSize: '2rem', fontWeight: 900, color: 'white', lineHeight: 1 }}>{number}</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>{title}</span>
        </div>
    );
}

// ── Glassmorphism metric card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, sdg }: {
    icon: ComponentType<{ size?: number }>; label: string; value: string | number; sub: string; color: string; sdg?: string;
}) {
    return (
        <motion.div variants={scaleIn} className={styles.statCard}>
            <div className={styles.statTop}>
                <div className={styles.statIcon} style={{ background: `${color}18`, color }}>
                    <Icon size={22} />
                </div>
                {sdg && <span className={styles.statSDG} style={{ background: `${color}20`, color }}>{sdg}</span>}
            </div>
            <div className={styles.statValue} style={{ color }}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statSub}>{sub}</div>
        </motion.div>
    );
}

// ── Generate CO₂ trend data (28 days) ─────────────────────────────────────────
function buildCO2Trend(baseline: number, optimised: number, vehicles: number) {
    const days = ['Jan 31', 'Feb 1', 'Feb 5', 'Feb 9', 'Feb 13', 'Feb 17', 'Feb 21', 'Feb 25', 'Feb 27'];
    return days.map((day, i) => {
        const factor = 0.78 + Math.sin(i * 0.9) * 0.12 + i * 0.012;
        return {
            day,
            actual: Math.round(optimised * vehicles * factor * 0.68),
            baseline: Math.round(baseline * vehicles * factor * 0.72),
            saved: Math.round((baseline - optimised) * vehicles * factor * 0.7),
        };
    });
}

// ── Build per-truck data ──────────────────────────────────────────────────────
function buildTruckEmissions(fleet: FleetVehicle[]) {
    const base = [
        { id: 'TR-102', baseline: 320, cargo: 'Electronics' },
        { id: 'TR-205', baseline: 310, cargo: 'Pharma' },
        { id: 'TR-318', baseline: 325, cargo: 'Textiles' },
        { id: 'TR-440', baseline: 315, cargo: 'Auto Parts' },
        { id: 'TR-557', baseline: 330, cargo: 'Steel Coils' },
        { id: 'TR-613', baseline: 318, cargo: 'FMCG' },
    ];
    return base.map((b) => {
        const match = fleet.find(v => v.info.id === b.id);
        const risk = match?.risk.level;
        const actual = risk === 'Low' ? Math.round(b.baseline * 0.56) : risk === 'Medium' ? Math.round(b.baseline * 0.72) : risk === 'High' ? Math.round(b.baseline * 0.89) : Math.round(b.baseline * 0.97);
        return { ...b, actual, saved: b.baseline - actual, saving: Math.round(((b.baseline - actual) / b.baseline) * 100) };
    });
}

// ── SDG radar data ────────────────────────────────────────────────────────────
function buildRadar(sdg9: number, sdg12: number, sdg13: number) {
    return [
        { axis: 'AI Uptime', sdg9: 99, sdg12: 60, sdg13: 55 },
        { axis: 'Route Optim.', sdg9: 82, sdg12: 75, sdg13: sdg13 },
        { axis: 'CO₂ Reduction', sdg9: 45, sdg12: 60, sdg13: sdg13 },
        { axis: 'Cargo Integrity', sdg9: 70, sdg12: sdg12, sdg13: 50 },
        { axis: 'Waste Avoided', sdg9: 55, sdg12: sdg12, sdg13: 65 },
        { axis: 'Innovation', sdg9: sdg9, sdg12: 65, sdg13: 60 },
    ];
}

// ── Emissions by cargo type (pie) ─────────────────────────────────────────────
const CARGO_PIE = [
    { name: 'Electronics', value: 28, color: '#3b82f6' },
    { name: 'Pharmaceuticals', value: 18, color: '#8b5cf6' },
    { name: 'FMCG', value: 22, color: '#f59e0b' },
    { name: 'Automotive', value: 15, color: '#0ea5e9' },
    { name: 'Steel / Heavy', value: 17, color: '#ef4444' },
];

const clamp = (v: number) => Math.max(0, Math.min(100, v));

// ─────────────────────────────────────────────────────────────────────────────
export default function SustainabilityPage() {
    const [fleet, setFleet] = useState<FleetVehicle[]>([]);
    const [, setLoading] = useState(true);

    useEffect(() => { getFleetData().then(d => { setFleet(d); setLoading(false); }); }, []);

    const totalVehicles = fleet.length || 10;
    const baseCO2 = 320;
    const optCO2 = 210;
    const co2SavedKg = Math.round((baseCO2 - optCO2) * totalVehicles);
    const co2SavedTonnes = (co2SavedKg / 1000).toFixed(1);
    const lowRiskCount = fleet.filter(v => v.risk.level === 'Low' || v.risk.level === 'Medium').length || 7;
    const highRiskCount = fleet.filter(v => v.risk.level === 'High' || v.risk.level === 'Critical').length || 3;
    const routeEffPct = fleet.length > 0 ? Math.round((lowRiskCount / fleet.length) * 100) : 73;
    const idlingRedPct = Math.max(0, Math.round(100 - (highRiskCount / totalVehicles) * 100));
    const wasteAvoidedPct = Math.min(98, idlingRedPct + 12);
    const totalCargoValue = fleet.reduce((a, v) => a + v.info.value, 0) || 14000000;
    const theftPreventedCr = (totalCargoValue * 0.02 / 10000000).toFixed(2);

    const sdg9Score = clamp(Math.round(99 * 0.4 + routeEffPct * 0.35 + 91 * 0.25));
    const sdg12Score = clamp(Math.round(wasteAvoidedPct * 0.6 + idlingRedPct * 0.4));
    const sdg13Score = clamp(Math.round(routeEffPct * 0.5 + idlingRedPct * 0.3 + 20));

    const co2Trend = buildCO2Trend(baseCO2, optCO2, totalVehicles);
    const truckEmissions = buildTruckEmissions(fleet);
    const radarData = buildRadar(sdg9Score, sdg12Score, sdg13Score);

    return (
        <div className={styles.page}>
            <div className={styles.glow1} /><div className={styles.glow2} /><div className={styles.glow3} />

            {/* ── HERO ─────────────────────────────────────────────────────── */}
            <motion.section className={styles.hero} initial="hidden" animate="show" variants={stagger}>
                <motion.div variants={fadeUp} className={styles.heroBadge}>
                    <Leaf size={14} />
                    <span>UN Sustainable Development Goals · 2030 Agenda</span>
                </motion.div>
                <motion.h1 variants={fadeUp} className={styles.heroTitle}>
                    Building a <span className={styles.green}>Greener</span>,{' '}
                    <span className={styles.blue}>Smarter</span> Supply Chain
                </motion.h1>
                <motion.p variants={fadeUp} className={styles.heroSub}>
                    RAKSHAK AI directly advances <strong>SDG 9</strong>, <strong>SDG 12</strong>, and <strong>SDG 13</strong> —
                    AI-optimised routing, real-time emissions tracking, theft prevention, and resilient infrastructure
                    for India&apos;s logistics network.
                </motion.p>
                <motion.div variants={fadeUp} className={styles.heroSDGs}>
                    <SDGBadge number="9" color="#F36E26" title="Industry, Innovation & Infrastructure" />
                    <SDGBadge number="12" color="#BF8B2E" title="Responsible Consumption & Production" />
                    <SDGBadge number="13" color="#3F7E44" title="Climate Action" />
                </motion.div>
                <motion.div variants={fadeUp} className={styles.heroStats}>
                    {[
                        { val: co2SavedTonnes, suffix: ' t', label: 'CO₂ Saved Today', dec: 1 },
                        { val: routeEffPct, suffix: '%', label: 'Route Efficiency', dec: 0 },
                        { val: idlingRedPct, suffix: '%', label: 'Fuel Waste Reduced', dec: 0 },
                        { val: sdg13Score, suffix: '%', label: 'SDG 13 Score', dec: 0 },
                    ].map((s, i) => (
                        <div key={i} className={styles.heroStatItem}>
                            <strong><AnimatedNumber value={parseFloat(String(s.val))} suffix={s.suffix} decimals={s.dec} /></strong>
                            <span>{s.label}</span>
                            {i < 3 && <div className={styles.heroStatDiv} />}
                        </div>
                    ))}
                </motion.div>
            </motion.section>

            {/* ── LIVE KPI GRID ─────────────────────────────────────────────── */}
            <section className={styles.section}>
                <motion.div className={styles.sectionHeader} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
                    <h2>Live Sustainability Metrics</h2>
                    <p>Computed in real-time from {totalVehicles} active consignments.</p>
                </motion.div>
                <motion.div className={styles.statsGrid} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
                    <StatCard icon={Wind} label="CO₂ Emissions Avoided" value={`${co2SavedKg} kg`} sub={`≈ ${co2SavedTonnes} t vs. unoptimised routing`} color="#10b981" sdg="SDG 13" />
                    <StatCard icon={Zap} label="Fuel Efficiency Gain" value={`${idlingRedPct}%`} sub="Less idle fuel via predictive rerouting" color="#f59e0b" sdg="SDG 13" />
                    <StatCard icon={Recycle} label="Cargo Waste Prevented" value={`${wasteAvoidedPct}%`} sub="Spoilage avoided for pharma & FMCG" color="#8b5cf6" sdg="SDG 12" />
                    <StatCard icon={ShieldCheck} label="Platform Uptime" value="99%" sub="Resilient AI logistics backbone" color="#0ea5e9" sdg="SDG 9" />
                    <StatCard icon={Shield} label="Theft Loss Prevented" value={`₹${theftPreventedCr}Cr`} sub="Economic waste eliminated" color="#ef4444" sdg="SDG 12" />
                    <StatCard icon={Sprout} label="Green Route Adoption" value={`${routeEffPct}%`} sub="AI-optimised low-emission corridors" color="#16a34a" sdg="SDG 13" />
                </motion.div>
            </section>

            {/* ── CO₂ TREND AREA CHART ─────────────────────────────────────── */}
            <section className={styles.section}>
                <motion.div className={styles.chartCard} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}>
                    <div className={styles.chartCardHeader}>
                        <div>
                            <div className={styles.chartBadge} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>SDG 13 · Climate Action</div>
                            <h3>CO₂ Emissions — Actual vs Baseline (kg/day)</h3>
                            <p>Fleet-wide daily emissions comparison. Green area = carbon savings achieved by AI routing.</p>
                        </div>
                        <div className={styles.chartKPIs}>
                            <div className={styles.chartKPI}>
                                <strong style={{ color: '#10b981' }}>{co2SavedKg} kg</strong>
                                <span>Saved Today</span>
                            </div>
                            <div className={styles.chartKPI}>
                                <strong style={{ color: '#f59e0b' }}>{Math.round(co2SavedKg * 365 / 1000)} t</strong>
                                <span>Annual Projection</span>
                            </div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={co2Trend} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradSaved" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
                            <Tooltip content={<ChartTip unit=" kg" />} />
                            <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{v}</span>} iconSize={8} />
                            <Area type="monotone" dataKey="baseline" name="Baseline (Unoptimised)" stroke="#ef4444" strokeWidth={2} fill="url(#gradBaseline)" strokeDasharray="5 3" />
                            <Area type="monotone" dataKey="actual" name="Actual (AI-Optimised)" stroke="#10b981" strokeWidth={2.5} fill="url(#gradActual)" />
                            <Area type="monotone" dataKey="saved" name="CO₂ Saved" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gradSaved)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>
            </section>

            {/* ── CHARTS ROW: PER-TRUCK + PIE ───────────────────────────────── */}
            <section className={styles.section}>
                <div className={styles.chartsRow}>
                    {/* Per-truck ComposedChart */}
                    <motion.div className={`${styles.chartCard} ${styles.chartCardStretch}`} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}>
                        <div className={styles.chartCardHeader}>
                            <div>
                                <div className={styles.chartBadge} style={{ background: 'rgba(63,126,68,0.12)', color: '#3F7E44' }}>Per-Unit Emissions</div>
                                <h3>Baseline vs Actual CO₂ per Truck (kg)</h3>
                                <p>Line = target. Bars = actual. Δ = carbon saved per vehicle.</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={truckEmissions} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="savedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                                <XAxis dataKey="id" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
                                <Tooltip content={<ChartTip unit=" kg" />} />
                                <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{v}</span>} iconSize={8} />
                                <Bar dataKey="actual" name="Actual CO₂" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                                <Bar dataKey="saved" name="CO₂ Saved" fill="url(#savedGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                                <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5, fill: '#ef4444', stroke: 'white', strokeWidth: 2 }} strokeDasharray="5 3" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </motion.div>

                    {/* Emissions by cargo type — Pie */}
                    <motion.div className={styles.chartCard} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}>
                        <div className={styles.chartCardHeader}>
                            <div>
                                <div className={styles.chartBadge} style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}>SDG 12 · Responsible Production</div>
                                <h3>Emissions Share by Cargo Type</h3>
                                <p>Distribution of fleet CO₂ output across cargo categories.</p>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <defs>
                                    {CARGO_PIE.map((c, i) => (
                                        <radialGradient key={i} id={`pie_${i}`} cx="50%" cy="50%" r="50%">
                                            <stop offset="0%" stopColor={c.color} stopOpacity={1} />
                                            <stop offset="100%" stopColor={c.color} stopOpacity={0.7} />
                                        </radialGradient>
                                    ))}
                                </defs>
                                <Pie
                                    data={CARGO_PIE} cx="50%" cy="48%"
                                    innerRadius={65} outerRadius={100}
                                    paddingAngle={3} dataKey="value"
                                    strokeWidth={2} stroke="rgba(255,255,255,0.6)"
                                >
                                    {CARGO_PIE.map((entry, i) => (
                                        <Cell key={i} fill={`url(#pie_${i})`} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTip unit="%" />} />
                                <Legend
                                    formatter={(v) => <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{v}</span>}
                                    iconSize={9} iconType="circle"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </motion.div>
                </div>
            </section>

            {/* ── SDG RADAR + SCORES ────────────────────────────────────────── */}
            <section className={styles.section}>
                <motion.div className={styles.chartCard} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}>
                    <div className={styles.chartCardHeader}>
                        <div>
                            <div className={styles.chartBadge} style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }}>SDG 9 · 12 · 13 Multi-Axis</div>
                            <h3>SDG Performance Radar</h3>
                            <p>RAKSHAK AI&apos;s contribution across 6 key sustainability dimensions for each SDG.</p>
                        </div>
                        <div className={styles.sdgScorePills}>
                            {[
                                { n: 9, score: sdg9Score, color: '#F36E26' },
                                { n: 12, score: sdg12Score, color: '#BF8B2E' },
                                { n: 13, score: sdg13Score, color: '#3F7E44' },
                            ].map(({ n, score, color }) => (
                                <div key={n} className={styles.sdgScorePill} style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
                                    <span style={{ color, fontWeight: 900, fontSize: '1.3rem' }}>{score}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700 }}>SDG {n}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={360}>
                        <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                            <defs>
                                <radialGradient id="radarGrad9" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#F36E26" stopOpacity={0.6} />
                                    <stop offset="100%" stopColor="#F36E26" stopOpacity={0.1} />
                                </radialGradient>
                                <radialGradient id="radarGrad12" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#BF8B2E" stopOpacity={0.6} />
                                    <stop offset="100%" stopColor="#BF8B2E" stopOpacity={0.1} />
                                </radialGradient>
                                <radialGradient id="radarGrad13" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#3F7E44" stopOpacity={0.6} />
                                    <stop offset="100%" stopColor="#3F7E44" stopOpacity={0.1} />
                                </radialGradient>
                            </defs>
                            <PolarGrid stroke="rgba(148,163,184,0.18)" gridType="polygon" />
                            <PolarAngleAxis dataKey="axis" tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickCount={4} />
                            <Radar name="SDG 9" dataKey="sdg9" stroke="#F36E26" fill="#F36E26" fillOpacity={0.2} strokeWidth={2.5} dot={{ r: 4, fill: '#F36E26', stroke: 'white', strokeWidth: 2 }} />
                            <Radar name="SDG 12" dataKey="sdg12" stroke="#BF8B2E" fill="#BF8B2E" fillOpacity={0.2} strokeWidth={2.5} dot={{ r: 4, fill: '#BF8B2E', stroke: 'white', strokeWidth: 2 }} />
                            <Radar name="SDG 13" dataKey="sdg13" stroke="#3F7E44" fill="#3F7E44" fillOpacity={0.2} strokeWidth={2.5} dot={{ r: 4, fill: '#3F7E44', stroke: 'white', strokeWidth: 2 }} />
                            <Tooltip content={<ChartTip />} />
                            <Legend formatter={(v) => <span style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>{v}</span>} iconSize={10} />
                        </RadarChart>
                    </ResponsiveContainer>
                </motion.div>
            </section>

            {/* ── SAVINGS LEADERBOARD (horizontal bars) ───────────────────── */}
            <section className={styles.section}>
                <motion.div className={styles.chartCard} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}>
                    <div className={styles.chartCardHeader}>
                        <div>
                            <div className={styles.chartBadge} style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>SDG 13 · Vehicle Ranking</div>
                            <h3>Carbon Savings Leaderboard — By Vehicle</h3>
                            <p>Ranked by kg CO₂ saved vs. unoptimised baseline. Low-risk trucks top the chart.</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={[...truckEmissions].sort((a, b) => b.saved - a.saved)} layout="vertical" margin={{ top: 4, right: 48, left: 12, bottom: 4 }}>
                            <defs>
                                <linearGradient id="hBarGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.85} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" domain={[0, 160]} />
                            <YAxis type="category" dataKey="id" tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} width={60} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip unit=" kg CO₂" />} />
                            <ReferenceLine x={110} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: 'Avg', fill: '#f59e0b', fontSize: 10, fontWeight: 700 }} />
                            <Bar dataKey="saved" name="CO₂ Saved" fill="url(#hBarGrad)" radius={[0, 8, 8, 0]} barSize={22} />
                        </BarChart>
                    </ResponsiveContainer>
                </motion.div>
            </section>

            {/* ── SDG OVERVIEW CARDS ────────────────────────────────────────── */}
            <section className={styles.section}>
                <motion.div className={styles.sectionHeader} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
                    <h2>SDG Alignment Overview</h2>
                    <p>Your fleet&apos;s aggregate contribution to the UN 2030 Agenda.</p>
                </motion.div>
                <motion.div className={styles.overviewGrid} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={stagger}>
                    {[
                        {
                            number: '9', color: '#F36E26', title: 'Industry, Innovation & Infrastructure',
                            score: sdg9Score, icon: Cpu,
                            points: ['99% AI uptime SLA', '5 active AI agents', 'Multi-tenant access', '12K+ daily AI queries'],
                        },
                        {
                            number: '12', color: '#BF8B2E', title: 'Responsible Consumption & Production',
                            score: sdg12Score, icon: Recycle,
                            points: [`${wasteAvoidedPct}% spoilage avoided`, `₹${theftPreventedCr}Cr loss prevented`, `${idlingRedPct}% idle reduced`, 'XAI chain-of-custody'],
                        },
                        {
                            number: '13', color: '#3F7E44', title: 'Climate Action',
                            score: sdg13Score, icon: Leaf,
                            points: [`${co2SavedKg} kg CO₂ saved`, `${routeEffPct}% green routes`, `${idlingRedPct}% less idling`, `${Math.round(co2SavedKg * 365 / 1000)} t/yr projection`],
                        },
                    ].map(({ number, color, title, score, icon: Icon, points }) => (
                        <motion.div key={number} variants={scaleIn} className={styles.overviewCard} style={{ borderTop: `4px solid ${color}` }}>
                            <div className={styles.overviewTop}>
                                <div className={styles.overviewIcon} style={{ background: `${color}15`, color }}>
                                    <Icon size={26} />
                                </div>
                                <div>
                                    <div className={styles.overviewSDGNum} style={{ color }}>SDG {number}</div>
                                    <div className={styles.overviewSDGTitle}>{title}</div>
                                </div>
                            </div>
                            {/* Mini arc progress */}
                            <svg viewBox="0 0 200 110" style={{ width: '100%', maxWidth: 200, margin: '0 auto', display: 'block' }}>
                                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="12" strokeLinecap="round" />
                                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
                                    strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                                    style={{ transition: 'stroke-dasharray 1.5s ease', filter: `drop-shadow(0 0 6px ${color}80)` }}
                                />
                                <text x="100" y="90" textAnchor="middle" fill={color} fontSize="28" fontWeight="900">{score}</text>
                                <text x="100" y="108" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">/ 100</text>
                            </svg>
                            <ul className={styles.overviewPoints}>
                                {points.map((p, i) => (
                                    <li key={i}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            <motion.section className={styles.cta} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
                <div className={styles.ctaInner}>
                    <Sprout size={48} style={{ color: '#3F7E44', filter: 'drop-shadow(0 8px 16px rgba(63,126,68,0.3))' }} />
                    <h2>Every optimised route is a step toward 2030.</h2>
                    <p>Join fleets using RAKSHAK AI to simultaneously protect cargo, reduce emissions, and build a resilient, responsible supply chain.</p>
                    <div className={styles.ctaBtns}>
                        <Link href="/dashboard" className={styles.ctaPrimary}>Open Live Dashboard <ArrowRight size={18} /></Link>
                        <Link href="/risk-analysis" className={styles.ctaSecondary}>Run Route Analysis</Link>
                    </div>
                </div>
            </motion.section>
        </div>
    );
}
