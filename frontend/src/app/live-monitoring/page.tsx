'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';
import {
    FileText, MapPin, Package, Clock, Banknote, Shield, AlertTriangle,
    CheckCircle2, TrendingUp, ChevronRight, Printer
} from 'lucide-react';
import { ROUTE_OPTIONS, CARGO_TYPE_OPTIONS, computeRiskReport, RiskReportResult } from '@/services/riskUtils'; // J2: shared constants
import { AgentRadar } from '@/components/charts/ChartComponents';
import AuthGuard from '@/components/AuthGuard';
import dynamic from 'next/dynamic';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), { ssr: false });

// Animation Variants
const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
};


export default function JourneyReport() {
    const [route, setRoute] = useState(ROUTE_OPTIONS[0].label); // J2
    const [cargo, setCargo] = useState(CARGO_TYPE_OPTIONS[0].id);
    const [travelTime, setTravelTime] = useState<'Day' | 'Night'>('Night');
    const [cargoValue, setCargoValue] = useState('1500000');
    const [driverExp, setDriverExp] = useState('3');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [report, setReport] = useState<RiskReportResult | null>(null);
    const [formError, setFormError] = useState(''); // J5: validation

    // J6: auto-compute distance from selected route
    const selectedRoute = ROUTE_OPTIONS.find(r => r.label === route) || ROUTE_OPTIONS[0];
    const distanceKm = selectedRoute.distanceKm;

    const LOADING_STEPS = [
        'Analyzing route risk profiles...',
        'Querying historical theft database...',
        'Running behavioral pattern engine...',
        'Generating explainability report...',
        'Report complete.',
    ];

    // J5: validation
    const validate = () => {
        if (!route) return 'Please select a route.';
        if (!cargo) return 'Please select a cargo type.';
        const v = parseFloat(cargoValue);
        if (isNaN(v) || v < 0) return 'Cargo value must be a valid positive number.';
        const d = parseFloat(driverExp);
        if (isNaN(d) || d < 0 || d > 50) return 'Driver experience must be between 0 and 50 years.';
        return '';
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) { setFormError(err); return; }
        setFormError('');
        setIsGenerating(true);
        setReport(null);

        // Animated loading steps — J9: use step delays with fill-mode on CSS
        for (let i = 0; i < LOADING_STEPS.length; i++) {
            setLoadingStep(i + 1);
            await new Promise(r => setTimeout(r, 600));
        }

        const result = computeRiskReport({
            route,
            cargoType: cargo,
            travelTime,
            cargoValue: parseFloat(cargoValue) || 0,
            distanceKm,
            driverExperienceYrs: parseFloat(driverExp) || 1,
        });

        setReport(result);
        setIsGenerating(false);
        setLoadingStep(0);
    };

    // J3: Print report
    const handlePrint = () => {
        window.print();
    };

    const riskColor = (score: number) =>
        score >= 75 ? '#dc2626' : score >= 55 ? '#f59e0b' : score >= 35 ? '#3b82f6' : '#10b981';

    return (
        <AuthGuard>
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className={styles.container}>
            {/* J1: Clear breadcrumb clarifying what this page is */}
            <motion.div variants={fadeUp} className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <div className={styles.breadcrumb}>
                            <span>Dashboard</span> <ChevronRight size={14} /> <span>Journey Report</span>
                        </div>
                        <h1 className={styles.title}>Pre-Journey Risk Report</h1>
                        <p className={styles.subtitle}>
                            Generate a comprehensive AI risk assessment before dispatching a consignment.
                            {/* J6: show auto-computed distance */}
                            {route && <span className={styles.routeHint}> · Selected route: ~{distanceKm} km</span>}
                        </p>
                    </div>
                </div>
            </motion.div>

            <div className={styles.mainLayout}>
                {/* Left: Form */}
                <motion.section variants={fadeUp} className={styles.formSection}>
                    <div className={styles.sectionTitle}><FileText size={18} /> Journey Parameters</div>

                    <form onSubmit={handleGenerate} className={styles.form} noValidate>
                        {/* Route — J2: shared ROUTE_OPTIONS */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}><MapPin size={14} /> Route</label>
                            <select
                                className={styles.select}
                                value={route}
                                onChange={e => setRoute(e.target.value)}
                                aria-label="Select transport route"
                            >
                                {ROUTE_OPTIONS.map(r => (
                                    <option key={r.label} value={r.label}>
                                        {r.label} (~{r.distanceKm} km)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Cargo Type — J2: shared CARGO_TYPE_OPTIONS */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}><Package size={14} /> Cargo Type</label>
                            <select
                                className={styles.select}
                                value={cargo}
                                onChange={e => setCargo(e.target.value)}
                                aria-label="Select cargo type"
                            >
                                {CARGO_TYPE_OPTIONS.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Time */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}><Clock size={14} /> Time of Travel</label>
                            <div className={styles.timeGroup}>
                                {(['Day', 'Night'] as const).map(t => (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        key={t} type="button"
                                        className={`${styles.timeBtn} ${travelTime === t ? styles.timeBtnActive : ''}`}
                                        onClick={() => setTravelTime(t)}
                                        aria-label={`${t} travel`}
                                        aria-pressed={travelTime === t}
                                    >
                                        {t === 'Day' ? '☀️' : '🌙'} {t}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        {/* Cargo Value */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}><Banknote size={14} /> Cargo Value (₹)</label>
                            <input
                                type="number" min="0"
                                className={styles.input}
                                value={cargoValue}
                                onChange={e => setCargoValue(e.target.value)}
                                aria-label="Cargo value in rupees"
                            />
                        </div>

                        {/* Driver Experience */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>👤 Driver Experience (years)</label>
                            <input
                                type="number" min="0" max="50"
                                className={styles.input}
                                value={driverExp}
                                onChange={e => setDriverExp(e.target.value)}
                                aria-label="Driver experience in years"
                            />
                        </div>

                        {/* J6: Distance shown as read-only from route */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}><MapPin size={14} /> Estimated Distance</label>
                            <div className={styles.readonlyField}>{distanceKm} km (auto-computed from route)</div>
                        </div>

                        {/* J5: Validation error */}
                        {formError && (
                            <div className={styles.formError}>
                                <AlertTriangle size={14} /> {formError}
                            </div>
                        )}

                        <motion.button
                            whileHover={isGenerating ? {} : { scale: 1.02, y: -2 }}
                            whileTap={isGenerating ? {} : { scale: 0.98 }}
                            type="submit"
                            className={styles.generateBtn}
                            disabled={isGenerating}
                            aria-label="Generate pre-journey risk report"
                        >
                            <Shield size={18} />
                            {isGenerating ? 'Generating...' : 'Generate Risk Report'}
                        </motion.button>
                    </form>
                </motion.section>

                {/* Right: Loading / Report */}
                <motion.section variants={fadeUp} className={styles.reportSection}>
                    <AnimatePresence mode="wait">
                        {isGenerating && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={styles.loadingContainer}
                            >
                                <div className={styles.radialLoader}>
                                    <Shield size={20} style={{ color: '#0284c7' }} className={styles.loaderIcon} />
                                </div>
                                <h3>Generating Report</h3>
                                {LOADING_STEPS.map((step, i) => (
                                    <div
                                        key={i}
                                        className={`${styles.loadingStep} ${loadingStep > i ? styles.stepDone : loadingStep === i ? styles.stepActive : ''}`}
                                        style={{ animationDelay: `${i * 0.15}s`, animationFillMode: 'both' }} // J9: correct fill-mode
                                    >
                                        {loadingStep > i ? '✓' : loadingStep === i + 1 ? '⚡' : '○'} {step}
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {!isGenerating && !report && (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={styles.emptyReport}
                            >
                                <FileText size={56} style={{ color: '#cbd5e1' }} />
                                <h3>Report will appear here</h3>
                                <p>Configure journey parameters and click Generate.</p>
                            </motion.div>
                        )}

                        {!isGenerating && report && (
                            <motion.div
                                key="report"
                                variants={staggerContainer}
                                initial="hidden"
                                animate="show"
                                className={styles.report}
                            >
                                {/* J7: Report timestamp */}
                                <motion.div variants={fadeUp} className={styles.reportHeader}>
                                    <div>
                                        <div className={styles.reportTimestamp}>Generated: {report.timestamp}</div>
                                        <h2 className={styles.reportTitle}>Risk Assessment Report</h2>
                                        <div className={styles.reportMeta}>{route} · {cargo} · {travelTime}</div>
                                    </div>
                                    {/* J3: Print button */}
                                    <button
                                        onClick={handlePrint}
                                        className={styles.printBtn}
                                        aria-label="Print or download report"
                                    >
                                        <Printer size={16} /> Print / Save
                                    </button>
                                </motion.div>

                                {/* Risk Score */}
                                <div className={styles.scoreRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                    <div className={styles.scoreCard} style={{ borderLeft: `4px solid ${riskColor(report.score)}`, height: '100%', margin: 0 }}>
                                        <div>
                                            <div className={styles.riskLevelLabel} style={{ color: riskColor(report.score) }}>
                                                {report.level.toUpperCase()} RISK
                                            </div>
                                            <div className={styles.riskScoreNumber} style={{ color: riskColor(report.score) }}>
                                                {report.score}<span style={{ fontSize: '1rem', fontWeight: 600 }}>/100</span>
                                            </div>
                                        </div>
                                        <div className={styles.scoreBarWrap}>
                                            <div className={styles.scoreBarBg}>
                                                <div className={styles.scoreBarFill}
                                                    style={{ width: `${report.score}%`, background: `linear-gradient(90deg, ${riskColor(report.score)}80, ${riskColor(report.score)})` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Risk Factor Radar */}
                                    <div style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        borderRadius: 12,
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center'
                                    }}>
                                        <AgentRadar
                                            title="Risk Analysis Matrix"
                                            size={200}
                                            data={report.breakdown.map(item => ({
                                                subject: item.label,
                                                score: item.score
                                            }))}
                                        />
                                    </div>
                                </div>

                                {/* Breakdown */}
                                <motion.div variants={fadeUp} className={styles.breakdownSection}>
                                    <h3 className={styles.sectionHead}><TrendingUp size={16} /> Risk Breakdown</h3>
                                    {report.breakdown.map(item => (
                                        <div key={item.label} className={styles.breakdownRow}>
                                            <span className={styles.breakdownLabel}>{item.label}</span>
                                            <div className={styles.breakdownBar}>
                                                <div className={styles.breakdownFill}
                                                    style={{ width: `${item.score}%`, background: riskColor(item.score) }}
                                                />
                                            </div>
                                            <span className={styles.breakdownScore} style={{ color: riskColor(item.score) }}>{item.score}</span>
                                            <span className={styles.weightTag}>×{item.weight}%</span>
                                        </div>
                                    ))}
                                </motion.div>

                                {/* J4: Personalised recommendations */}
                                {report.reasons.length > 0 && (
                                    <motion.div variants={fadeUp} className={styles.recSection}>
                                        <h3 className={styles.sectionHead}><Shield size={16} /> AI Recommendations</h3>
                                        {report.reasons.map((r, i) => (
                                            <div key={i} className={styles.recItem}>
                                                <ChevronRight size={13} style={{ color: riskColor(report.score), flexShrink: 0 }} />
                                                {r}
                                            </div>
                                        ))}
                                    </motion.div>
                                )}

                                {/* J8: Danger zones with mini visual indicator */}
                                {report.dangerZones.length > 0 && (
                                    <motion.div variants={fadeUp} className={styles.dangerSection}>
                                        <h3 className={styles.sectionHead} style={{ color: '#ef4444' }}>
                                            <AlertTriangle size={16} /> Danger Zones on Route
                                        </h3>
                                        {report.dangerZones.map((z, i) => (
                                            <div key={i} className={styles.dangerZoneItem}>
                                                {/* J8: mini inline SVG threat indicator */}
                                                <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                                                    <circle cx="6" cy="6" r="5" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1.5" />
                                                    <circle cx="6" cy="6" r="2" fill="#ef4444" />
                                                </svg>
                                                {z}
                                            </div>
                                        ))}
                                    </motion.div>
                                )}

                                {/* Map Visualization */}
                                {report.routePath && report.routePath.length > 0 && (
                                    <motion.div variants={fadeUp} className={styles.mapSection} style={{ marginTop: '1.5rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#1e293b' }}>
                                        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f8fafc' }}>
                                            <MapPin size={16} style={{ color: '#3b82f6' }} /> Route Map
                                        </div>
                                        <GoogleMapComponent
                                            height="320px"
                                            center={report.routePath[Math.floor(report.routePath.length / 2)]}
                                            zoom={5}
                                            polyline={report.routePath}
                                            dangerZones={report.dangerZoneMarks}
                                        />
                                    </motion.div>
                                )}

                                {report.score < 35 && (
                                    <motion.div variants={fadeUp} className={styles.allClearCard}>
                                        <CheckCircle2 size={20} /> All clear — standard precautions sufficient.
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.section>
            </div>
        </motion.div>
        </AuthGuard>
    );
}
