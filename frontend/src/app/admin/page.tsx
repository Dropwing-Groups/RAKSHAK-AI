'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
    getCompanies, CompanyRecord, getAdminUsers, AdminUserRecord, patchAdminUser,
    getTrucksByCompany, getTripsByCompany, TruckRecord, TripRecord,
    getAdminDashboard, AdminDashboardStats
} from '@/services/apiClient';
import { CompanyFleetBars, SeverityDonut } from '@/components/charts/ChartComponents';
import {
    Building2, Truck, Activity, RefreshCw, ChevronRight, MapPin, Search,
    Users, Shield, Edit2, X, Package, User, Phone,
    Mail, Calendar, Route, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import styles from './page.module.css';
import dynamic from 'next/dynamic';

// Deterministic pseudo-random jitter derived from a string id, so map markers
// stay in a stable position across re-renders instead of hopping around
// (Math.random() during render is impure and would do exactly that).
function jitterFromId(id: string, magnitude = 0.05): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    // Map the hash to [-magnitude/2, magnitude/2]
    return ((hash % 1000) / 1000) * magnitude - magnitude / 2;
}

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), { ssr: false });

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

// ─── Company Detail Panel ─────────────────────────────────────────────────────

function riskColor(score: number) {
    if (score >= 75) return '#dc2626';
    if (score >= 55) return '#f59e0b';
    if (score >= 35) return '#3b82f6';
    return '#10b981';
}

