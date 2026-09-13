'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './Navbar.module.css';
import { getAlerts } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Menu, X, Bell, LogOut, User, ChevronDown, Shield } from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, user, logout } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [criticalCount, setCriticalCount] = useState(0);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    // Fetch alert count badge — only when authenticated
    useEffect(() => {
        if (!isAuthenticated) return;
        let cancelled = false;
        async function fetchCount() {
            const alerts = await getAlerts();
            if (cancelled) return;
            const high = alerts.filter(a => a.level === 'Critical' || a.level === 'High').length;
            setCriticalCount(high);
        }
        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [isAuthenticated]);

    // Badge is only meaningful while signed in — derive at render time
    // instead of resetting state from the effect above.
    const displayCriticalCount = isAuthenticated ? criticalCount : 0;

    const handleLogout = async () => {
        await logout();
        setUserMenuOpen(false);
        setMobileOpen(false);
        router.push('/login');
    };

    const navLinks = [
        { href: '/', label: 'Home' },
        ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin Panel' }] : []),
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/fleet', label: 'Fleet' },
        { href: '/live-monitoring', label: 'Journey Report' },
        { href: '/risk-analysis', label: 'Risk Analysis' },
        { href: '/alerts', label: 'Alerts' },
    ];

    // Hide nav links on the login page
    const isLoginPage = pathname === '/login';

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname.startsWith(href);

    const roleLabel = (role?: string) => {
        if (role === 'admin') return 'Platform Admin';
        if (role === 'company_user') return 'Fleet Manager';
        if (role === 'viewer') return 'Viewer';
        return role ?? '';
    };

    if (isLoginPage) {
        return null;
    }

    return (
        <nav className={styles.navbar}>
            {/* Logo */}
            <Link href="/" className={styles.logoContainer} aria-label="RAKSHAK AI Home">
                <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="white" /></div>
                <span className={styles.logoText}>RAKSHAK AI</span>
            </Link>

            {/* Desktop Links — hidden on login page */}
            {!isLoginPage && (
                <div className={styles.navLinks}>
                    {navLinks.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.navLink} ${isActive(href) ? styles.activeLink : ''}`}
                            aria-current={isActive(href) ? 'page' : undefined}
                        >
                            {label}
                            {href === '/alerts' && displayCriticalCount > 0 && (
                                <span className={styles.alertBadge} aria-label={`${displayCriticalCount} high-priority alerts`}>
                                    {displayCriticalCount}
                                </span>
                            )}
                            {isActive(href) && <span className={styles.activeDot} />}
                        </Link>
                    ))}
                </div>
            )}

            {/* Right side — auth controls */}
            <div className={styles.navRight}>
                {isAuthenticated && user ? (
                    /* ── User menu dropdown ─────────────────────────────────── */
                    <div className={styles.userMenuWrap}>
                        {displayCriticalCount > 0 && (
                            <Link href="/alerts" className={styles.bellBtn} aria-label="Alerts">
                                <Bell size={18} />
                                <span className={styles.bellBadge}>{displayCriticalCount}</span>
                            </Link>
                        )}
                        <button
                            className={styles.userBtn}
                            onClick={() => setUserMenuOpen(v => !v)}
                            aria-expanded={userMenuOpen}
                            aria-label="User menu"
                        >
                            <div className={styles.userAvatar}>
                                {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                            </div>
                            <div className={styles.userInfo}>
                                <span className={styles.userName}>{user.first_name || user.username}</span>
                                <span className={styles.userRole}>{roleLabel(user.role)}</span>
                            </div>
                            <ChevronDown size={14} className={`${styles.chevron} ${userMenuOpen ? styles.chevronOpen : ''}`} />
                        </button>

                        {userMenuOpen && (
                            <div className={styles.userDropdown}>
                                <div className={styles.dropdownHeader}>
                                    <p className={styles.dropdownName}>{user.username}</p>
                                    <p className={styles.dropdownRole}>{roleLabel(user.role)}</p>
                                </div>
                                <hr className={styles.dropdownDivider} />
                                <button className={styles.dropdownItem} onClick={handleLogout}>
                                    <LogOut size={14} /> Sign out
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Login button ─────────────────────────────────────── */
                    !isLoginPage && (
                        <Link href="/login" className={styles.loginBtn}>
                            <User size={15} /> Sign In
                        </Link>
                    )
                )}

                {/* Mobile hamburger — hidden on login page */}
                {!isLoginPage && (
                    <button
                        className={styles.hamburger}
                        onClick={() => setMobileOpen(v => !v)}
                        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileOpen}
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                        {displayCriticalCount > 0 && !mobileOpen && (
                            <span className={styles.hamburgerBadge}>{displayCriticalCount}</span>
                        )}
                    </button>
                )}
            </div>

            {/* Mobile Dropdown */}
            {mobileOpen && (
                <div className={styles.mobileMenu}>
                    {navLinks.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className={`${styles.mobileLink} ${isActive(href) ? styles.mobileLinkActive : ''}`}
                            onClick={() => setMobileOpen(false)}
                            aria-current={isActive(href) ? 'page' : undefined}
                        >
                            {label}
                            {href === '/alerts' && displayCriticalCount > 0 && (
                                <span className={styles.alertBadge}>{displayCriticalCount}</span>
                            )}
                        </Link>
                    ))}
                    {isAuthenticated && (
                        <button className={styles.mobileLogout} onClick={handleLogout}>
                            <LogOut size={14} /> Sign out
                        </button>
                    )}
                    {!isAuthenticated && (
                        <Link href="/login" className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                            Sign In
                        </Link>
                    )}
                </div>
            )}
        </nav>
    );
}
