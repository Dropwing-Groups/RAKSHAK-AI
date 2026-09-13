'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
    username: string;
    email: string;
    role: 'admin' | 'company_user' | 'viewer';
    first_name?: string;
    last_name?: string;
}

export interface AuthCompany {
    company_id: string;
    name: string;
    city?: string;
}

interface AuthState {
    token: string | null;
    user: AuthUser | null;
    company: AuthCompany | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextValue extends AuthState {
    login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
    registerCompany: (data: RegisterCompanyPayload) => Promise<{ ok: boolean; error?: string }>;
    logout: () => Promise<void>;
}

export interface RegisterCompanyPayload {
    company_name: string;
    company_city: string;
    username: string;
    password: string;
    email: string;
    first_name: string;
    last_name: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'rakshak_token';
const USER_KEY = 'rakshak_user';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        token: null,
        user: null,
        company: null,
        isAuthenticated: false,
        isLoading: true,      // start true — we check localStorage first
    });

    // ── Restore session from localStorage on mount ──────────────────────────────
    // Intentionally synchronous: localStorage only exists in the browser, so this
    // one-time hydration can't be done during the initial (possibly server) render.
    useEffect(() => {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        if (storedToken && storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration, not a state sync loop
                setState({ token: storedToken, user: parsedUser, company: null, isAuthenticated: true, isLoading: false });
            } catch {
                setState(s => ({ ...s, isLoading: false }));
            }
        } else {
            setState(s => ({ ...s, isLoading: false }));
        }
    }, []);

    // ── Login ───────────────────────────────────────────────────────────────────
    const login = useCallback(async (username: string, password: string) => {
        try {
            const res = await fetch(`${API_BASE}/auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                return { ok: false, error: data.error || 'Invalid credentials.' };
            }

            const token: string = data.token;
            const user: AuthUser = data.user;
            const company: AuthCompany = data.company;

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));

            setState({ token, user, company, isAuthenticated: true, isLoading: false });
            return { ok: true };
        } catch {
            return { ok: false, error: 'Cannot reach server. Is the backend running?' };
        }
    }, []);

    // ── Register Company ─────────────────────────────────────────────────────────
    const registerCompany = useCallback(async (payload: RegisterCompanyPayload) => {
        try {
            const res = await fetch(`${API_BASE}/auth/register-company/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (!res.ok) {
                return { ok: false, error: data.error || 'Registration failed.' };
            }

            const token: string = data.token;
            const user: AuthUser = data.user;
            const company: AuthCompany = data.company;

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));

            setState({ token, user, company, isAuthenticated: true, isLoading: false });
            return { ok: true };
        } catch {
            return { ok: false, error: 'Cannot reach server. Is the backend running?' };
        }
    }, []);

    // ── Logout ───────────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        const token = state.token;
        if (token) {
            try {
                await fetch(`${API_BASE}/auth/logout/`, {
                    method: 'POST',
                    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
                });
            } catch { /* ignore network errors */ }
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ token: null, user: null, company: null, isAuthenticated: false, isLoading: false });
    }, [state.token]);

    return (
        <AuthContext.Provider value={{ ...state, login, registerCompany, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
}
