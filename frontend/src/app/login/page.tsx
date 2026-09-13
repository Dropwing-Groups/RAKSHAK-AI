'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, RegisterCompanyPayload } from '@/context/AuthContext';
import { Eye, EyeOff, Shield, Building2, User, Lock, Mail, ArrowRight, Loader2, Zap } from 'lucide-react';

type Mode = 'login' | 'register';

export default function AuthPage() {
    const { login, registerCompany, isAuthenticated } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<Mode>('login');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    // Login fields
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });

    // Register fields
    const [regForm, setRegForm] = useState<RegisterCompanyPayload>({
        company_name: '', company_city: '', username: '',
        password: '', email: '', first_name: '', last_name: '',
    });

    // Redirect if already logged in
    useEffect(() => {
        if (isAuthenticated) {
            const redirect = searchParams.get('redirect') || '/dashboard';
            router.replace(redirect);
        }
    }, [isAuthenticated, router, searchParams]);

    // ── Login submit ─────────────────────────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!loginForm.username || !loginForm.password) {
            setError('Username and password are required.');
            return;
        }
        setBusy(true);
        const result = await login(loginForm.username, loginForm.password);
        setBusy(false);
        if (!result.ok) setError(result.error || 'Login failed.');
        // redirect handled by useEffect above
    };

    const handleTestLogin = async () => {
        setLoginForm({ username: 'admin', password: 'Rakshak@123' }); // Updated credentials
        setError('');
        setBusy(true);
        const result = await login('admin', 'Rakshak@123');
        setBusy(false);
        if (!result.ok) setError(result.error || 'Test Login failed. Ensure "admin" exists with "Rakshak@123" or replace these credentials.');
    };

    // ── Register submit ──────────────────────────────────────────────────────────
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const { company_name, username, password, email } = regForm;
        if (!company_name || !username || !password || !email) {
            setError('Company name, username, email and password are required.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setBusy(true);
        const result = await registerCompany(regForm);
        setBusy(false);
        if (!result.ok) setError(result.error || 'Registration failed.');
    };

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 relative">
            {/* Left panel — branding */}
            <div className="hidden md:flex flex-col flex-1 max-w-[48%] items-center justify-center p-12 bg-white border-r border-slate-200 relative overflow-hidden shadow-sm">

                {/* Background decorative mesh/gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_30%_40%,rgba(14,165,233,0.05)_0%,transparent_70%),radial-gradient(ellipse_40%_40%_at_80%_80%,rgba(16,185,129,0.03)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 max-w-md w-full">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-md">
                            <Shield size={26} />
                        </div>
                        <span className="text-xl font-bold tracking-widest text-slate-800 uppercase">RAKSHAK AI</span>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-5">
                        Predictive Cargo<br />
                        <span className="text-sky-600 bg-clip-text">Security Intelligence</span>
                    </h1>

                    <p className="text-lg text-slate-600 leading-relaxed mb-10">
                        AI-powered multi-agent platform that fuses computer vision,
                        geospatial analytics, and behavioural AI to prevent cargo theft
                        before it happens.
                    </p>

                    <div className="flex gap-6 mb-10 p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-1">
                            <strong className="text-2xl font-bold text-sky-600">99.2%</strong>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detection Rate</span>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="flex flex-col gap-1">
                            <strong className="text-2xl font-bold text-emerald-600">&lt;50ms</strong>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vision Latency</span>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="flex flex-col gap-1">
                            <strong className="text-2xl font-bold text-amber-500">₹2.5B+</strong>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo Secured</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['YOLO Vision', 'DeepSort Tracker', 'IsolationForest', 'Shapely Geofence', 'Risk Fusion', 'LLM Explainer'].map(a => (
                            <span key={a} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow hover:border-sky-200">{a}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
                <div className="w-full max-w-[460px]">

                    {/* Mode switcher tabs */}
                    <div className="flex bg-white shadow-sm border border-slate-200 rounded-xl p-1 mb-8">
                        <button
                            className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'login' ? 'bg-slate-50 text-sky-600 shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            onClick={() => { setMode('login'); setError(''); }}
                        >
                            <User size={16} /> Sign In
                        </button>
                        <button
                            className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'register' ? 'bg-slate-50 text-sky-600 shadow border border-slate-200/60' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            onClick={() => { setMode('register'); setError(''); }}
                        >
                            <Building2 size={16} /> Register
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xl shadow-slate-200/50 relative overflow-hidden">

                        {/* ── LOGIN FORM ─────────────────────────────────────────────────── */}
                        {mode === 'login' && (
                            <form onSubmit={handleLogin} className="flex flex-col gap-5" autoComplete="on">
                                <div className="text-center mb-2">
                                    <div className="mx-auto w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mb-4">
                                        <Shield size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
                                    <p className="text-sm text-slate-500">Sign in to your RAKSHAK command centre</p>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="login-username" className="text-xs font-bold text-slate-600 tracking-wide uppercase">Username</label>
                                    <div className="relative flex items-center">
                                        <User size={18} className="absolute left-3.5 text-slate-400" />
                                        <input
                                            id="login-username"
                                            type="text"
                                            placeholder="admin"
                                            autoComplete="username"
                                            value={loginForm.username}
                                            onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="login-password" className="text-xs font-bold text-slate-600 tracking-wide uppercase">Password</label>
                                        <span className="text-xs text-sky-600 font-semibold cursor-pointer hover:underline">Forgot?</span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <Lock size={18} className="absolute left-3.5 text-slate-400" />
                                        <input
                                            id="login-password"
                                            type={showPw ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            value={loginForm.password}
                                            onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400"
                                        />
                                        <button type="button" className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center font-medium shadow-sm">{error}</div>}

                                <button type="submit" className="mt-2 w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group" disabled={busy} id="login-submit-btn">
                                    {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                                    {busy ? 'Verifying Credentials…' : 'Authenticate Identity'}
                                </button>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-slate-200"></div>
                                    <span className="flex-shrink-0 mx-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">Demo Access</span>
                                    <div className="flex-grow border-t border-slate-200"></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleTestLogin}
                                    disabled={busy}
                                    className="w-full py-3 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                >
                                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-sky-500 text-sky-500" />}
                                    Quick Login as Test User
                                </button>
                            </form>
                        )}

                        {/* ── REGISTER FORM ──────────────────────────────────────────────── */}
                        {mode === 'register' && (
                            <form onSubmit={handleRegister} className="flex flex-col gap-4" autoComplete="on">
                                <div className="text-center mb-2">
                                    <div className="mx-auto w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mb-4">
                                        <Building2 size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Register Company</h2>
                                    <p className="text-sm text-slate-500">Free demo enterprise account setup</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="reg-company-name" className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">Company <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <input id="reg-company-name" type="text" placeholder="Acme Corp"
                                                value={regForm.company_name}
                                                onChange={e => setRegForm(f => ({ ...f, company_name: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="reg-company-city" className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">City</label>
                                        <div className="relative flex items-center">
                                            <input id="reg-company-city" type="text" placeholder="Mumbai"
                                                value={regForm.company_city}
                                                onChange={e => setRegForm(f => ({ ...f, company_city: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label htmlFor="reg-email" className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">Email <span className="text-red-500">*</span></label>
                                    <div className="relative flex items-center">
                                        <Mail size={16} className="absolute left-3 text-slate-400" />
                                        <input id="reg-email" type="email" placeholder="admin@acme.com"
                                            autoComplete="email"
                                            value={regForm.email}
                                            onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="reg-username" className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">Username <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <User size={16} className="absolute left-3 text-slate-400" />
                                            <input id="reg-username" type="text" placeholder="admin"
                                                autoComplete="username"
                                                value={regForm.username}
                                                onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
                                                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="reg-password" className="text-[11px] font-bold text-slate-600 tracking-wider uppercase">Password <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <Lock size={16} className="absolute left-3 text-slate-400" />
                                            <input id="reg-password" type={showPw ? 'text' : 'password'} placeholder="Min 8 chars"
                                                autoComplete="new-password"
                                                value={regForm.password}
                                                onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                                                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder-slate-400" />
                                            <button type="button" className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center font-medium shadow-sm">{error}</div>}

                                <button type="submit" className="mt-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group" disabled={busy} id="register-submit-btn">
                                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Building2 size={18} className="group-hover:scale-110 transition-transform" />}
                                    {busy ? 'Creating Enterprise Instance…' : 'Deploy Command Centre'}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="mt-8 text-center">
                        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-sky-600 transition-colors">
                            <ArrowRight size={14} className="rotate-180" /> Back to Operations Control
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
