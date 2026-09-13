'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';
import { getAlerts, resolveAlert, getFleetData, EnhancedAlert, FleetVehicle } from '@/services/apiClient';
import { SeverityDonut } from '@/components/charts/ChartComponents';
import AuthGuard from '@/components/AuthGuard';
import dynamic from 'next/dynamic';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), { ssr: false });
import {
    AlertCircle, Filter, CheckCircle2, Search, ChevronDown, ChevronUp,
    MapPin, Navigation, Brain, Clock, ShieldAlert, Bell, Download,
    ArrowUpDown, RotateCcw
} from 'lucide-react';

const AI_EXPLANATIONS: Record<string, string> = {
    Critical: 'Explainability Engine: CRITICAL — Person detected loitering >60s near rear door combined with route deviation. Immediate intervention recommended.',
    High: 'Explainability Engine: Elevated risk — confluence of night transport, high-value cargo, and behavioral anomaly near cargo hatch.',
    Medium: 'Explainability Engine: Moderate risk — stop duration exceeded baseline by 2.3x. No visual confirmation yet. Continue monitoring.',
    Low: 'Explainability Engine: Baseline transit. Journey within normal operating parameters. Routine telemetry only.',
};

const SEVERITY_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
    Critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', border: '#ef4444', icon: '🔴' },
    High: { color: '#ef4444', bg: 'rgba(239,68,68,0.05)', border: '#f87171', icon: '🟠' },
    Medium: { color: '#d97706', bg: 'rgba(217,119,6,0.05)', border: '#fbbf24', icon: '🟡' },
    Low: { color: '#059669', bg: 'rgba(5,150,105,0.05)', border: '#34d399', icon: '🟢' },
};

const FILTER_ACTIVE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    All: { bg: '#0284c7', color: 'white', border: '#0284c7' },
    Critical: { bg: '#dc2626', color: 'white', border: '#dc2626' },
    High: { bg: '#ef4444', color: 'white', border: '#ef4444' },
    Medium: { bg: '#f59e0b', color: 'white', border: '#f59e0b' },
    Low: { bg: '#10b981', color: 'white', border: '#10b981' },
};