function statusColors(status: string) {
    const map: Record<string, { color: string; bg: string }> = {
        'In-Transit': { color: '#0284c7', bg: 'rgba(2,132,199,0.1)' },
        'Scheduled': { color: '#9333ea', bg: 'rgba(147,51,234,0.1)' },
        'Completed': { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        'Alert': { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
        'Cancelled': { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
    };
    return map[status] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
}

interface DetailPanelProps {
    company: CompanyRecord;
    onClose: () => void;
}

function CompanyDetailPanel({ company, onClose }: DetailPanelProps) {
    const [tab, setTab] = useState<'trucks' | 'trips'>('trucks');
    const [trucks, setTrucks] = useState<TruckRecord[]>([]);
    const [trips, setTrips] = useState<TripRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Re-arm the loading spinner on every company switch (not just first mount).
        // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with the external API fetch below, not a render loop
        setLoading(true);
        let cancelled = false;
        Promise.all([
            getTrucksByCompany(company.company_id),
            getTripsByCompany(company.company_id),
        ]).then(([t, tr]) => {
            if (cancelled) return;
            setTrucks(t);
            setTrips(tr);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [company.company_id]);

    const activeTrips = trips.filter(t => ['In-Transit', 'Scheduled', 'Alert'].includes(t.status));
    const activeTrucks = trucks.filter(t => t.active);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(680px, 95vw)',
                    background: '#ffffff',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
                }}
            >
                {/* Panel Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
                    color: 'white',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: '0.9rem', flexShrink: 0,
                            }}>
                                {company.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{company.name}</h2>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <MapPin size={12} /> {company.city ? `${company.city}, ${company.country}` : company.country}
                                </div>
                            </div>
                        </div>
                        {/* Mini stats */}
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {[
                                { label: 'Total Trucks', value: company.total_trucks ?? trucks.length, color: '#60a5fa' },
                                { label: 'Active Trucks', value: company.active_trucks ?? activeTrucks.length, color: '#34d399' },
                                { label: 'Total Trips', value: company.total_trips ?? trips.length, color: '#a78bfa' },
                                { label: 'Live Trips', value: company.active_trips ?? activeTrips.length, color: '#fbbf24' },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>{s.label.toUpperCase()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white', borderRadius: 8, width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
                    {(['trucks', 'trips'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                flex: 1, padding: '0.9rem', border: 'none', cursor: 'pointer', fontWeight: 700,
                                background: 'transparent', fontSize: '0.9rem',
                                color: tab === t ? '#0284c7' : '#94a3b8',
                                borderBottom: tab === t ? '2px solid #0284c7' : '2px solid transparent',
                                marginBottom: -2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.2s',
                            }}
                        >
                            {t === 'trucks' ? <Truck size={15} /> : <Route size={15} />}
                            {t === 'trucks' ? `Trucks (${trucks.length})` : `Trips (${trips.length})`}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '1.25rem 1.5rem', overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#94a3b8' }}>
                            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontWeight: 600 }}>Loading fleet data...</span>
                            <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
                        </div>
                    ) : tab === 'trucks' ? (
                        <TrucksTab trucks={trucks} />
                    ) : (
                        <TripsTab trips={trips} />
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

function TrucksTab({ trucks }: { trucks: TruckRecord[] }) {
    if (trucks.length === 0) return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Truck size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontWeight: 600 }}>No trucks registered for this company.</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trucks.map(truck => (
                <div key={truck.truck_id} style={{
                    background: truck.active ? '#f8fafc' : 'rgba(248,250,252,0.5)',
                    border: `1px solid ${truck.active ? '#e2e8f0' : '#f1f5f9'}`,
                    borderLeft: `4px solid ${truck.active ? '#10b981' : '#94a3b8'}`,
                    borderRadius: 10, padding: '1rem 1.25rem',
                    opacity: truck.active ? 1 : 0.7,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: 8,
                                background: truck.active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Truck size={16} style={{ color: truck.active ? '#10b981' : '#94a3b8' }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                    {truck.license_plate || '— No Plate —'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                    {truck.vehicle_make_model || 'Vehicle info not available'}
                                </div>
                            </div>
                        </div>
                        <span style={{
                            padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                            background: truck.active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                            color: truck.active ? '#10b981' : '#94a3b8',
                        }}>
                            {truck.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                        <InfoRow icon={<User size={12} />} label="Driver" value={truck.driver_name} />
                        <InfoRow icon={<Phone size={12} />} label="Phone" value={truck.driver_phone || '—'} />
                        <InfoRow icon={<Package size={12} />} label="Cargo" value={truck.cargo_type} />
                        <InfoRow icon={<Mail size={12} />} label="Email" value={truck.driver_email || '—'} />
                        <InfoRow icon={<Shield size={12} />} label="IoT Sensor" value={truck.iot_sensor_id || '—'} />
                        <InfoRow icon={<Calendar size={12} />} label="Added" value={new Date(truck.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                    </div>
                    {truck.cargo_value > 0 && (
                        <div style={{
                            marginTop: 8, padding: '6px 10px', borderRadius: 6,
                            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)',
                            fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 700,
                        }}>
                            💰 Cargo Value: ₹{(truck.cargo_value / 100000).toFixed(2)}L
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function TripsTab({ trips }: { trips: TripRecord[] }) {
    if (trips.length === 0) return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <Route size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontWeight: 600 }}>No trips recorded for this company.</p>
        </div>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trips.map(trip => {
                const sc = statusColors(trip.status);
                const rc = riskColor(trip.current_calculated_risk);
                return (
                    <div key={trip.trip_id} style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${sc.color}`,
                        borderRadius: 10, padding: '1rem 1.25rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                    {trip.start_location_name} <ChevronRight size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#94a3b8' }} /> {trip.destination_name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                                    {trip.truck.license_plate || 'Unknown truck'} · {trip.truck.cargo_type}
                                </div>
                            </div>
                            <span style={{
                                padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                                background: sc.bg, color: sc.color,
                            }}>
                                {trip.status.toUpperCase()}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <MiniChip icon={<Clock size={11} />} text={new Date(trip.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })} />
                            {trip.estimated_arrival && (
                                <MiniChip icon={<CheckCircle2 size={11} />} text={`ETA: ${new Date(trip.estimated_arrival).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} />
                            )}
                            <MiniChip
                                icon={<AlertTriangle size={11} />}
                                text={`Risk: ${Math.round(trip.current_calculated_risk)}/100`}
                                color={rc}
                                bg={`${rc}18`}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' }}>
            <span style={{ color: '#94a3b8', flexShrink: 0 }}>{icon}</span>
            <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{label}:</span>
            <span style={{ color: '#334155', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </div>
    );
}

function MiniChip({ icon, text, color = '#64748b', bg = '#f1f5f9' }: { icon: React.ReactNode; text: string; color?: string; bg?: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
            color, background: bg,
        }}>
            {icon} {text}
        </span>
    );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [companies, setCompanies] = useState<CompanyRecord[]>([]);
    const [usersList, setUsersList] = useState<AdminUserRecord[]>([]);
    const [dashStats, setDashStats] = useState<AdminDashboardStats | null>(null);
    const [tab, setTab] = useState<'companies' | 'users' | 'map'>('companies');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [editingUser, setEditingUser] = useState<number | null>(null);
    const [editRole, setEditRole] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        const [cData, uData, stats] = await Promise.all([getCompanies(), getAdminUsers(), getAdminDashboard()]);
        setCompanies(cData);
        setUsersList(uData);
        if (stats) setDashStats(stats);
        setLoading(false);
        setRefreshing(false);
    }, []);

    const handleToggleUserActive = async (user: AdminUserRecord) => {
        const success = await patchAdminUser(user.id, { is_active: !user.is_active });
        if (success) {
            setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !user.is_active } : u));
        }
    };

    const handleSaveRole = async (user: AdminUserRecord) => {
        const success = await patchAdminUser(user.id, { role: editRole });
        if (success) {
            setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, role: editRole } : u));
            setEditingUser(null);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!isAuthenticated || user?.role !== 'admin') {
                router.replace('/dashboard');
            } else {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- initial admin-data fetch once auth resolves, not a state-sync loop
                fetchAll();
            }
        }
    }, [authLoading, isAuthenticated, user, router, fetchAll]);

    if (authLoading || (isAuthenticated && user?.role !== 'admin' && loading)) {
        return (
            <div className={styles.loader}>
                <div className={styles.loaderRing} />
                <span>Verifying credentials...</span>
            </div>
        );
    }

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.city && c.city.toLowerCase().includes(search.toLowerCase()))
    );

    const filteredUsers = usersList.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.company_name.toLowerCase().includes(search.toLowerCase())
    );

    // Use authoritative backend stats when available, fall back to client-side sum
    const totalTrucks = dashStats?.total_trucks ?? companies.reduce((acc, c) => acc + (c.total_trucks ?? c.active_trucks), 0);
    const totalActiveTrucks = dashStats?.active_trucks ?? companies.reduce((acc, c) => acc + c.active_trucks, 0);
    const totalTrips = dashStats?.total_trips ?? companies.reduce((acc, c) => acc + (c.total_trips ?? c.active_trips), 0);
    const totalActiveTrips = dashStats?.active_trips ?? companies.reduce((acc, c) => acc + c.active_trips, 0);
    const totalAlerts = dashStats?.total_alerts ?? 0;
    const criticalAlerts = dashStats?.critical_alerts ?? 0;

    return (
        <div className={styles.page}>
            {/* Company Detail Slide-over */}
            <AnimatePresence>
                {selectedCompany && (
                    <CompanyDetailPanel
                        company={selectedCompany}
                        onClose={() => setSelectedCompany(null)}
                    />
                )}
            </AnimatePresence>

            <motion.div variants={stagger} initial="hidden" animate="show" className={styles.header}>
                <motion.div variants={fadeUp} className={styles.headerLeft}>
                    <div className={styles.breadcrumb}><span>Platform</span><ChevronRight size={14} /><span>Admin Control</span></div>
                    <h1 className={styles.title}>Global Registry</h1>
                    <p className={styles.subtitle}>Super-admin view of all onboarded Logistics Companies · Click any row to inspect</p>
                </motion.div>

                <motion.div variants={fadeUp} className={styles.headerRight}>
                    <div style={{ position: 'relative' }}>
                        <input
                            className={styles.searchInput}
                            placeholder="Search companies..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: 12, top: 13 }} />
                    </div>
                    <button className={styles.refreshBtn} onClick={() => fetchAll(true)} disabled={refreshing} title="Refresh records">
                        <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
                    </button>
                </motion.div>
            </motion.div>

            <motion.div variants={stagger} initial="hidden" animate="show" className={styles.statsGrid}>
                <motion.div variants={fadeUp} className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <div className={styles.statIconWrapper}><Building2 size={20} /></div>
                        <span className={styles.statLabel}>Total Tenants</span>
                    </div>
                    <h2 className={styles.statValue}>{companies.length}</h2>
                </motion.div>
                <motion.div variants={fadeUp} className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <div className={styles.statIconWrapper}><Users size={20} /></div>
                        <span className={styles.statLabel}>System Users</span>
                    </div>
                    <h2 className={styles.statValue}>{usersList.length}</h2>
                </motion.div>
                <motion.div variants={fadeUp} className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <div className={styles.statIconWrapper}><Truck size={20} /></div>
                        <span className={styles.statLabel}>Global Fleet</span>
                    </div>
                    <h2 className={styles.statValue}>{totalTrucks}</h2>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, marginTop: 4 }}>
                        {totalActiveTrucks} active
                    </div>
                </motion.div>
                <motion.div variants={fadeUp} className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <div className={styles.statIconWrapper}><Activity size={20} /></div>
                        <span className={styles.statLabel}>Total Trips</span>
                    </div>
                    <h2 className={styles.statValue}>{totalTrips}</h2>
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700, marginTop: 4 }}>
                        {totalActiveTrips} in progress
                    </div>
                </motion.div>
                <motion.div variants={fadeUp} className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <div className={styles.statIconWrapper}><AlertTriangle size={20} /></div>
                        <span className={styles.statLabel}>Platform Alerts</span>
                    </div>
                    <h2 className={styles.statValue}>{totalAlerts}</h2>
                    {criticalAlerts > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: 4 }}>
                            {criticalAlerts} critical
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {loading ? (
                <div className={styles.loader}>
                    <div className={styles.loaderRing} />
                    <span>Loading tenant data...</span>
                </div>
            ) : (
                <>
                    {/* ── PLATFORM ANALYTICS CHARTS ───────────────────────────── */}
                    {companies.length > 0 && (
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto',
                                gap: '1.25rem',
                                marginBottom: '1.5rem',
                            }}
                        >
                            {/* Fleet Size by Company */}
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '1.25rem' }}>
                                <CompanyFleetBars
                                    data={companies.map(c => ({
                                        name: c.name,
                                        trucks: c.total_trucks ?? c.active_trucks,
                                        active: c.active_trucks,
                                        trips: c.total_trips ?? c.active_trips,
                                    }))}
                                    title="Fleet Size by Company"
                                    height={Math.max(200, companies.slice(0, 8).length * 38)}
                                />
                            </div>

                            {/* Alert Severity Donut */}
                            <div style={{
                                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14,
                                padding: '1.25rem', minWidth: 240, display: 'flex', flexDirection: 'column', alignItems: 'center',
                            }}>
                                <SeverityDonut
                                    critical={dashStats?.critical_alerts ?? 0}
                                    high={dashStats?.high_alerts ?? 0}
                                    medium={0}
                                    low={Math.max(0, (dashStats?.total_alerts ?? 0) - (dashStats?.critical_alerts ?? 0) - (dashStats?.high_alerts ?? 0))}
                                    title="Platform Alerts"
                                    size={200}
                                />
                            </div>
                        </motion.div>
                    )}

                    <div className={styles.tabs} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                        {(['companies', 'users', 'map'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => { setTab(t); setSearch(''); }}
                                style={{
                                    background: 'transparent', color: tab === t ? '#3b82f6' : '#94a3b8',
                                    border: 'none', padding: '0.75rem 1.5rem', cursor: 'pointer',
                                    fontWeight: 600, borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                                    display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                            >
                                {t === 'companies' ? <Building2 size={16} /> : t === 'users' ? <Users size={16} /> : <MapPin size={16} />}
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {tab === 'companies' && (
                            <motion.div key="companies" variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0 }} className={styles.tableSection}>
                                <div className={styles.tableHeader}>
                                    <Building2 className={styles.iconAccent} size={20} />
                                    <h2>Registered Organizations</h2>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                                        Click any row to inspect fleet details
                                    </span>
                                </div>
                                {filteredCompanies.length === 0 ? (
                                    <div className={styles.empty}>
                                        <Building2 size={48} opacity={0.2} />
                                        <h3>No companies found</h3>
                                        <p>Try adjusting your search query.</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className={styles.dataTable}>
                                            <thead>
                                                <tr>
                                                    <th>ORGANIZATION</th>
                                                    <th>STATUS</th>
                                                    <th>LOCATION</th>
                                                    <th>FLEET (TRUCKS / TRIPS)</th>
                                                    <th>ONBOARDED</th>
                                                    <th>DETAILS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCompanies.map(c => (
                                                    <tr
                                                        key={c.company_id}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => setSelectedCompany(c)}
                                                    >
                                                        <td>
                                                            <div className={styles.colName}>
                                                                <div className={styles.companyAvatar}>{c.name.substring(0, 2).toUpperCase()}</div>
                                                                {c.name}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={styles.statusPill} data-active={c.active}>
                                                                {c.active ? 'Active' : 'Suspended'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className={styles.metric}>
                                                                <MapPin size={14} /> {c.city ? `${c.city}, ${c.country}` : c.country}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className={styles.metricsGroup}>
                                                                <span className={styles.metric}>
                                                                    <Truck size={13} />&nbsp;
                                                                    <strong>{c.total_trucks ?? c.active_trucks}</strong>
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 2 }}>total</span>
                                                                    &nbsp;·&nbsp;
                                                                    <span style={{ color: '#10b981', fontWeight: 700 }}>{c.active_trucks}</span>
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 2 }}>active</span>
                                                                </span>
                                                                <span className={styles.metric}>
                                                                    <Activity size={13} />&nbsp;
                                                                    <strong>{c.total_trips ?? c.active_trips}</strong>
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 2 }}>total</span>
                                                                    &nbsp;·&nbsp;
                                                                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>{c.active_trips}</span>
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 2 }}>live</span>
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span style={{ color: 'var(--text-muted)' }}>
                                                                {new Date(c.joined_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setSelectedCompany(c); }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                                    padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                                                                    background: '#f8fafc', color: '#0284c7', fontWeight: 700,
                                                                    fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                Inspect <ChevronRight size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {tab === 'users' && (
                            <motion.div key="users" variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0 }} className={styles.tableSection}>
                                <div className={styles.tableHeader}>
                                    <Users className={styles.iconAccent} size={20} />
                                    <h2>System Users</h2>
                                </div>
                                {filteredUsers.length === 0 ? (
                                    <div className={styles.empty}>
                                        <Users size={48} opacity={0.2} />
                                        <h3>No users found</h3>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className={styles.dataTable}>
                                            <thead>
                                                <tr>
                                                    <th>USER</th>
                                                    <th>COMPANY</th>
                                                    <th>ROLE</th>
                                                    <th>STATUS</th>
                                                    <th>ACTIONS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredUsers.map(u => (
                                                    <tr key={u.id}>
                                                        <td>
                                                            <div className={styles.colName} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{u.username}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className={styles.metric}>
                                                                <Building2 size={14} /> {u.company_name}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {editingUser === u.id ? (
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <select
                                                                        value={editRole} onChange={e => setEditRole(e.target.value)}
                                                                        style={{ background: '#f8fafc', border: '1px solid #3b82f6', color: '#1e293b', padding: '4px', borderRadius: '4px' }}
                                                                    >
                                                                        <option value="admin">Admin</option>
                                                                        <option value="company_user">Company User</option>
                                                                        <option value="viewer">Viewer</option>
                                                                    </select>
                                                                    <button onClick={() => handleSaveRole(u)} style={{ background: '#10b981', border: 'none', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>Save</button>
                                                                    <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <span style={{
                                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700,
                                                                    background: u.role === 'admin' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                                                                    color: u.role === 'admin' ? '#7c3aed' : '#2563eb'
                                                                }}>
                                                                    {u.role.toUpperCase()}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => handleToggleUserActive(u)}
                                                                className={styles.statusPill}
                                                                data-active={u.is_active}
                                                                style={{ cursor: 'pointer', border: 'none' }}
                                                                title="Click to toggle active status"
                                                            >
                                                                {u.is_active ? 'Active' : 'Disabled'}
                                                            </button>
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => { setEditingUser(u.id); setEditRole(u.role); }}
                                                                style={{ background: 'transparent', border: '1px solid #e2e8f0', color: '#475569', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                title="Edit Role"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {tab === 'map' && (
                            <motion.div key="map" variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0 }} className={styles.tableSection}>
                                <div className={styles.tableHeader}>
                                    <MapPin className={styles.iconAccent} size={20} />
                                    <h2>Company HQ Distribution</h2>
                                </div>
                                <div style={{ padding: '0 1rem 1rem 1rem' }}>
                                    <GoogleMapComponent
                                        height="500px"
                                        center={{ lat: 20.5937, lng: 78.9629 }}
                                        zoom={4}
                                        markers={companies.map(c => {
                                            let lat = 20.5937, lng = 78.9629;
                                            const cname = (c.city || c.name).toLowerCase();
                                            if (cname.includes('delhi') || cname.includes('noida') || cname.includes('gurgaon')) { lat = 28.6139; lng = 77.2090; }
                                            else if (cname.includes('mumbai') || cname.includes('thane') || cname.includes('jio')) { lat = 19.0760; lng = 72.8777; }
                                            else if (cname.includes('chennai')) { lat = 13.0827; lng = 80.2707; }
                                            else if (cname.includes('bangalore') || cname.includes('bengaluru')) { lat = 12.9716; lng = 77.5946; }
                                            else if (cname.includes('hyderabad')) { lat = 17.3850; lng = 78.4867; }
                                            else if (cname.includes('pune')) { lat = 18.5204; lng = 73.8567; }
                                            else if (cname.includes('ahmedabad')) { lat = 23.0225; lng = 72.5714; }
                                            else if (cname.includes('kolkata')) { lat = 22.5726; lng = 88.3639; }
                                            const idSeed = String(c.company_id);
                                            lat += jitterFromId(idSeed + 'lat');
                                            lng += jitterFromId(idSeed + 'lng');
                                            return {
                                                lat, lng,
                                                title: c.name,
                                                riskLevel: c.active_trucks > 50 ? 'Critical' : (c.active_trucks > 20 ? 'High' : 'Low'),
                                                status: `${c.total_trucks ?? c.active_trucks} Trucks`,
                                                route: `${c.city || c.country}`
                                            };
                                        })}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
}
