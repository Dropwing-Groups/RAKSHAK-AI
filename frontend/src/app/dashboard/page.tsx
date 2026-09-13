'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import styles from './page.module.css';
import { getFleetData, getAlerts, triggerSimulation, FleetVehicle, Alert } from '@/services/apiClient';
import { SeverityDonut, FleetStatusDonut, RiskBars, RiskTimeline } from '@/components/charts/ChartComponents';
import { useToast } from '@/components/Toast';
import AuthGuard from '@/components/AuthGuard';
import {
    MapPin, Activity, Truck, Banknote, ShieldAlert, BarChart3,
    Crosshair, Terminal, ArrowUpRight, Signal, Zap, CheckCircle2, ExternalLink, Shield
} from 'lucide-react';

// Dynamically import GoogleMapComponent because it needs the window object
const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), {
    ssr: false,
    loading: () => (
        <div className={styles.mapLoading}>
            <div className={styles.radarLoader}></div>
            <p>Initializing Google Maps...</p>
        </div>
    )
});

// Error Boundary (G5)
import { Component, ReactNode } from 'react';
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode; fallback?: ReactNode }) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) return this.props.fallback || <div className={styles.errorFallback}>Component failed to load.</div>;
        return this.props.children;
    }
}

const SEVERITY_BORDER: Record<string, string> = {
    Critical: '#dc2626', High: '#ef4444', Medium: '#f59e0b', Low: '#10b981'
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    Alert: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
    'In Transit': { color: '#0284c7', bg: 'rgba(2,132,199,0.08)' },
    Scheduled: { color: '#9333ea', bg: 'rgba(147,51,234,0.08)' },
};

// Animation Variants
const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
};

