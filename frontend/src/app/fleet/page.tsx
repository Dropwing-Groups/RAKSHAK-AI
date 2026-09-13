'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Truck, User, Package, DollarSign, MapPin, Shield, Activity,
    RefreshCw, ChevronRight, Wifi, Clock, Plus
} from 'lucide-react';
import { getTrucks, getTrips, TruckRecord, TripRecord, FleetVehicle, getFleetData, createTrip } from '@/services/apiClient';
import { RiskBars, FleetStatusDonut } from '@/components/charts/ChartComponents';
import styles from './page.module.css';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import dynamic from 'next/dynamic';

const GoogleMapComponent = dynamic(() => import('@/components/GoogleMapComponent'), { ssr: false });

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const RISK_COLOR = (score: number) =>
    score >= 75 ? '#dc2626' : score >= 50 ? '#f59e0b' : score >= 25 ? '#3b82f6' : '#10b981';

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    Alert: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'Alert' },
    'In-Transit': { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', label: 'In Transit' },
    Scheduled: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Scheduled' },
    Completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Completed' },
    Cancelled: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Cancelled' },
};

type Tab = 'trucks' | 'trips' | 'map';

export default function FleetPage() {
    const { user } = useAuth();
    const canCreateTrip = user?.role === 'company_user' || user?.role === 'admin';

    const [tab, setTab] = useState<Tab>('trucks');
    const [trucks, setTrucks] = useState<TruckRecord[]>([]);
    const [trips, setTrips] = useState<TripRecord[]>([]);
    const [fleet, setFleet] = useState<FleetVehicle[]>([]);
    const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
    const [showNewTripModal, setShowNewTripModal] = useState(false);
    const [newTripForm, setNewTripForm] = useState({ truck: '', start_location_name: '', destination_name: '', start_time: '' });
    const [submittingTrip, setSubmittingTrip] = useState(false);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        const [t, tr, fd] = await Promise.all([getTrucks(), getTrips(), getFleetData()]);
        setTrucks(t);
        setTrips(tr);
        setFleet(fd);
        setLoading(false);
        setRefreshing(false);
    }, []);

    const handleCreateTrip = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTripForm.truck || !newTripForm.start_location_name || !newTripForm.destination_name || !newTripForm.start_time) return;
        setSubmittingTrip(true);
        const success = await createTrip(newTripForm);
        setSubmittingTrip(false);
        if (success) {
            setShowNewTripModal(false);
            setNewTripForm({ truck: '', start_location_name: '', destination_name: '', start_time: '' });
            fetchAll();
        } else {
            alert('Failed to create trip. Please try again.');
        }
    };

    useEffect(() => {
        // Initial load on mount — `loading` already defaults to true, so this
        // only synchronizes fleet data with the external API, not React state.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initial fetch, not a state-sync loop
        fetchAll();
        let interval: ReturnType<typeof setInterval>;
        const startPolling = () => {
            interval = setInterval(() => {
                if (!document.hidden) fetchAll(true);
            }, 2000);
        };
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchAll(true);
        };
        startPolling();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchAll]);

    const filteredTrucks = trucks.filter(t =>
        (t.license_plate || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.cargo_type || '').toLowerCase().includes(search.toLowerCase())
    );

    const tripStatuses = ['All', ...Array.from(new Set(trips.map(t => t.status)))];
    const filteredTrips = trips.filter(t => {
        const matchSearch = (t.truck?.license_plate || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.truck?.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.start_location_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.destination_name || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'All' || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <AuthGuard>
        <div className={styles.page}>
            {/* Header */}
            <motion.div variants={stagger} initial="hidden" animate="show" className={styles.header}>
                <motion.div variants={fadeUp} className={styles.headerLeft}>
                    <div className={styles.breadcrumb}><span>Dashboard</span><ChevronRight size={14} /><span>Fleet</span></div>
                    <h1 className={styles.title}>Fleet Registry</h1>
                    <p className={styles.subtitle}>
                        Showing <strong>{tab === 'trucks' ? filteredTrucks.length : filteredTrips.length}</strong> {tab} from the live database
                        {(trucks.length === 0 && trips.length === 0 && !loading) && (
                            <span className={styles.emptyHint}> — No data yet. Add trucks via Django Admin or the API.</span>
                        )}
                    </p>
                </motion.div>
                <motion.div variants={fadeUp} className={styles.headerRight} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        className={styles.searchInput}
                        placeholder={`Search ${tab}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button className={styles.refreshBtn} onClick={() => fetchAll(true)} disabled={refreshing} title="Refresh data">
                        <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
                    </button>
                    {canCreateTrip && tab === 'trips' && (
                        <button
                            className={styles.refreshBtn}
                            style={{ background: '#3b82f6', color: 'white', border: '1px solid #3b82f6', padding: '0 1rem', width: 'auto', fontWeight: 600, display: 'flex', gap: '6px' }}
                            onClick={() => setShowNewTripModal(true)}
                        >
                            <Plus size={16} /> New Trip
                        </button>
                    )}
                </motion.div>
            </motion.div>

            {/* Tabs */}
            <div className={styles.tabs}>
                {(['trucks', 'trips', 'map'] as Tab[]).map(t => (
                    <button
                        key={t}
                        className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                        onClick={() => { setTab(t); setSearch(''); setStatusFilter('All'); }}
                    >
                        {t === 'trucks' ? <Truck size={15} /> : t === 'trips' ? <Activity size={15} /> : <MapPin size={15} />}
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        <span className={styles.tabCount}>{t === 'trucks' ? trucks.length : t === 'trips' ? trips.length : fleet.length}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={styles.loader}>
                    <div className={styles.loaderRing} />
                    <span>Loading fleet data from database...</span>
                </div>
            ) : (
                <>
                    {/* ── FLEET ANALYTICS CHARTS ─── */}
                    {(trucks.length > 0 || trips.length > 0) && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.25rem',
                        }}>
                            {/* Trip Status Donut */}
                            {trips.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                                    <FleetStatusDonut
                                        statusCounts={trips.reduce((acc, t) => {
                                            acc[t.status] = (acc[t.status] || 0) + 1;
                                            return acc;
                                        }, {} as Record<string, number>)}
                                        title="Trip Status Breakdown"
                                        size={180}
                                    />
                                </div>
                            )}

                            {/* Truck status donut */}
                            {trucks.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                                    <FleetStatusDonut
                                        statusCounts={{
                                            'Active': trucks.filter(t => t.active).length,
                                            'Inactive': trucks.filter(t => !t.active).length,
                                        }}
                                        title="Truck Active Status"
                                        size={180}
                                    />
                                </div>
                            )}

                            {/* Trip risk scores bar */}
                            {trips.length > 0 && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1rem' }}>
                                    <RiskBars
                                        data={trips.slice(0, 8).map(t => ({
                                            label: t.truck?.license_plate || t.trip_id.substring(0, 8),
                                            score: Math.round(t.current_calculated_risk),
                                        }))}
                                        title="Trip Risk Scores"
                                        height={180}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TRUCKS TAB ─────────────────────────────────────────────── */}
                    <AnimatePresence mode="wait">
                        {tab === 'trucks' && (
                            <motion.div key="trucks" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                                {filteredTrucks.length === 0 ? (
                                    <div className={styles.empty}>
                                        <Truck size={48} opacity={0.2} />
                                        <h3>No trucks found</h3>
                                        <p>Add trucks via <a href="http://localhost:8000/admin" target="_blank" rel="noreferrer">Django Admin</a> or the API.</p>
                                    </div>
                                ) : (
                                    <div className={styles.grid}>
                                        {filteredTrucks.map(truck => (
                                            <motion.div key={truck.truck_id} variants={fadeUp} className={styles.card}>
                                                {/* Card header with plate */}
                                                <div className={styles.cardHeader}>
                                                    <div className={styles.plateTag}>
                                                        {truck.license_plate || 'No Plate'}
                                                    </div>
                                                    <span className={`${styles.statusChip} ${truck.active ? styles.chipActive : styles.chipInactive}`}>
                                                        {truck.active ? <><Wifi size={11} /> Active</> : 'Inactive'}
                                                    </span>
                                                </div>

                                                {/* Driver row */}
                                                <div className={styles.cardRow}>
                                                    <User size={14} className={styles.rowIcon} />
                                                    <div>
                                                        <div className={styles.rowLabel}>Driver</div>
                                                        <div className={styles.rowValue}>{truck.driver_name}</div>
                                                    </div>
                                                </div>
                                                {truck.driver_phone && (
                                                    <div className={styles.cardRow}>
                                                        <Shield size={14} className={styles.rowIcon} />
                                                        <div>
                                                            <div className={styles.rowLabel}>Contact</div>
                                                            <div className={styles.rowValue}>{truck.driver_phone}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Cargo */}
                                                <div className={styles.cardRow}>
                                                    <Package size={14} className={styles.rowIcon} />
                                                    <div>
                                                        <div className={styles.rowLabel}>Cargo Type</div>
                                                        <div className={styles.rowValue}>{truck.cargo_type}</div>
                                                    </div>
                                                </div>
                                                <div className={styles.cardRow}>
                                                    <DollarSign size={14} className={styles.rowIcon} />
                                                    <div>
                                                        <div className={styles.rowLabel}>Cargo Value</div>
                                                        <div className={styles.rowValue}>
                                                            ₹{Number(truck.cargo_value).toLocaleString('en-IN')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Vehicle */}
                                                {truck.vehicle_make_model && (
                                                    <div className={styles.cardRow}>
                                                        <Truck size={14} className={styles.rowIcon} />
                                                        <div>
                                                            <div className={styles.rowLabel}>Vehicle</div>
                                                            <div className={styles.rowValue}>{truck.vehicle_make_model}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Company */}
                                                {truck.company && (
                                                    <div className={styles.cardRow}>
                                                        <MapPin size={14} className={styles.rowIcon} />
                                                        <div>
                                                            <div className={styles.rowLabel}>Company</div>
                                                            <div className={styles.rowValue}>
                                                                {truck.company.name}{truck.company.city ? ` · ${truck.company.city}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {truck.iot_sensor_id && (
                                                    <div className={styles.sensorId}>
                                                        <Wifi size={11} /> IoT: {truck.iot_sensor_id}
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ─── TRIPS TAB ── */}
                        {tab === 'trips' && (
                            <motion.div key="trips" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                                {/* Status filter bar */}
                                <div className={styles.filterBar}>
                                    {tripStatuses.map(s => (
                                        <button
                                            key={s}
                                            className={`${styles.filterChip} ${statusFilter === s ? styles.filterChipActive : ''}`}
                                            onClick={() => setStatusFilter(s)}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>

                                {filteredTrips.length === 0 ? (
                                    <div className={styles.empty}>
                                        <Activity size={48} opacity={0.2} />
                                        <h3>No trips found</h3>
                                        <p>Create trips via <a href="http://localhost:8000/admin" target="_blank" rel="noreferrer">Django Admin</a> or the API.</p>
                                    </div>
                                ) : (
                                    <div className={styles.tripTable}>
                                        <div className={styles.tripTableHeader}>
                                            <span>Truck / Driver</span>
                                            <span>Route</span>
                                            <span>Status</span>
                                            <span>Risk</span>
                                            <span>Departure</span>
                                        </div>
                                        {filteredTrips.map(trip => {
                                            const ss = STATUS_STYLE[trip.status] || STATUS_STYLE.Scheduled;
                                            const rc = RISK_COLOR(trip.current_calculated_risk);
                                            return (
                                                <motion.div
                                                    key={trip.trip_id}
                                                    variants={fadeUp}
                                                    className={styles.tripRow}
                                                    onClick={() => setSelectedTrip(trip)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className={styles.tripTruck}>
                                                        <span className={styles.tripPlate}>{trip.truck.license_plate || '—'}</span>
                                                        <span className={styles.tripDriver}>{trip.truck.driver_name}</span>
                                                        <span className={styles.tripCargo}>{trip.truck.cargo_type}</span>
                                                    </div>
                                                    <div className={styles.tripRoute}>
                                                        <span>{trip.start_location_name}</span>
                                                        <ChevronRight size={12} className={styles.routeArrow} />
                                                        <span>{trip.destination_name}</span>
                                                    </div>
                                                    <div>
                                                        <span
                                                            className={styles.statusPill}
                                                            style={{ color: ss.color, background: ss.bg }}
                                                        >
                                                            {ss.label}
                                                        </span>
                                                    </div>
                                                    <div className={styles.riskCell}>
                                                        <div className={styles.riskBar}>
                                                            <div
                                                                className={styles.riskFill}
                                                                style={{ width: `${trip.current_calculated_risk}%`, background: rc }}
                                                            />
                                                        </div>
                                                        <span style={{ color: rc, fontWeight: 700, fontSize: '0.82rem' }}>
                                                            {Math.round(trip.current_calculated_risk)}
                                                        </span>
                                                    </div>
                                                    <div className={styles.tripTime}>
                                                        <Clock size={12} />
                                                        {trip.start_time ? new Date(trip.start_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ─── MAP TAB ── */}
                        {tab === 'map' && (
                            <motion.div key="map" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0 }} style={{ height: '70vh', minHeight: '500px', width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <GoogleMapComponent
                                    height="100%"
                                    markers={fleet.map(v => ({
                                        lat: v.location.lat,
                                        lng: v.location.lng,
                                        title: v.info.id,
                                        truckId: v.info.id,
                                        riskLevel: v.risk.level,
                                        riskScore: v.risk.score,
                                        status: v.status,
                                        route: v.info.route
                                    }))}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            {/* Trip Detail Modal */}
            <AnimatePresence>
                {selectedTrip && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelectedTrip(null)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.85)',
                            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px', width: '100%', maxWidth: '800px', overflow: 'hidden',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={18} style={{ color: '#3b82f6' }} /> Trip Detail: {selectedTrip.truck.license_plate || selectedTrip.truck.truck_id}
                                </h3>
                                <button
                                    onClick={() => setSelectedTrip(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, fontWeight: 700 }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1.25rem' }}>
                                <div>
                                    <p style={{ margin: '0 0 0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Route Details</p>
                                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b' }}>Origin:</span> <strong style={{ textAlign: 'right' }}>{selectedTrip.start_location_name}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b' }}>Destination:</span> <strong style={{ textAlign: 'right' }}>{selectedTrip.destination_name}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Departure:</span> <strong>{new Date(selectedTrip.start_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</strong>
                                        </div>
                                    </div>

                                    <p style={{ margin: '1rem 0 0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Cargo & Risk</p>
                                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b' }}>Cargo:</span> <strong style={{ textAlign: 'right' }}>{selectedTrip.truck.cargo_type}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b' }}>Value:</span> <strong>₹{selectedTrip.truck.cargo_value.toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Risk Score:</span> <strong style={{ color: RISK_COLOR(selectedTrip.current_calculated_risk) }}>{Math.round(selectedTrip.current_calculated_risk)}/100</strong>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
                                        <Link href={`/live-monitoring?trip=${selectedTrip.trip_id}`} className={styles.actionBtnPrimary} style={{ flex: 1, padding: '0.6rem', textAlign: 'center', background: '#3b82f6', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
                                            Journey Report
                                        </Link>
                                    </div>
                                </div>
                                <div style={{ background: '#0f172a', borderRadius: '8px', overflow: 'hidden', minHeight: '260px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {fleet.find(f => f.trip_id === selectedTrip.trip_id)?.location ? (
                                        <GoogleMapComponent
                                            height="100%"
                                            center={fleet.find(f => f.trip_id === selectedTrip.trip_id)!.location}
                                            zoom={13}
                                            markers={[{
                                                lat: fleet.find(f => f.trip_id === selectedTrip.trip_id)!.location.lat,
                                                lng: fleet.find(f => f.trip_id === selectedTrip.trip_id)!.location.lng,
                                                title: selectedTrip.truck.truck_id,
                                                riskLevel: selectedTrip.current_calculated_risk >= 80 ? 'Critical' : selectedTrip.current_calculated_risk >= 60 ? 'High' : selectedTrip.current_calculated_risk >= 40 ? 'Medium' : 'Low',
                                                riskScore: selectedTrip.current_calculated_risk
                                            }]}
                                        />
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                                            <MapPin size={32} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                                            <p style={{ margin: 0, fontSize: '0.85rem' }}>No live telemetry available<br />for this trip segment.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* New Trip Modal */}
            <AnimatePresence>
                {showNewTripModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowNewTripModal(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.85)',
                            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px', width: '100%', maxWidth: '500px', overflow: 'hidden',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Plus size={18} style={{ color: '#3b82f6' }} /> Create New Trip
                                </h3>
                                <button
                                    onClick={() => setShowNewTripModal(false)}
                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, fontWeight: 700 }}
                                >
                                    ✕
                                </button>
                            </div>
                            <form onSubmit={handleCreateTrip} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Truck</label>
                                    <select
                                        required
                                        value={newTripForm.truck}
                                        onChange={e => setNewTripForm({ ...newTripForm, truck: e.target.value })}
                                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', color: 'white', outline: 'none' }}
                                    >
                                        <option value="">-- Choose Truck --</option>
                                        {trucks.filter(t => t.active).map(t => (
                                            <option key={t.truck_id} value={t.truck_id}>{t.license_plate} - {t.driver_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Origin Location Name</label>
                                    <input
                                        required type="text" placeholder="e.g. Mumbai Port"
                                        value={newTripForm.start_location_name}
                                        onChange={e => setNewTripForm({ ...newTripForm, start_location_name: e.target.value })}
                                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', color: 'white', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Destination Name</label>
                                    <input
                                        required type="text" placeholder="e.g. Delhi Hub"
                                        value={newTripForm.destination_name}
                                        onChange={e => setNewTripForm({ ...newTripForm, destination_name: e.target.value })}
                                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', color: 'white', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Est. Departure Time</label>
                                    <input
                                        required type="datetime-local"
                                        value={newTripForm.start_time}
                                        onChange={e => setNewTripForm({ ...newTripForm, start_time: e.target.value })}
                                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', color: 'white', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" onClick={() => setShowNewTripModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem 1rem' }}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={submittingTrip} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, cursor: submittingTrip ? 'not-allowed' : 'pointer', opacity: submittingTrip ? 0.7 : 1 }}>
                                        {submittingTrip ? 'Submitting...' : 'Create Trip'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
        </AuthGuard>
    );
}
