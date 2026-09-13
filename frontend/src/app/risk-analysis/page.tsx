'use client';

import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import styles from './page.module.css';
import { Shield, BrainCircuit, Monitor, HardHat, Shirt, Pill, Car, Box, History, MapPin } from 'lucide-react';
import { ROUTE_OPTIONS, CARGO_TYPE_OPTIONS, computeRiskReport, RiskReportResult } from '@/services/riskUtils';
import { AgentRadar, RiskTimeline } from '@/components/charts/ChartComponents';
import AuthGuard from '@/components/AuthGuard';
import dynamic from 'next/dynamic';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), { ssr: false });

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
};

const CARGO_ICONS: Record<string, React.ElementType> = {
    Electronics: Monitor, Pharmaceuticals: Pill, Automotive: Car,
    Textiles: Shirt, Steel: HardHat, Cement: Box,
};

function riskColor(score: number) {
    return score >= 75 ? '#ef4444' : score >= 55 ? '#f59e0b' : score >= 35 ? '#3b82f6' : '#10b981';
}

// R5: Prediction history entry
interface HistoryEntry { params: string; result: RiskReportResult; at: string; }

export default function RiskAnalysis() {
    const [cargoType, setCargoType] = useState('Electronics');
    const [route, setRoute] = useState(ROUTE_OPTIONS[0].label); // R3: shared constant
    const [time, setTime] = useState<'Day' | 'Night'>('Night');
    const [value, setValue] = useState('1500000');
    const [driverExp, setDriverExp] = useState('3');
    const [isPredicting, setIsPredicting] = useState(false);
    const [result, setResult] = useState<RiskReportResult | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]); // R5

    // Animated Gauge State
    const animatedScore = useSpring(0, { stiffness: 60, damping: 15 });
    const animatedDasharray = useTransform(animatedScore, (latest) => `${(latest / 100) * 157.08} 157.08`);
    const displayScore = useTransform(animatedScore, (latest) => Math.round(latest));

    // Reset gauge when result changes
    useEffect(() => {
        if (result) animatedScore.set(result.score);
        else animatedScore.set(0);
    }, [result, animatedScore]);

    // R1: No fake setTimeout — instant computation via shared utility (R2)
    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPredicting(true);

        // R6: Try backend first, fall back to client-side
        let computed: RiskReportResult | null = null;
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/agents/risk-fusion/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    route, cargo_type: cargoType, travel_time: time,
                    cargo_value: parseFloat(value), distance_km: ROUTE_OPTIONS.find(r => r.label === route)?.distanceKm ?? 500,
                    driver_experience: parseFloat(driverExp)
                }),
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                const data = await res.json();
                const routeData = ROUTE_OPTIONS.find(r => r.label === route);
                computed = {
                    score: data.risk_score ?? data.score, level: data.risk_level ?? data.level,
                    breakdown: data.breakdown ?? [],
                    reasons: data.reasons ?? [],
                    dangerZones: data.danger_zones ?? routeData?.dangerZones ?? [],
                    routePath: data.route_path ?? routeData?.path ?? [],
                    dangerZoneMarks: data.danger_zone_marks ?? routeData?.dangerZoneMarks ?? [],
                    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                };
            }
        } catch { /* backend unreachable — use client-side */ }

        if (!computed) {
            computed = computeRiskReport({
                route, cargoType, travelTime: time,
                cargoValue: parseFloat(value) || 0,
                distanceKm: ROUTE_OPTIONS.find(r => r.label === route)?.distanceKm ?? 500,
                driverExperienceYrs: parseFloat(driverExp) || 1,
            });
        }

        setResult(computed);
        // R5: add to history
        setHistory(prev => [
            { params: `${route} | ${cargoType} | ${time}`, result: computed!, at: computed!.timestamp },
            ...prev.slice(0, 4) // keep last 5
        ]);
        setIsPredicting(false);
    };

    return (
        <AuthGuard>
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className={styles.container}>
            <motion.div variants={fadeUp} className={styles.header}>
                <div>
                    <h1 className={styles.title}>Risk Analysis Engine</h1>
                    <p className={styles.subtitle}>AI-powered pre-trip risk assessment</p>
                </div>
            </motion.div>

            <div className={styles.mainGrid}>
                {/* Input Form */}
                <motion.section variants={fadeUp} className={styles.formSection}>
                    <form onSubmit={handlePredict} className={styles.riskForm}>
                        {/* Route Selection — R3: shared ROUTE_OPTIONS */}
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Route</label>
                            <select
                                className={styles.select}
                                value={route}
                                onChange={e => setRoute(e.target.value)}
                                aria-label="Select transport route"
                            >
                                {ROUTE_OPTIONS.map(r => (
                                    <option key={r.label} value={r.label}>{r.label} (~{r.distanceKm} km)</option>
                                ))}
                            </select>
                        </div>

                        {/* Cargo Type — R7: responsive grid */}
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Cargo Type</label>
                            <div className={styles.cargoGrid}>
                                {CARGO_TYPE_OPTIONS.map(cargo => {
                                    const Icon = CARGO_ICONS[cargo.id] ?? Box;
                                    return (
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            key={cargo.id}
                                            type="button"
                                            className={`${styles.cargoBtn} ${cargoType === cargo.id ? styles.cargoBtnActive : ''}`}
                                            onClick={() => setCargoType(cargo.id)}
                                            aria-label={`Select ${cargo.label} cargo`}
                                            aria-pressed={cargoType === cargo.id}
                                        >
                                            <Icon size={20} />
                                            <span>{cargo.label}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time of Travel */}
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Time of Travel</label>
                            <div className={styles.timeGroup}>
                                {(['Day', 'Night'] as const).map(t => (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        key={t}
                                        type="button"
                                        className={`${styles.timeBtn} ${time === t ? styles.timeBtnActive : ''}`}
                                        onClick={() => setTime(t)}
                                        aria-label={`${t} travel`}
                                        aria-pressed={time === t}
                                    >
                                        {t === 'Day' ? '☀️' : '🌙'} {t}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Cargo Value */}
                        <div className={styles.inputRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Cargo Value (₹)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    min="0"
                                    aria-label="Cargo value in rupees"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Driver Experience (years)</label>
                                <input
                                    type="number"
                                    className={styles.input}
                                    value={driverExp}
                                    onChange={e => setDriverExp(e.target.value)}
                                    min="0" max="40"
                                    aria-label="Driver experience in years"
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={isPredicting ? {} : { scale: 1.01, y: -2 }}
                            whileTap={isPredicting ? {} : { scale: 0.99 }}
                            type="submit"
                            className={styles.predictBtn}
                            disabled={isPredicting}
                            aria-label="Run risk prediction"
                        >
                            <Shield size={18} />
                            {isPredicting ? 'Analyzing...' : 'Predict Risk Score'}
                        </motion.button>
                    </form>
                </motion.section>

                {/* Results */}
                <motion.section variants={fadeUp} className={styles.resultSection}>
                    {result ? (<motion.div variants={staggerContainer} initial="hidden" animate="show" key={result.timestamp}>
                        {/* Gauge — R4: corrected arc circumference π*r = π*15 ≈ 47.12 */}
                        <motion.div variants={fadeUp} className={styles.gaugeWrapper}>
                            <svg viewBox="0 0 120 70" className={styles.gaugeSvg}>
                                <path d="M10 62 A 50 50 0 0 1 110 62" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                                <motion.path
                                    d="M10 62 A 50 50 0 0 1 110 62" fill="none"
                                    stroke={riskColor(result.score)} strokeWidth="10" strokeLinecap="round"
                                    style={{ strokeDasharray: animatedDasharray, filter: `drop-shadow(0 0 4px ${riskColor(result.score)})` }}
                                />
                                <motion.text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="900" fill={riskColor(result.score)}>{displayScore}</motion.text>
                                <text x="60" y="68" textAnchor="middle" fontSize="8" fill="#94a3b8">{result.level.toUpperCase()} RISK</text>
                            </svg>
                        </motion.div>

                        {/* Breakdown bars */}
                        <motion.div variants={fadeUp} className={styles.breakdownSection}>
                            <h3 className={styles.breakdownTitle}>Risk Factor Breakdown</h3>
                            {result.breakdown.map(item => (
                                <div key={item.label} className={styles.breakdownItem}>
                                    <div className={styles.breakdownLabelRow}>
                                        <span>{item.label}</span>
                                        <span style={{ color: riskColor(item.score), fontWeight: 800 }}>{item.score}/100</span>
                                    </div>
                                    <div className={styles.breakdownBar}>
                                        <div className={styles.breakdownFill}
                                            style={{ width: `${item.score}%`, background: riskColor(item.score), transition: 'width 0.8s ease' }}
                                        />
                                        <span className={styles.weightLabel}>×{item.weight}%</span>
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* Risk Reasons */}
                        {result.reasons.length > 0 && (
                            <motion.div variants={fadeUp} className={styles.reasonsSection}>
                                <h3 className={styles.breakdownTitle}>AI Risk Reasons</h3>
                                {result.reasons.map((r, i) => (
                                    <div key={i} className={styles.reasonItem}>
                                        <span style={{ color: riskColor(result.score) }}>⚠</span> {r}
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Danger Zones */}
                        {result.dangerZones.length > 0 && (
                            <motion.div variants={fadeUp} className={styles.dangerZones}>
                                <h3 className={styles.breakdownTitle} style={{ color: '#ef4444' }}>⚠ Danger Zones on Route</h3>
                                {result.dangerZones.map((z, i) => (
                                    <div key={i} className={styles.dangerZoneItem}>{z}</div>
                                ))}
                            </motion.div>
                        )}

                        {/* Map Visualization */}
                        {result.routePath && result.routePath.length > 0 && (
                            <motion.div variants={fadeUp} style={{ marginTop: '1.5rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#1e293b' }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f8fafc' }}>
                                    <MapPin size={16} style={{ color: '#3b82f6' }} /> Route Map
                                </div>
                                <GoogleMapComponent
                                    height="280px"
                                    center={result.routePath[Math.floor(result.routePath.length / 2)]}
                                    zoom={5}
                                    polyline={result.routePath}
                                    dangerZones={result.dangerZoneMarks}
                                />
                            </motion.div>
                        )}

                        <motion.p variants={fadeUp} className={styles.reportTimestamp}>Generated: {result.timestamp}</motion.p>

                        {/* ── AGENT RADAR CHART ──────────────────────────── */}
                        <motion.div variants={fadeUp} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '1rem', marginTop: '0.5rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <AgentRadar
                                data={result.breakdown.map(b => ({ subject: b.label, score: b.score }))}
                                title="Risk Factor Radar"
                                size={220}
                            />
                        </motion.div>
                    </motion.div>) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.emptyResult}>
                            <BrainCircuit size={48} style={{ color: '#cbd5e1' }} />
                            <p>Fill in the parameters and run the prediction engine.</p>
                        </motion.div>
                    )}
                </motion.section>
            </div>

            {/* R5: Prediction History */}
            {history.length > 0 && (
                <motion.section variants={fadeUp} className={styles.historySection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <History size={18} style={{ color: '#64748b' }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155' }}>Prediction History</h3>
                    </div>

                    {history.length >= 2 && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <RiskTimeline
                                data={[...history].reverse().map((e, i) => ({ time: `Run ${i + 1}`, risk: e.result.score }))}
                                title="Score Trend Across Predictions"
                                height={140}
                                color={riskColor(history[0].result.score)}
                            />
                        </div>
                    )}

                    <div className={styles.historyGrid}>
                        {history.map((entry, i) => (
                            <motion.div variants={fadeUp} key={i} className={styles.historyCard}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: riskColor(entry.result.score) }}>
                                        {entry.result.score}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>{entry.at}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{entry.params}</div>
                                <div style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 800, color: riskColor(entry.result.score) }}>
                                    {entry.result.level.toUpperCase()} RISK
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>
            )}
        </motion.div>
        </AuthGuard>
    );
}