type SortKey = 'time' | 'severity' | 'truck';
const SEVERITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export default function Alerts() {
    const [alerts, setAlerts] = useState<EnhancedAlert[]>([]);
    const [filter, setFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
    const [showResolved, setShowResolved] = useState(false); // A4: Resolved tab
    const [sortKey, setSortKey] = useState<SortKey>('severity'); // A6: sort
    const [sortAsc, setSortAsc] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [mapModalAlert, setMapModalAlert] = useState<EnhancedAlert | null>(null);

    const [fleetData, setFleetData] = useState<FleetVehicle[]>([]);

    // A3: auto-refresh every 30s
    const fetchAlerts = useCallback(async () => {
        const [data, fleet] = await Promise.all([getAlerts(), getFleetData()]);
        const enriched: EnhancedAlert[] = data.map(a => ({
            ...a,
            aiExplanation: a.aiExplanation || AI_EXPLANATIONS[a.level] || AI_EXPLANATIONS['Low'],
            riskScore: a.riskScore ?? (a.level === 'Critical' ? 88 : a.level === 'High' ? 71 : a.level === 'Medium' ? 48 : 15),
            type: a.type || 'System',
        }));
        setAlerts(enriched);
        setFleetData(fleet);
        setLastRefresh(new Date());
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initial fetch, not a state-sync loop
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000); // A3
        return () => clearInterval(interval);
    }, [fetchAlerts]);

    // A2: Get real vehicle location — prefer alert.location (direct GPS from backend),
    // fall back to fuzzy fleet data match for seed/mock mode
    const getLocation = (alert: EnhancedAlert): { lat: number; lng: number } | null => {
        // 1. Best source: location embedded directly in the alert (from gps_lat/gps_lng)
        if (alert.location) return alert.location;

        // 2. Fallback: cross-reference fleet data by truck ID (seed/mock mode)
        const truckId = alert.truckId;
        if (!truckId || fleetData.length === 0) return null;

        // Exact match
        let vehicle = fleetData.find(v => v.info.id === truckId);

        // Normalised match: strip non-alphanumeric and compare
        if (!vehicle) {
            const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
            vehicle = fleetData.find(v => norm(v.info.id) === norm(truckId));
        }

        // Partial match: one contains the other's numeric suffix
        if (!vehicle) {
            const nums = truckId.replace(/\D/g, '');
            if (nums) vehicle = fleetData.find(v => v.info.id.replace(/\D/g, '') === nums);
        }

        return vehicle?.location ?? null;
    };

    // Get the fleet vehicle for a truckId (same fuzzy logic)
    const getFleetVehicle = (truckId?: string): FleetVehicle | null => {
        if (!truckId || fleetData.length === 0) return null;
        const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const nums = truckId.replace(/\D/g, '');
        return fleetData.find(v =>
            v.info.id === truckId ||
            norm(v.info.id) === norm(truckId) ||
            (nums && v.info.id.replace(/\D/g, '') === nums)
        ) ?? null;
    };

    // A6: sort handler
    const cycleSort = (key: SortKey) => {
        if (sortKey === key) { setSortAsc(v => !v); } else { setSortKey(key); setSortAsc(false); }
    };

    // A5: CSV Export
    const exportCSV = () => {
        const rows = [
            ['ID', 'Time', 'Truck', 'Level', 'Type', 'Risk Score', 'Message', 'Status'],
            ...alerts.map(a => [
                a.id, a.time, a.truckId ?? '', a.level, a.type ?? '', a.riskScore ?? '', `"${a.message}"`,
                resolvedIds.has(a.id) ? 'Resolved' : 'Active'
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `rakshak-alerts-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    // Toggle expand
    const toggleExpand = (id: string) => setExpandedAlertId(expandedAlertId === id ? null : id);

    // Resolve
    const resolve = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await resolveAlert(id);
        } catch (err) {
            console.error('Failed to resolve alert via API:', err);
        }
        setResolvedIds(prev => new Set([...prev, id]));
        setExpandedAlertId(null);
    };

    // A7: filter counts are based on non-resolved + current search (accurate counts)
    const countForFilter = (f: string) => {
        const base = alerts.filter(a => !resolvedIds.has(a.id));
        const searched = searchQuery
            ? base.filter(a => a.message.toLowerCase().includes(searchQuery.toLowerCase()) || (a.truckId ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
            : base;
        return f === 'All' ? searched.length : searched.filter(a => a.level === f).length;
    };

    // Apply filters + sort
    const filteredAlerts = alerts
        .filter(alert => {
            const isResolved = resolvedIds.has(alert.id);
            if (showResolved) return isResolved;
            if (isResolved) return false;
            const matchFilter = filter === 'All' || alert.level === filter;
            const matchSearch = !searchQuery ||
                alert.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (alert.truckId ?? '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchFilter && matchSearch;
        })
        .sort((a, b) => {
            let diff = 0;
            if (sortKey === 'severity') diff = (SEVERITY_ORDER[a.level] ?? 4) - (SEVERITY_ORDER[b.level] ?? 4);
            else if (sortKey === 'time') diff = a.time > b.time ? -1 : 1;
            else if (sortKey === 'truck') diff = (a.truckId ?? '').localeCompare(b.truckId ?? '');
            return sortAsc ? -diff : diff;
        });

    const criticalCount = alerts.filter(a => a.level === 'Critical' && !resolvedIds.has(a.id)).length;
    const highCount = alerts.filter(a => a.level === 'High' && !resolvedIds.has(a.id)).length;
    const resolvedCount = resolvedIds.size;

    return (
        <AuthGuard>
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
                            Alert Intelligence Center
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }} suppressHydrationWarning>
                            Last refreshed: {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} · Auto-refreshes every 30s
                        </p> {/* A3 indicator */}
                    </div>
                    <div className={styles.headerStats}>
                        {criticalCount > 0 && (
                            <div className={styles.headerStatBadge} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                                <AlertCircle size={14} /> {criticalCount} Critical
                            </div>
                        )}
                        {highCount > 0 && (
                            <div className={styles.headerStatBadge} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                                <ShieldAlert size={14} /> {highCount} High
                            </div>
                        )}
                        <div className={styles.headerStatBadge} style={{ background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', color: '#0284c7' }}>
                            <Bell size={14} /> {alerts.filter(a => !resolvedIds.has(a.id)).length} Active
                        </div>
                        {/* A5: Export CSV */}
                        <button
                            onClick={exportCSV}
                            aria-label="Export alerts as CSV"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '0.5rem 1rem', borderRadius: 999, border: '1px solid #e2e8f0',
                                background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <Download size={14} /> Export CSV
                        </button>
                        {/* Manual refresh button */}
                        <button
                            onClick={fetchAlerts}
                            aria-label="Manually refresh alerts"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '0.5rem 1rem', borderRadius: 999, border: '1px solid rgba(2,132,199,0.3)',
                                background: 'rgba(2,132,199,0.06)', color: '#0284c7', fontWeight: 700, fontSize: '0.82rem',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <RotateCcw size={13} /> Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.alertsLayout}>
                {/* Filter Sidebar */}
                <div className={styles.filterSidebar}>
                    <div className={styles.filterHeader}><Filter size={18} /><h3>Filter Logs</h3></div>

                    {/* Chart: severity overview */}
                    <div style={{ marginBottom: 16 }}>
                        <SeverityDonut
                            critical={alerts.filter(a => a.level === 'Critical' && !resolvedIds.has(a.id)).length}
                            high={alerts.filter(a => a.level === 'High' && !resolvedIds.has(a.id)).length}
                            medium={alerts.filter(a => a.level === 'Medium' && !resolvedIds.has(a.id)).length}
                            low={alerts.filter(a => a.level === 'Low' && !resolvedIds.has(a.id)).length}
                            title="Active Alert Mix"
                            size={160}
                        />
                        {resolvedCount > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', marginBottom: 4 }}>RESOLUTION RATE</div>
                                <div style={{ background: '#e2e8f0', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.round((resolvedCount / (resolvedCount + alerts.filter(a => !resolvedIds.has(a.id)).length)) * 100)}%`,
                                        height: '100%', background: '#10b981', borderRadius: 999, transition: 'width 0.6s ease'
                                    }} />
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4, textAlign: 'right' }}>{resolvedCount} resolved</div>
                            </div>
                        )}
                    </div>

                    {/* A4: Resolved toggle tab */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                        <button
                            onClick={() => setShowResolved(false)}
                            aria-label="Show active alerts"
                            style={{
                                flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #e2e8f0',
                                background: !showResolved ? '#0284c7' : 'white',
                                color: !showResolved ? 'white' : '#64748b',
                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                            }}
                        >Active</button>
                        <button
                            onClick={() => setShowResolved(true)}
                            aria-label="Show resolved alerts"
                            style={{
                                flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid #e2e8f0',
                                background: showResolved ? '#059669' : 'white',
                                color: showResolved ? 'white' : '#64748b',
                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                            }}
                        >
                            Resolved {resolvedCount > 0 && `(${resolvedCount})`}
                        </button>
                    </div>

                    {!showResolved && (
                        <div className={styles.filterGroup}>
                            {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(f => {
                                const isActive = filter === f;
                                const activeColors = FILTER_ACTIVE_COLORS[f]; // A8: severity-matched colors
                                return (
                                    <button
                                        key={f}
                                        className={styles.filterBtn}
                                        onClick={() => setFilter(f)}
                                        aria-label={`Filter by ${f}`}
                                        aria-pressed={isActive}
                                        style={isActive ? {
                                            background: activeColors.bg,
                                            color: activeColors.color,
                                            border: `1px solid ${activeColors.border}`
                                        } : undefined}
                                    >
                                        {f !== 'All' && <span>{SEVERITY_META[f]?.icon} </span>}
                                        {f === 'All' ? 'All Alerts' : `${f} Risk`}
                                        {/* A7: counts respect active search */}
                                        <span className={styles.filterCount}>{countForFilter(f)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Alert Source Legend */}
                    <div className={styles.typeLegend}>
                        <div className={styles.typeLegendTitle}>Alert Sources</div>
                        {[
                            { type: 'Vision', color: '#8b5cf6', desc: 'YOLO + DeepSORT' },
                            { type: 'Behavior', color: '#f59e0b', desc: 'IsolationForest' },
                            { type: 'Route', color: '#3b82f6', desc: 'Geofence check' },
                            { type: 'IoT', color: '#10b981', desc: 'Digital Twin' },
                            { type: 'System', color: '#64748b', desc: 'Decision Engine' },
                        ].map(item => (
                            <div key={item.type} className={styles.typeLegendItem}>
                                <div className={styles.typeDot} style={{ background: item.color }} />
                                <span>{item.type}</span>
                                <span className={styles.typeDesc}>{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alerts List */}
                <div className={styles.alertsContent}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        {/* Search */}
                        <div className={styles.searchContainer} style={{ flex: 1 }}>
                            <Search className={styles.searchIcon} size={18} />
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search truck ID, route, alert message..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                aria-label="Search alerts"
                            />
                        </div>
                        {/* A6: Sort buttons */}
                        {(['severity', 'time', 'truck'] as SortKey[]).map(key => (
                            <button
                                key={key}
                                onClick={() => cycleSort(key)}
                                aria-label={`Sort by ${key}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '0 12px', borderRadius: 8,
                                    border: `1px solid ${sortKey === key ? '#0284c7' : '#e2e8f0'}`,
                                    background: sortKey === key ? 'rgba(2,132,199,0.08)' : 'white',
                                    color: sortKey === key ? '#0284c7' : '#64748b',
                                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                <ArrowUpDown size={12} />
                                {key} {sortKey === key ? (sortAsc ? '↑' : '↓') : ''}
                            </button>
                        ))}
                    </div>

                    {filteredAlerts.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.emptyState}>
                            <CheckCircle2 size={48} className={styles.successIcon} />
                            <p>{showResolved ? 'No resolved alerts yet.' : 'No active alerts for this filter. System nominal.'}</p>
                        </motion.div>
                    ) : (
                        <div className={styles.alertsList}>
                            <AnimatePresence>
                                {filteredAlerts.map(alert => {
                                    const meta = SEVERITY_META[alert.level] || SEVERITY_META['Low'];
                                    const isExpanded = expandedAlertId === alert.id;
                                    const location = getLocation(alert); // A2: prefer alert.location
                                    return (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                            key={alert.id}
                                            className={`${styles.alertCard} ${isExpanded ? styles.expanded : ''} ${alert.level === 'Critical' && !resolvedIds.has(alert.id) ? styles.criticalPulseBorder : ''}`}
                                            style={{ borderLeftColor: meta.border, background: isExpanded ? meta.bg : undefined }}
                                        >
                                            <div className={styles.alertCardHeader} onClick={() => toggleExpand(alert.id)}>
                                                <div className={styles.alertIcon} style={{ color: meta.color, background: `${meta.color}15` }}>
                                                    <AlertCircle size={22} />
                                                </div>
                                                <div className={styles.alertDetails}>
                                                    <div className={styles.alertTopRow}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                            <span className={styles.alertLevel} style={{ color: meta.color }}>{meta.icon} {alert.level.toUpperCase()}</span>
                                                            <span className={styles.alertTypeBadge} style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}25` }}>
                                                                {alert.type}
                                                            </span>
                                                            {alert.truckId && <span className={styles.truckBadge}>{alert.truckId}</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {alert.riskScore !== undefined && (
                                                                <div className={styles.miniRiskBar}>
                                                                    <div style={{ width: 50, height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                                                                        <div style={{ width: `${alert.riskScore}%`, height: '100%', background: meta.color, borderRadius: 2 }} />
                                                                    </div>
                                                                    <span className={styles.miniRiskScore} style={{ color: meta.color }}>{alert.riskScore}</span>
                                                                </div>
                                                            )}
                                                            <span className={styles.alertTime}><Clock size={12} /> {alert.time}</span>
                                                        </div>
                                                    </div>
                                                    <p className={styles.alertMessage}>{alert.message}</p>
                                                </div>
                                                <div className={styles.alertActions}>
                                                    <button className={styles.expandBtn} aria-label={isExpanded ? 'Collapse alert' : 'Expand alert'}>
                                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div className={styles.expandedContent}>
                                                            {/* AI Explanation */}
                                                            <div className={styles.aiExplanationPanel}>
                                                                <div className={styles.aiExplanationHeader}>
                                                                    <Brain size={14} style={{ color: '#8b5cf6' }} />
                                                                    <span>Explainable AI Analysis</span>
                                                                </div>
                                                                <p className={styles.aiExplanationText}>{alert.aiExplanation}</p>
                                                            </div>

                                                            <div className={styles.expandedGrid}>
                                                                {/* A2: Real GPS location from SEED_FLEET */}
                                                                <div className={styles.expandedItem}>
                                                                    <span className={styles.expandedLabel}><MapPin size={13} /> Location Snapshot</span>
                                                                    <span className={styles.expandedValue}>
                                                                        {location
                                                                            ? `${location.lat.toFixed(4)}°N, ${location.lng.toFixed(4)}°E`
                                                                            : 'Location unavailable'}
                                                                    </span>
                                                                </div>
                                                                <div className={styles.expandedItem}>
                                                                    <span className={styles.expandedLabel}><Navigation size={13} /> Recommended Action</span>
                                                                    <span className={styles.expandedValue} style={{ color: meta.color }}>
                                                                        {alert.level === 'Critical' ? 'Dispatch rapid response. Lock container. Notify police immediately.' :
                                                                            alert.level === 'High' ? 'Alert driver and control room. Request visual confirmation.' :
                                                                                'Monitor live feeds. Notify convoy leader of potential risk.'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className={styles.expandedActions}>
                                                                {/* A1: "View on Map" now opens Modal */}
                                                                <button
                                                                    className={styles.actionBtnSecondary}
                                                                    onClick={(e) => { e.stopPropagation(); setMapModalAlert(alert); }}
                                                                    aria-label="View vehicle on map"
                                                                >
                                                                    View on Map
                                                                </button>
                                                                {!resolvedIds.has(alert.id) && (
                                                                    <button
                                                                        className={styles.actionBtnPrimary}
                                                                        style={{ background: meta.color }}
                                                                        onClick={(e) => resolve(alert.id, e)}
                                                                        aria-label="Acknowledge and resolve this alert"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Acknowledge &amp; Resolve
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            {/* Google Maps Modal Overlay — View on Map */}
            <AnimatePresence>
                {mapModalAlert && (() => {
                    const loc = getLocation(mapModalAlert); // prefer embedded GPS
                    const fv = getFleetVehicle(mapModalAlert.truckId);
                    const meta = SEVERITY_META[mapModalAlert.level] || SEVERITY_META['Low'];

                    // Build markers: the specific truck first, then all other fleet vehicles for context
                    const allMarkers = [
                        // If we found the truck, pin it prominently
                        ...(loc ? [{
                            lat: loc.lat,
                            lng: loc.lng,
                            title: mapModalAlert.truckId || 'Vehicle',
                            truckId: mapModalAlert.truckId,
                            riskLevel: mapModalAlert.level as 'Low' | 'Medium' | 'High' | 'Critical',
                            riskScore: mapModalAlert.riskScore,
                            status: fv?.status,
                            route: fv?.info.route,
                        }] : []),
                        // Show all other fleet vehicles as light context markers
                        ...fleetData
                            .filter(v => v.info.id !== fv?.info.id)
                            .slice(0, 12)
                            .map(v => ({
                                lat: v.location.lat,
                                lng: v.location.lng,
                                title: v.info.id,
                                truckId: v.info.id,
                                riskLevel: v.risk.level as 'Low' | 'Medium' | 'High' | 'Critical',
                                riskScore: v.risk.score,
                                status: v.status,
                                route: v.info.route,
                            })),
                    ];

                    // Centre: truck location if found, else India centroid
                    const mapCenter = loc ?? { lat: 22.5, lng: 80.5 };
                    const mapZoom = loc ? 13 : 5;

                    return (
                        <motion.div
                            key="map-modal-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMapModalAlert(null)}
                            style={{
                                position: 'fixed', inset: 0, zIndex: 9999,
                                background: 'rgba(15,23,42,0.88)',
                                backdropFilter: 'blur(10px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '1rem',
                            }}
                        >
                            <motion.div
                                key="map-modal-panel"
                                initial={{ scale: 0.94, opacity: 0, y: 24 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.94, opacity: 0, y: 24 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                onClick={e => e.stopPropagation()}
                                style={{
                                    background: '#0f172a',
                                    border: `1px solid ${meta.color}30`,
                                    borderRadius: 18,
                                    width: '100%',
                                    maxWidth: 960,
                                    maxHeight: '90vh',
                                    overflow: 'hidden',
                                    boxShadow: `0 30px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px ${meta.color}20`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {/* ── Modal Header ─────────────────────────── */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                                    background: 'rgba(255,255,255,0.02)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10,
                                            background: `${meta.color}18`,
                                            border: `1px solid ${meta.color}35`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <MapPin size={18} style={{ color: meta.color }} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#f1f5f9' }}>
                                                Live Location — {mapModalAlert.truckId || 'Unknown Vehicle'}
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                                {loc
                                                    ? `📍 ${loc.lat.toFixed(4)}°N, ${loc.lng.toFixed(4)}°E${fv?.info.route ? ` · ${fv.info.route}` : ''}`
                                                    : '⚠ Live GPS unavailable — showing fleet overview'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setMapModalAlert(null)}
                                        aria-label="Close map"
                                        style={{
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#94a3b8', cursor: 'pointer', padding: '6px 10px',
                                            borderRadius: 8, fontWeight: 700, fontSize: '1rem', lineHeight: 1,
                                            transition: 'all 0.15s',
                                        }}
                                    >✕</button>
                                </div>

                                {/* ── Body: Map + Details ───────────────────── */}
                                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                                    {/* Map (takes most space) */}
                                    <div style={{ flex: 1, minHeight: 420, position: 'relative' }}>
                                        <GoogleMapComponent
                                            height="100%"
                                            center={mapCenter}
                                            zoom={mapZoom}
                                            markers={allMarkers}
                                        />
                                        {!loc && (
                                            <div style={{
                                                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                                                background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(245,158,11,0.4)',
                                                borderRadius: 8, padding: '6px 14px',
                                                fontSize: '0.76rem', color: '#f59e0b', fontWeight: 700,
                                                backdropFilter: 'blur(4px)', whiteSpace: 'nowrap',
                                            }}>
                                                ⚠ GPS signal lost — showing all fleet context
                                            </div>
                                        )}
                                    </div>

                                    {/* Alert Details Panel (right side) */}
                                    <div style={{
                                        width: 240, flexShrink: 0,
                                        borderLeft: '1px solid rgba(255,255,255,0.07)',
                                        background: 'rgba(255,255,255,0.02)',
                                        padding: '1rem', overflowY: 'auto',
                                        display: 'flex', flexDirection: 'column', gap: 12,
                                    }}>
                                        {/* Severity badge */}
                                        <div style={{
                                            background: `${meta.color}15`,
                                            border: `1px solid ${meta.color}30`,
                                            borderRadius: 10, padding: '10px 12px',
                                        }}>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>SEVERITY</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: meta.color }}>{meta.icon} {mapModalAlert.level.toUpperCase()}</div>
                                            {mapModalAlert.riskScore !== undefined && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                                        <div style={{ width: `${mapModalAlert.riskScore}%`, height: '100%', background: meta.color, borderRadius: 4, transition: 'width 0.6s' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3, textAlign: 'right' }}>{mapModalAlert.riskScore}/100</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Alert message */}
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>INCIDENT</div>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>{mapModalAlert.message}</p>
                                        </div>

                                        {/* Fleet vehicle info */}
                                        {fv && (
                                            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>VEHICLE INFO</div>
                                                {[
                                                    { label: 'Cargo', value: fv.info.cargo },
                                                    { label: 'Value', value: `₹${(fv.info.value / 100000).toFixed(1)}L` },
                                                    { label: 'Route', value: fv.info.route },
                                                    { label: 'Status', value: fv.status },
                                                ].map(row => (
                                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>{row.label}</span>
                                                        <span style={{ fontSize: '0.73rem', color: '#e2e8f0', fontWeight: 700, maxWidth: 110, textAlign: 'right', wordBreak: 'break-word' }}>{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Coordinate pill */}
                                        {loc && (
                                            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                                                <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>GPS FIX</div>
                                                <div style={{ fontSize: '0.75rem', color: '#34d399', fontFamily: 'monospace' }}>
                                                    {loc.lat.toFixed(5)}°N<br />{loc.lng.toFixed(5)}°E
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Explanation */}
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#8b5cf6', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>AI ANALYSIS</div>
                                            <p style={{ margin: 0, fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.55 }}>{mapModalAlert.aiExplanation}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </div>
        </AuthGuard>
    );
}
