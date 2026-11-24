import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

type TargetKind = 'domain' | 'ip';
type TargetStatus = 'healthy' | 'degraded' | 'critical';
type ThreatSeverity = 'low' | 'medium' | 'high';

interface SecurityEvent {
    id: string;
    timestamp: string;
    target: string;
    severity: ThreatSeverity;
    category: string;
    summary: string;
    mitigation: string;
}

interface MonitoredTarget {
    id: string;
    label: string;
    host: string;
    kind: TargetKind;
    status: TargetStatus;
    uptime: number;
    latencyMs: number;
    p95Ms: number;
    httpStatus: string;
    sslDaysRemaining: number | null;
    tlsVersion: string;
    monitoredPorts: string;
    threatScore: number;
    lastChecked: string;
    region: string;
    history: number[];
    recentFindings: string[];
}

const INITIAL_TARGETS: MonitoredTarget[] = [
    {
        id: 'tgt-1',
        label: 'Core Web Portal',
        host: 'alfreinsco.com',
        kind: 'domain',
        status: 'healthy',
        uptime: 99.98,
        latencyMs: 42,
        p95Ms: 88,
        httpStatus: '200 OK',
        sslDaysRemaining: 64,
        tlsVersion: 'TLS 1.3',
        monitoredPorts: '80, 443',
        threatScore: 6,
        lastChecked: 'Just now',
        region: 'SIN-Edge',
        history: [45, 41, 44, 39, 43, 40, 42],
        recentFindings: [
            'HSTS & strict CSP headers active',
            'Zero anomalous 5xx bursts in last 60m',
        ],
    },
    {
        id: 'tgt-2',
        label: 'Edge Gateway Node',
        host: '103.184.22.14',
        kind: 'ip',
        status: 'degraded',
        uptime: 99.64,
        latencyMs: 164,
        p95Ms: 245,
        httpStatus: 'TCP/443 Open',
        sslDaysRemaining: null,
        tlsVersion: 'N/A (Raw IP)',
        monitoredPorts: '22, 80, 443',
        threatScore: 48,
        lastChecked: '2s ago',
        region: 'CGK-DC1',
        history: [78, 92, 118, 134, 152, 170, 164],
        recentFindings: [
            'Elevated RTT jitter on upstream transit',
            'Repeated SSH auth probes rate-limited at edge',
        ],
    },
    {
        id: 'tgt-3',
        label: 'Payment & Webhook API',
        host: 'api.codedaritimur.com',
        kind: 'domain',
        status: 'healthy',
        uptime: 99.95,
        latencyMs: 56,
        p95Ms: 102,
        httpStatus: '200 OK',
        sslDaysRemaining: 49,
        tlsVersion: 'TLS 1.3',
        monitoredPorts: '443',
        threatScore: 11,
        lastChecked: 'Just now',
        region: 'SIN-Edge',
        history: [58, 55, 61, 53, 57, 54, 56],
        recentFindings: [
            'Webhook signature validation nominal',
            'Rate-limit quota headroom at 74%',
        ],
    },
    {
        id: 'tgt-4',
        label: 'Internal Telemetry Host',
        host: '172.16.40.19',
        kind: 'ip',
        status: 'critical',
        uptime: 98.12,
        latencyMs: 318,
        p95Ms: 490,
        httpStatus: '503 / Timeout',
        sslDaysRemaining: null,
        tlsVersion: 'Self-Signed / Internal',
        monitoredPorts: '443, 8443',
        threatScore: 84,
        lastChecked: '1s ago',
        region: 'Private-LAN',
        history: [85, 110, 165, 220, 275, 340, 318],
        recentFindings: [
            'Spike in malformed POST payloads on /ingest',
            'Response latency exceeded 250ms threshold',
        ],
    },
];

const INITIAL_EVENTS: SecurityEvent[] = [
    {
        id: 'evt-101',
        timestamp: '03:43:58',
        target: '172.16.40.19',
        severity: 'high',
        category: 'Anomaly & Latency',
        summary: 'Lonjakan request anomali & p95 latency 490ms terdeteksi',
        mitigation: 'Aktifkan throttling ketat pada endpoint ingest & periksa log reverse proxy.',
    },
    {
        id: 'evt-102',
        timestamp: '03:43:41',
        target: '103.184.22.14',
        severity: 'medium',
        category: 'Auth Probe',
        summary: 'Percobaan koneksi berulang pada port 22 diblokir firewall',
        mitigation: 'Pastikan akses SSH dibatasi ke IP/VPN tepercaya dan key-only aktif.',
    },
    {
        id: 'evt-103',
        timestamp: '03:43:19',
        target: 'api.codedaritimur.com',
        severity: 'low',
        category: 'TLS Audit',
        summary: 'Sertifikat TLS 1.3 valid (49 hari tersisa), cipher suite kuat',
        mitigation: 'Jadwalkan auto-renewal otomatis saat tersisa kurang dari 21 hari.',
    },
];