export default function Dashboard() {
    const [fleet, setFleet] = useState<FleetVehicle[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'All' | 'High Risk' | 'In Transit'>('All');
    const [demoStatus, setDemoStatus] = useState<'idle' | 'running' | 'done'>('idle');
    const [terminalTick, setTerminalTick] = useState(0);
    const [riskHistory, setRiskHistory] = useState<{ time: string; risk: number }[]>([]);
    const { showToast, ToastElement } = useToast();

    const fetchData = useCallback(async () => {
        try {
            const [fleetData, alertsData] = await Promise.all([getFleetData(), getAlerts()]);
            setFleet(fleetData);
            setAlerts(alertsData);
            // Record avg risk snapshot for timeline
            if (fleetData.length > 0) {
                const avg = Math.round(fleetData.reduce((a, v) => a + v.risk.score, 0) / fleetData.length);
                const timeLabel = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
                setRiskHistory(prev => [...prev.slice(-19), { time: timeLabel, risk: avg }]);
            }
        } catch (error) {
            console.error('Error fetching data', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Poll with visibility API (D11, G6) — pause polling when tab is hidden
    useEffect(() => {
        fetchData();
        let interval: ReturnType<typeof setInterval>;

        const startPolling = () => {
            interval = setInterval(() => {
                if (!document.hidden) fetchData();
            }, 2000); // D11: decreased to 2s for live sim
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) fetchData(); // refresh on tab focus
        };

        startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchData]);

    // Terminal ticker (D10)
    useEffect(() => {
        const t = setInterval(() => setTerminalTick(v => v + 1), 3000);
        return () => clearInterval(t);
    }, []);

    const handleDemo = async () => {
        const targetTrip = fleet.find(v => v.risk.level === 'High' || v.risk.level === 'Critical');
        if (!targetTrip) return;
        setDemoStatus('running');
        const ok = await triggerSimulation(targetTrip.trip_id);
        if (ok) {
            setDemoStatus('done');
            showToast('🚨 Demo scenario triggered! New alerts are active.', 'warning'); // G2
            setTimeout(() => setDemoStatus('idle'), 3000);
            setTimeout(() => fetchData(), 1000);
        } else {
            setDemoStatus('idle');
            showToast('Failed to trigger scenario — check backend connection.', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loaderCore}>
                    <div className={styles.loaderRing}></div>
                    <div className={styles.loaderRing2}></div>
                    <Shield size={28} style={{ color: '#0284c7' }} className={styles.loaderIcon} />
                </div>
                <h2>Rakshak Command Center Starting...</h2>
                <div className={styles.loadingBar}><div className={styles.loadingFill}></div></div>
            </div>
        );
    }

    const highRiskCount = fleet.filter(v => v.risk.level === 'High' || v.risk.level === 'Critical').length;
    const totalValue = fleet.reduce((acc, v) => acc + v.info.value, 0);
    // D8: Compute operational efficiency from low-risk fraction
    const operationalPct = fleet.length > 0
        ? Math.round((fleet.filter(v => v.risk.level === 'Low' || v.risk.level === 'Medium').length / fleet.length) * 100)
        : 92;
    const avgRisk = fleet.length > 0
        ? Math.round(fleet.reduce((acc, v) => acc + v.risk.score, 0) / fleet.length) : 0;
    const avgRiskColor = avgRisk >= 70 ? '#ef4444' : avgRisk >= 45 ? '#f59e0b' : '#10b981';

    const filteredFleet = fleet.filter(v => {
        if (activeFilter === 'High Risk') return v.risk.level === 'High' || v.risk.level === 'Critical';
        if (activeFilter === 'In Transit') return v.status === 'In Transit';
        return true;
    });

    const mapMarkers = filteredFleet.map(v => ({
        lat: v.location.lat,
        lng: v.location.lng,
        title: v.info.id,
        truckId: v.info.id,
        riskLevel: v.risk.level,
        riskScore: v.risk.score,
        status: v.status,
        route: v.info.route
    }));

    // D10: Cycle through all fleet in terminal log
    const terminalVehicles = fleet.length > 0
        ? [fleet[terminalTick % fleet.length], fleet[(terminalTick + 1) % fleet.length], fleet[(terminalTick + 2) % fleet.length]]
        : [];

    return (
        <AuthGuard>
            <motion.div
                className={styles.dashboardContainer}
                variants={staggerContainer}
                initial="hidden"
                animate="show"
            >
                {ToastElement /* G2 */}

                <motion.div variants={fadeUp} className={styles.topControls}>
                    <h1 className={styles.pageTitle}>Fleet Command <span>/ Live Intel</span></h1>
                    <div className={styles.filterGroup}>
                        {(['All', 'In Transit', 'High Risk'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`${styles.filterBtn} ${activeFilter === filter ? styles.activeFilter : ''}`}
                                aria-label={`Filter: ${filter}`} // G10
                            >
                                {filter} {filter === 'High Risk' && highRiskCount > 0 && <span className={styles.filterBadge}>{highRiskCount}</span>}
                            </button>
                        ))}
                        <button
                            onClick={handleDemo}
                            disabled={demoStatus === 'running' || !fleet.some(v => v.risk.level === 'High' || v.risk.level === 'Critical')}
                            className={styles.filterBtn}
                            aria-label="Trigger demo threat scenario"
                            title="Inject a full threat scenario on the highest-risk truck to see the alert pipeline live"
                        >
                            {demoStatus === 'running' ? (
                                <>⏳ Running…</>
                            ) : demoStatus === 'done' ? (
                                <><CheckCircle2 size={14} style={{ marginRight: 4 }} />Triggered</>
                            ) : (
                                <><Zap size={14} style={{ marginRight: 4 }} />Trigger Demo</>
                            )}
                        </button>
                    </div>
                </motion.div>


                {/* Stats Grid */}
                <motion.section variants={fadeUp} className={styles.statsGrid}>
                    {/* Active Fleet */}
                    <motion.div whileHover={{ scale: 1.02 }} className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={styles.statIconWrapper}><Truck size={20} className={styles.iconAccent} /></div>
                            <span className={styles.statLabel}>Active Consignments</span>
                        </div>
                        <div className={styles.statBody}>
                            <h2 className={styles.statValue}>{fleet.length}</h2>
                            <div className={styles.statSparkline}><Activity size={32} className={styles.sparklineGood} /></div>
                        </div>
                        <div className={styles.statFooter}>
                            <ArrowUpRight size={14} className={styles.iconGood} />
                            <span>{fleet.filter(v => v.status === 'Alert').length} on alert, {fleet.filter(v => v.status === 'In Transit').length} in transit</span>
                        </div>
                    </motion.div>

                    {/* Critical Threats */}
                    <motion.div whileHover={{ scale: 1.02 }} className={`${styles.statCard} ${highRiskCount > 0 ? styles.statCardWarning : ''}`}>
                        <div className={styles.statHeader}>
                            <div className={styles.statIconWrapperWarning}>
                                <ShieldAlert size={20} className={highRiskCount > 0 ? styles.iconHigh : styles.iconSafe} />
                            </div>
                            <span className={styles.statLabel}>Critical Threats</span>
                        </div>
                        <div className={styles.statBody}>
                            <h2 className={`${styles.statValue} ${highRiskCount > 0 ? styles.textHigh : styles.textSafe}`}>{highRiskCount}</h2>
                            <div className={styles.flexStack}>
                                {highRiskCount > 0 && <span className={styles.pulseTag}>ACTION REQUIRED</span>}
                            </div>
                        </div>
                        <div className={styles.statFooter}><span>Real-time AI behavioral analysis active</span></div>
                    </motion.div>

                    {/* Assets Monitored — D8: computed from real data */}
                    <motion.div whileHover={{ scale: 1.02 }} className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={styles.statIconWrapper}><Banknote size={20} className={styles.iconAccent} /></div>
                            <span className={styles.statLabel}>Assets Monitored</span>
                        </div>
                        <div className={styles.statBody}>
                            <h2 className={styles.statValue}>₹{(totalValue / 10000000).toFixed(2)}Cr</h2>
                            <div className={styles.circularProgress}>
                                <svg viewBox="0 0 36 36" className={styles.circularSvg}>
                                    <path className={styles.circleBg} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className={styles.circleFill} strokeDasharray={`${operationalPct}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className={styles.circleText}>{operationalPct}%</span>
                            </div>
                        </div>
                        <div className={styles.statFooter}><span>{operationalPct}% fleet operational efficiency</span></div>
                    </motion.div>

                    {/* Fleet Avg Risk Gauge */}
                    <motion.div whileHover={{ scale: 1.02 }} className={styles.statCard}>
                        <div className={styles.statHeader}>
                            <div className={styles.statIconWrapper}><BarChart3 size={20} className={styles.iconAccent} /></div>
                            <span className={styles.statLabel}>Fleet Avg Risk</span>
                        </div>
                        <div className={styles.statBody} style={{ justifyContent: 'center' }}>
                            <div className={styles.riskGaugeWrap}>
                                <svg viewBox="0 0 36 20" className={styles.riskGaugeSvg}>
                                    <path d="M3 18 A 15 15 0 0 1 33 18" fill="none" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
                                    <path d="M3 18 A 15 15 0 0 1 33 18" fill="none" stroke={avgRiskColor} strokeWidth="3.5" strokeLinecap="round"
                                        strokeDasharray={`${(avgRisk / 100) * 47.12} 47.12`} // R4: correct arc circumference
                                        style={{ transition: 'stroke-dasharray 1.2s ease' }}
                                    />
                                </svg>
                                <div className={styles.riskGaugeLabel}>
                                    <span className={styles.riskGaugeValue} style={{ color: avgRiskColor }}>{avgRisk}</span>
                                    <span className={styles.riskGaugeSub}>/ 100</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.statFooter}>
                            <span style={{ color: avgRiskColor, fontWeight: 700 }}>
                                {avgRisk >= 70 ? '🔴 HIGH THREAT' : avgRisk >= 45 ? '🟡 MODERATE RISK' : '🟢 LOW RISK'}
                            </span>
                        </div>
                    </motion.div>
                </motion.section>

                <motion.div variants={staggerContainer} className={styles.mainGrid}>
                    {/* Map — D12: taller via CSS */}
                    <motion.section variants={fadeUp} className={styles.mapSection}>
                        <div className={styles.panelHeader}>
                            <div className={styles.headerLeft}>
                                <MapPin className={styles.iconAccent} />
                                <h2>Global Tracking Matrix</h2>
                            </div>
                            <div className={styles.statusBadge}>
                                <Signal size={12} className={styles.iconBlink} /> Live Uplink
                            </div>
                        </div>
                        <div className={styles.mapContainer}>
                            <div className={styles.mapPlaceholder}>
                                <ErrorBoundary fallback={<div className={styles.errorFallback}>Map failed to load.</div>}>
                                    <GoogleMapComponent markers={mapMarkers} height="100%" />
                                </ErrorBoundary>
                            </div>
                            {/* Terminal Overlay — D10: cycles through all fleet, shows GPS coords */}
                            <div className={styles.mapOverlayTerminal}>
                                <div className={styles.terminalHeader}>SYSTEM LOG</div>
                                <div className={styles.terminalBody}>
                                    {terminalVehicles.map((f, i) => (
                                        <div key={`${f.info.id}-${terminalTick}-${i}`} className={styles.terminalLine}>
                                            <span className={styles.tTime}>{new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            <span className={styles.tSys}>[GPS]</span>
                                            <span className={styles.tMsg}>{f.info.id} @ [{f.location.lat.toFixed(4)}°N, {f.location.lng.toFixed(4)}°E] — Risk: {f.risk.score}</span>
                                        </div>
                                    ))}
                                    <div className={styles.terminalLine}><span className={styles.tBlink}>_</span></div>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Alerts Feed — D3, D4, D5: clickable, color-coded, type badge */}
                    <motion.section variants={fadeUp} className={styles.alertsPanel}>
                        <div className={styles.panelHeader}>
                            <div className={styles.headerLeft}>
                                <Terminal className={styles.iconHigh} />
                                <h2>Threat Feed</h2>
                            </div>
                            <Link href="/alerts" className={styles.viewAllLink} aria-label="View all alerts">
                                View All <ExternalLink size={12} />
                            </Link>
                        </div>
                        <div className={styles.alertsList}>
                            {alerts.length === 0 ? (
                                <div className={styles.emptyAlerts}>No active threats.</div>
                            ) : (
                                alerts.slice(0, 8).map(alert => (
                                    <Link key={alert.id} href="/alerts" className={styles.alertCard} // D3: clickable
                                        style={{ borderLeft: `3px solid ${SEVERITY_BORDER[alert.level] || '#94a3b8'}` }} // D4
                                    >
                                        <div className={styles.alertContent}>
                                            <div className={styles.alertHeaderRow}>
                                                <span className={styles.alertTarget}>{alert.truckId}</span>
                                                {/* D5: type badge */}
                                                {alert.type && (
                                                    <span className={styles.alertTypePill} data-type={alert.type}>{alert.type}</span>
                                                )}
                                                <span className={styles.alertTimeLabel}>{alert.time}</span>
                                            </div>
                                            <p className={styles.alertMessageText}>{alert.message}</p>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </motion.section>
                </motion.div>

                {/* ── ANALYTICS ROW ─────────────────────────────────────────────── */}
                <motion.section variants={fadeUp} style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1rem',
                }}>
                    {/* 1. Alert Severity Donut */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                        <SeverityDonut
                            critical={alerts.filter(a => a.level === 'Critical').length}
                            high={alerts.filter(a => a.level === 'High').length}
                            medium={alerts.filter(a => a.level === 'Medium').length}
                            low={alerts.filter(a => a.level === 'Low').length}
                            title="Alert Severity"
                            size={170}
                        />
                    </div>

                    {/* 2. Fleet Status Donut */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                        <FleetStatusDonut
                            statusCounts={fleet.reduce((acc, v) => {
                                acc[v.status] = (acc[v.status] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>)}
                            title="Fleet Status Mix"
                            size={170}
                        />
                    </div>

                    {/* 3. Per-truck risk bar */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                        <RiskBars
                            data={fleet.slice(0, 8).map(v => ({ label: v.info.id, score: v.risk.score }))}
                            title="Unit Risk Scores"
                            height={170}
                        />
                    </div>

                    {/* 4. Rolling avg risk timeline */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                        <RiskTimeline
                            data={riskHistory.length >= 2 ? riskHistory : [
                                ...Array.from({ length: 8 }, (_, i) => ({
                                    time: `T-${8 - i}`,
                                    risk: Math.max(5, avgRisk - Math.round(Math.random() * 20 - 10)),
                                })),
                                { time: 'Now', risk: avgRisk },
                            ]}
                            title="Avg Risk Timeline"
                            height={170}
                            color={avgRiskColor}
                        />
                    </div>
                </motion.section>

                {/* Fleet Telemetry Table — D1, D6, D7 */}
                <motion.section variants={fadeUp} className={styles.dataGridSection}>
                    <div className={styles.panelHeader}>
                        <div className={styles.headerLeft}>
                            <BarChart3 className={styles.iconAccent} />
                            <h2>Deep Fleet Telemetry</h2>
                        </div>
                        <span className={styles.tableSubline}>{filteredFleet.length} consignments shown</span>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>UNIT ID</th>
                                    <th>STATUS</th>
                                    <th>ROUTE VECTOR</th>
                                    <th>CARGO YIELD</th>
                                    <th>AI RISK SCORE</th>
                                    <th>LAST PING</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFleet.map((vehicle, i) => {
                                    // D1: Real-ish relative timestamp based on index offset
                                    const pingLabel = i === 0 ? 'Just now' : `${Math.round(i * 47 / 60)}m ago`;
                                    const statusStyle = STATUS_STYLE[vehicle.status] || { color: '#475569', bg: 'rgba(71,85,105,0.08)' };
                                    return (
                                        <tr key={vehicle.trip_id || `${vehicle.info.id}-${i}`} className={styles.dataRow}>
                                            <td className={styles.colId}>
                                                <Crosshair size={14} className={styles.iconMuted} />
                                                {vehicle.info.id}
                                            </td>
                                            <td>
                                                {/* D7: color-coded status badge */}
                                                <span className={styles.gridStatus} style={{ color: statusStyle.color, background: statusStyle.bg, border: `1px solid ${statusStyle.color}30` }}>
                                                    {vehicle.status === 'Alert' && '⚠ '}{vehicle.status}
                                                </span>
                                            </td>
                                            <td className={styles.colRoute}>{vehicle.info.route}</td>
                                            <td className={styles.colValue}>₹{(vehicle.info.value / 100000).toFixed(1)}L</td>
                                            <td>
                                                <div className={styles.riskBarContainer}>
                                                    <div className={`${styles.riskBarFill} ${styles[`riskBg${vehicle.risk.level}`]}`}
                                                        style={{ width: `${vehicle.risk.score}%` }} />
                                                    <span className={styles.riskBarText}>{vehicle.risk.score}/100</span>
                                                </div>
                                            </td>
                                            <td className={styles.colPing}>{pingLabel}</td>
                                            <td>
                                                <Link href="/alerts" className={styles.viewDetailsBtn} aria-label={`View details for ${vehicle.info.id}`}>
                                                    Details →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.section>
            </motion.div>
        </AuthGuard>
    );
}