function normalizeTargetInput(raw: string): { host: string; kind: TargetKind } | null {
    const trimmed = raw
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .toLowerCase();

    if (!trimmed) {
        return null;
    }

    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    const domainRegex = /^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

    if (ipv4Regex.test(trimmed)) {
        return { host: trimmed, kind: 'ip' };
    }

    if (domainRegex.test(trimmed)) {
        return { host: trimmed, kind: 'domain' };
    }

    return null;
}

function statusBadgeClasses(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'degraded':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'critical':
            return 'bg-rose-50 text-rose-700 border-rose-200';
    }
}

function statusDotClasses(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'bg-emerald-500';
        case 'degraded':
            return 'bg-amber-500';
        case 'critical':
            return 'bg-rose-500';
    }
}

function severityBadgeClasses(severity: ThreatSeverity): string {
    switch (severity) {
        case 'high':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'medium':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'low':
            return 'bg-sky-50 text-sky-700 border-sky-200';
    }
}

export default function Welcome() {
    const [targets, setTargets] = useState<MonitoredTarget[]>(INITIAL_TARGETS);
    const [events, setEvents] = useState<SecurityEvent[]>(INITIAL_EVENTS);
    const [selectedId, setSelectedId] = useState<string>(INITIAL_TARGETS[0].id);
    const [statusFilter, setStatusFilter] = useState<'all' | TargetStatus>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [liveStream, setLiveStream] = useState<boolean>(true);
    const [redactSensitive, setRedactSensitive] = useState<boolean>(true);

    // Form pendaftaran domain / IP baru
    const [newLabel, setNewLabel] = useState<string>('');
    const [newTarget, setNewTarget] = useState<string>('');
    const [newPorts, setNewPorts] = useState<string>('80, 443');
    const [newRegion, setNewRegion] = useState<string>('SIN-Edge');
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!liveStream) {
            return;
        }

        const timer = window.setInterval(() => {
            setTargets((prev) =>
                prev.map((item) => {
                    const delta = Math.round((Math.random() - 0.48) * 14);
                    const nextLatency = Math.max(18, item.latencyMs + delta);
                    const nextP95 = Math.max(nextLatency + 24, item.p95Ms + Math.round(delta * 1.2));
                    const nextHistory = [...item.history.slice(1), nextLatency];

                    let nextStatus: TargetStatus = item.status;
                    if (item.id !== 'tgt-4') {
                        if (nextLatency > 220) {
                            nextStatus = 'critical';
                        } else if (nextLatency > 135) {
                            nextStatus = 'degraded';
                        } else {
                            nextStatus = 'healthy';
                        }
                    }

                    return {
                        ...item,
                        latencyMs: nextLatency,
                        p95Ms: nextP95,
                        status: nextStatus,
                        lastChecked: 'Live',
                        history: nextHistory,
                    };
                }),
            );
        }, 2500);

        return () => window.clearInterval(timer);
    }, [liveStream]);

    const selectedTarget = useMemo(
        () => targets.find((t) => t.id === selectedId) ?? targets[0],
        [targets, selectedId],
    );

    const filteredTargets = useMemo(() => {
        return targets.filter((t) => {
            const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
            const q = searchQuery.trim().toLowerCase();
            const matchesQuery =
                !q ||
                t.label.toLowerCase().includes(q) ||
                t.host.toLowerCase().includes(q) ||
                t.region.toLowerCase().includes(q);
            return matchesStatus && matchesQuery;
        });
    }, [targets, statusFilter, searchQuery]);

    const summary = useMemo(() => {
        const total = targets.length;
        const healthy = targets.filter((t) => t.status === 'healthy').length;
        const degraded = targets.filter((t) => t.status === 'degraded').length;
        const critical = targets.filter((t) => t.status === 'critical').length;
        const avgLatency =
            total > 0
                ? Math.round(targets.reduce((acc, t) => acc + t.latencyMs, 0) / total)
                : 0;
        const avgUptime =
            total > 0
                ? (targets.reduce((acc, t) => acc + t.uptime, 0) / total).toFixed(2)
                : '100.00';
        const highRiskCount = targets.filter((t) => t.threatScore >= 50).length;
        const domainCount = targets.filter((t) => t.kind === 'domain').length;

        return {
            total,
            healthy,
            degraded,
            critical,
            avgLatency,
            avgUptime,
            highRiskCount,
            domainCount,
        };
    }, [targets]);

    function handleRegisterTarget(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(null);

        const parsed = normalizeTargetInput(newTarget);
        if (!parsed) {
            setFormError(
                'Masukkan nama domain valid (contoh: portal.example.com) atau alamat IPv4 valid (contoh: 103.184.22.50).',
            );
            return;
        }

        const alreadyExists = targets.some(
            (t) => t.host.toLowerCase() === parsed.host.toLowerCase(),
        );
        if (alreadyExists) {
            setFormError(`Target ${parsed.host} sudah terdaftar dalam pantauan aktif.`);
            return;
        }

        const initialLatency = parsed.kind === 'domain' ? 48 : 36;
        const created: MonitoredTarget = {
            id: `tgt-${Date.now()}`,
            label:
                newLabel.trim() ||
                (parsed.kind === 'domain' ? `Web ${parsed.host}` : `Host ${parsed.host}`),
            host: parsed.host,
            kind: parsed.kind,
            status: 'healthy',
            uptime: 100.0,
            latencyMs: initialLatency,
            p95Ms: initialLatency + 34,
            httpStatus: parsed.kind === 'domain' ? '200 OK' : 'ICMP / TCP Active',
            sslDaysRemaining: parsed.kind === 'domain' ? 82 : null,
            tlsVersion: parsed.kind === 'domain' ? 'TLS 1.3' : 'Raw IP Probe',
            monitoredPorts: newPorts.trim() || (parsed.kind === 'domain' ? '80, 443' : '443'),
            threatScore: 8,
            lastChecked: 'Just registered',
            region: newRegion,
            history: [52, 49, 51, 47, 50, 46, initialLatency],
            recentFindings: [
                `Initial probe registered for ${parsed.host}`,
                'Baseline security & latency profile initialized',
            ],
        };

        const nowTime = new Date().toTimeString().slice(0, 8);
        const newEvt: SecurityEvent = {
            id: `evt-${Date.now()}`,
            timestamp: nowTime,
            target: parsed.host,
            severity: 'low',
            category: 'Target Enrolled',
            summary: `Target ${parsed.kind.toUpperCase()} baru (${parsed.host}) mulai dipantau real-time`,
            mitigation: 'Verifikasi aturan firewall & alert threshold sesuai tingkat kekritisan aset.',
        };

        setTargets((prev) => [created, ...prev]);
        setEvents((prev) => [newEvt, ...prev.slice(0, 14)]);
        setSelectedId(created.id);
        setNewLabel('');
        setNewTarget('');
        setFormSuccess(`${parsed.host} berhasil didaftarkan ke antrean monitoring real-time.`);
    }

    function formatHostDisplay(target: MonitoredTarget): string {
        if (!redactSensitive || target.kind !== 'ip') {
            return target.host;
        }
        const parts = target.host.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.xxx.${parts[3]}`;
        }
        return target.host;
    }

    return (
        <>
            <Head title="SentinelGrid — Realtime App, Web & Security Monitoring" />
            <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-100 selection:text-sky-900">
                {/* Top Operational Header */}
                <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9 12l2 2 4-4"
                                    />
                                </svg>
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h1 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                                        SentinelGrid SOC &amp; App Monitor
                                    </h1>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                                        <span
                                            className={`h-2 w-2 rounded-full ${liveStream ? 'animate-pulse bg-sky-500' : 'bg-slate-400'}`}
                                        />
                                        {liveStream ? 'Realtime Active' : 'Paused'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Pemantauan ketersediaan aplikasi, latensi endpoint, TLS, dan anomali keamanan domain &amp; IP
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setRedactSensitive((prev) => !prev)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50/50"
                            >
                                <span>{redactSensitive ? 'IP Masking: ON' : 'IP Masking: OFF'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLiveStream((prev) => !prev)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                    liveStream
                                        ? 'border border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
                                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span>{liveStream ? 'Pause Stream' : 'Resume Stream'}</span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                    {/* Register Domain or IP Bar */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">
                                    Daftarkan Domain atau IP untuk Dipantau
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Tambahkan domain HTTPS atau alamat IPv4 host agar langsung masuk ke siklus pengecekan latensi, port, dan keamanan.
                                </p>
                            </div>
                            <span className="font-mono text-xs text-slate-500">
                                {summary.total} targets enrolled
                            </span>
                        </div>

                        <form
                            onSubmit={handleRegisterTarget}
                            className="grid grid-cols-1 gap-3 md:grid-cols-12"
                        >
                            <div className="md:col-span-4">
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                    Domain atau Alamat IP
                                </label>
                                <input
                                    type="text"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(e.target.value)}
                                    placeholder="contoh: app.domainanda.id atau 103.184.22.80"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                                />
                            </div>

                            <div className="md:col-span-3">
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                    Nama Layanan / Label
                                </label>
                                <input
                                    type="text"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    placeholder="contoh: Production API"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                    Port Pantauan
                                </label>
                                <input
                                    type="text"
                                    value={newPorts}
                                    onChange={(e) => setNewPorts(e.target.value)}
                                    placeholder="80, 443"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                                />
                            </div>

                            <div className="md:col-span-1">
                                <label className="mb-1 block text-xs font-medium text-slate-700">
                                    Probe
                                </label>
                                <select
                                    value={newRegion}
                                    onChange={(e) => setNewRegion(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                                >
                                    <option value="SIN-Edge">SIN</option>
                                    <option value="CGK-DC1">CGK</option>
                                    <option value="Private-LAN">LAN</option>
                                </select>
                            </div>

                            <div className="flex items-end md:col-span-2">
                                <button
                                    type="submit"
                                    className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-sky-700 focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                                >
                                    + Daftarkan
                                </button>
                            </div>
                        </form>

                        {formError && (
                            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                                {formError}
                            </p>
                        )}
                        {formSuccess && (
                            <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
                                {formSuccess}
                            </p>
                        )}
                    </section>

                    {/* KPI Summary Cards */}
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    Global Uptime
                                </span>
                                <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs font-medium text-sky-700">
                                    {summary.healthy}/{summary.total} UP
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                                {summary.avgUptime}%
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {summary.degraded} degraded · {summary.critical} critical
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    Avg Response RTT
                                </span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                                    LIVE
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                                {summary.avgLatency} ms
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Puncak p95: {Math.max(...targets.map((t) => t.p95Ms), 0)} ms
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    Security Risk Alerts
                                </span>
                                <span className="rounded-md bg-rose-50 px-2 py-0.5 font-mono text-xs font-medium text-rose-700">
                                    SOC
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                                {summary.highRiskCount} Elevated
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                Pemantauan anomali trafik, brute-force &amp; port probe
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    TLS &amp; Domain Assets
                                </span>
                                <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono text-xs font-medium text-sky-700">
                                    TLS 1.3
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                                {summary.domainCount} Domains
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {summary.total - summary.domainCount} direct IP hosts monitored
                            </p>
                        </div>
                    </section>

                    {/* Main Split Grid: Monitored Targets + Inspector / Security Stream */}
                    <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Target Registry Table */}
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-900">
                                        Daftar Domain &amp; IP Terpantau
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Klik salah satu target untuk melihat detail keamanan, TLS, dan riwayat latensi.
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari domain / IP..."
                                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none sm:w-48"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {(['all', 'healthy', 'degraded', 'critical'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setStatusFilter(tab)}
                                        className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition ${
                                            statusFilter === tab
                                                ? 'bg-sky-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {tab === 'all' ? `Semua (${targets.length})` : tab}
                                    </button>
                                ))}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="py-2.5 pr-3">Target</th>
                                            <th className="px-3 py-2.5">Status</th>
                                            <th className="px-3 py-2.5">Latency</th>
                                            <th className="px-3 py-2.5">Risk</th>
                                            <th className="py-2.5 pl-3 text-right">Check</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredTargets.map((target) => {
                                            const isSelected = selectedTarget?.id === target.id;
                                            return (
                                                <tr
                                                    key={target.id}
                                                    onClick={() => setSelectedId(target.id)}
                                                    className={`cursor-pointer transition ${
                                                        isSelected ? 'bg-sky-50/80' : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <td className="py-3 pr-3">
                                                        <div className="font-semibold text-slate-900">
                                                            {target.label}
                                                        </div>
                                                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                                                            <span>{formatHostDisplay(target)}</span>
                                                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                                                                {target.kind}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusBadgeClasses(target.status)}`}
                                                        >
                                                            <span
                                                                className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(target.status)}`}
                                                            />
                                                            {target.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono tabular-nums text-slate-800">
                                                        {target.latencyMs} ms
                                                    </td>
                                                    <td className="px-3 py-3 font-mono tabular-nums">
                                                        <span
                                                            className={
                                                                target.threatScore >= 70
                                                                    ? 'font-semibold text-rose-600'
                                                                    : target.threatScore >= 40
                                                                      ? 'font-medium text-amber-600'
                                                                      : 'text-emerald-700'
                                                            }
                                                        >
                                                            {target.threatScore}/100
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pl-3 text-right font-mono text-[11px] text-slate-500">
                                                        {target.lastChecked}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredTargets.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="py-8 text-center text-xs text-slate-500"
                                                >
                                                    Tidak ada domain atau IP yang cocok dengan filter saat ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right Column: Target Detail Inspector + Live Security Events */}
                        <div className="space-y-6 lg:col-span-5">
                            {selectedTarget && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                                                Target Inspector
                                            </span>
                                            <h3 className="mt-0.5 text-base font-semibold text-slate-900">
                                                {selectedTarget.label}
                                            </h3>
                                            <p className="font-mono text-xs text-slate-500">
                                                {formatHostDisplay(selectedTarget)} · {selectedTarget.region}
                                            </p>
                                        </div>
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClasses(selectedTarget.status)}`}
                                        >
                                            <span
                                                className={`h-2 w-2 rounded-full ${statusDotClasses(selectedTarget.status)}`}
                                            />
                                            {selectedTarget.status}
                                        </span>
                                    </div>

                                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs">
                                        <div>
                                            <dt className="text-slate-500">Probe / HTTP Status</dt>
                                            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                                                {selectedTarget.httpStatus}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">TLS / Certificate</dt>
                                            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                                                {selectedTarget.tlsVersion}
                                                {selectedTarget.sslDaysRemaining !== null
                                                    ? ` (${selectedTarget.sslDaysRemaining}d)`
                                                    : ''}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">Monitored Ports</dt>
                                            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                                                {selectedTarget.monitoredPorts}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-500">p95 Latency</dt>
                                            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                                                {selectedTarget.p95Ms} ms
                                            </dd>
                                        </div>
                                    </dl>

                                    {/* Latency Bar Sparkline */}
                                    <div className="mt-4">
                                        <div className="mb-1.5 flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-700">
                                                Recent Latency Samples (ms)
                                            </span>
                                            <span className="font-mono text-slate-500">
                                                Current: {selectedTarget.latencyMs}ms
                                            </span>
                                        </div>
                                        <div className="flex h-16 items-end gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                                            {selectedTarget.history.map((sample, idx) => {
                                                const maxVal = Math.max(...selectedTarget.history, 100);
                                                const heightPct = Math.min(
                                                    100,
                                                    Math.max(18, Math.round((sample / maxVal) * 100)),
                                                );
                                                return (
                                                    <div
                                                        key={`${selectedTarget.id}-${idx}`}
                                                        title={`${sample} ms`}
                                                        style={{ height: `${heightPct}%` }}
                                                        className={`flex-1 rounded-t transition-all ${
                                                            sample > 220
                                                                ? 'bg-rose-500'
                                                                : sample > 135
                                                                  ? 'bg-amber-400'
                                                                  : 'bg-sky-500'
                                                        }`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-1.5">
                                        <span className="text-xs font-medium text-slate-700">
                                            Security &amp; Health Notes
                                        </span>
                                        <ul className="space-y-1.5 text-xs text-slate-600">
                                            {selectedTarget.recentFindings.map((note, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                                                    <span>{note}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Live Security Event Feed */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            Security &amp; Ops Event Stream
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Deteksi anomali, perubahan status, dan rekomendasi mitigasi.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] text-slate-600">
                                        {events.length} logs
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {events.map((evt) => (
                                        <div
                                            key={evt.id}
                                            className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityBadgeClasses(evt.severity)}`}
                                                >
                                                    {evt.severity} · {evt.category}
                                                </span>
                                                <span className="font-mono text-[11px] text-slate-400">
                                                    {evt.timestamp}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-xs font-medium text-slate-900">
                                                {evt.summary}
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                Mitigasi: {evt.mitigation}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}
