import { Head, useForm, usePoll } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { store } from '@/actions/App/Http/Controllers/MonitoringController';

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
    url?: string | null;
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
    history: number[];
    recentFindings: string[];
}

interface WelcomeProps {
    initialTargets: MonitoredTarget[];
    initialEvents: SecurityEvent[];
}

function normalizeTargetInput(
    raw: string,
): { host: string; kind: TargetKind } | null {
    const trimmed = raw
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .toLowerCase();

    if (!trimmed) {
        return null;
    }

    const ipv4Regex =
        /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    const domainRegex = /^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

    if (ipv4Regex.test(trimmed)) {
        return { host: trimmed, kind: 'ip' };
    }

    if (domainRegex.test(trimmed)) {
        return { host: trimmed, kind: 'domain' };
    }

    return null;
}

function statusLabel(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'Normal';
        case 'degraded':
            return 'Terganggu';
        case 'critical':
            return 'Kritis';
    }
}

function severityLabel(severity: ThreatSeverity): string {
    switch (severity) {
        case 'high':
            return 'Tinggi';
        case 'medium':
            return 'Sedang';
        case 'low':
            return 'Rendah';
    }
}

function statusBadgeClasses(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'bg-emerald-950/90 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
        case 'degraded':
            return 'bg-amber-950/90 text-amber-300 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
        case 'critical':
            return 'bg-rose-950/90 text-rose-300 border-rose-400/60 shadow-[0_0_14px_rgba(244,63,94,0.28)]';
    }
}

function statusDotClasses(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
        case 'degraded':
            return 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
        case 'critical':
            return 'bg-rose-400 shadow-[0_0_8px_#fb7185]';
    }
}

function severityBadgeClasses(severity: ThreatSeverity): string {
    switch (severity) {
        case 'high':
            return 'bg-rose-950/90 text-rose-300 border-rose-400/50';
        case 'medium':
            return 'bg-amber-950/90 text-amber-300 border-amber-400/50';
        case 'low':
            return 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50';
    }
}

export default function Welcome({
    initialTargets,
    initialEvents,
}: WelcomeProps) {
    const [targets, setTargets] = useState<MonitoredTarget[]>(initialTargets);
    const [events, setEvents] = useState<SecurityEvent[]>(initialEvents);
    const [selectedId, setSelectedId] = useState<string>(
        initialTargets[0]?.id ?? '',
    );
    const [statusFilter, setStatusFilter] = useState<'all' | TargetStatus>(
        'all',
    );
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [liveStream, setLiveStream] = useState<boolean>(true);
    const [redactSensitive, setRedactSensitive] = useState<boolean>(true);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);

    const { start: startPolling, stop: stopPolling } = usePoll(10000, {
        only: ['initialTargets', 'initialEvents'],
    }, {
        autoStart: true,
        mode: 'rest',
    });

    const { data, setData, post, processing, reset } = useForm({
        target: '',
        label: '',
        ports: '80, 443',
    });

    useEffect(() => {
        setTargets(initialTargets);
        if (
            initialTargets.length > 0 &&
            !initialTargets.some((t) => t.id === selectedId)
        ) {
            setSelectedId(initialTargets[0].id);
        }
    }, [initialTargets]);

    useEffect(() => {
        setEvents(initialEvents);
    }, [initialEvents]);

    useEffect(() => {
        if (liveStream) {
            startPolling();
        } else {
            stopPolling();
        }
    }, [liveStream, startPolling, stopPolling]);

    const selectedTarget = useMemo(
        () => targets.find((t) => t.id === selectedId) ?? targets[0],
        [targets, selectedId],
    );

    const filteredTargets = useMemo(() => {
        return targets.filter((t) => {
            const matchesStatus =
                statusFilter === 'all' || t.status === statusFilter;
            const q = searchQuery.trim().toLowerCase();
            const matchesQuery =
                !q ||
                t.label.toLowerCase().includes(q) ||
                t.host.toLowerCase().includes(q);
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
                ? Math.round(
                      targets.reduce((acc, t) => acc + t.latencyMs, 0) / total,
                  )
                : 0;
        const avgUptime =
            total > 0
                ? (
                      targets.reduce((acc, t) => acc + t.uptime, 0) / total
                  ).toFixed(2)
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

        const parsed = normalizeTargetInput(data.target);
        if (!parsed) {
            setFormError(
                'Masukkan nama domain yang valid (contoh: portal.unpatti.ac.id) atau alamat IPv4 yang valid (contoh: 103.184.22.50).',
            );
            return;
        }

        const alreadyExists = targets.some(
            (t) => t.host.toLowerCase() === parsed.host.toLowerCase(),
        );
        if (alreadyExists) {
            setFormError(
                `Target ${parsed.host} sudah terdaftar dalam pantauan aktif.`,
            );
            return;
        }

        post(store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                reset('target', 'label');
                setFormSuccess(
                    `${parsed.host} berhasil disimpan ke database dan masuk antrean pemantauan.`,
                );
            },
            onError: (errors) => {
                setFormError(
                    errors.target ?? 'Gagal mendaftarkan target ke database.',
                );
            },
        });
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
            <Head title="SentinelGrid — Pemantauan Aplikasi, Web & Keamanan Waktu Nyata" />
            <div className="cyber-grid-bg min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
                {/* Header Operasional Utama */}
                <header className="sticky top-0 z-20 border-b border-cyan-400/25 bg-[#070b16]/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-3">
                            <div className="cyber-glow-cyan flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/60 bg-cyan-500/20 text-cyan-300">
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
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
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                                        SentinelGrid SOC &amp; Pemantau Aplikasi
                                    </h1>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-cyan-950/90 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-300">
                                        <span
                                            className={`h-2 w-2 rounded-full ${liveStream ? 'animate-pulse bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-500'}`}
                                        />
                                        {liveStream
                                            ? 'Pemantauan Aktif'
                                            : 'Dijeda'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Pemantauan ketersediaan aplikasi, latensi
                                    endpoint, sertifikat TLS, dan anomali
                                    keamanan domain &amp; IP
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setRedactSensitive((prev) => !prev)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-[#0d1528] px-3 py-1.5 font-mono text-xs font-semibold text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-950/60"
                            >
                                <span>
                                    {redactSensitive
                                        ? 'Samarkan IP: AKTIF'
                                        : 'Samarkan IP: NONAKTIF'}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLiveStream((prev) => !prev)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs font-bold transition ${
                                    liveStream
                                        ? 'cyber-glow-cyan border border-cyan-300 bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                                        : 'border border-slate-600 bg-[#0d1528] text-slate-200 hover:border-cyan-400/50 hover:text-white'
                                }`}
                            >
                                <span>
                                    {liveStream
                                        ? 'Jeda Aliran Data'
                                        : 'Lanjutkan Aliran Data'}
                                </span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                    {/* Bilah Pendaftaran Domain atau IP */}
                    <section className="cyber-panel rounded-2xl p-5">
                        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-sm font-bold tracking-wide text-cyan-300 uppercase">
                                    Daftarkan Domain atau IP untuk Dipantau
                                </h2>
                                <p className="mt-0.5 text-xs text-slate-300">
                                    Tambahkan domain HTTPS atau alamat IPv4 host
                                    agar langsung tersimpan ke database dan
                                    masuk ke siklus pengecekan.
                                </p>
                            </div>
                            <span className="rounded-md border border-cyan-400/30 bg-cyan-950/70 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-300">
                                {summary.total} target terdaftar
                            </span>
                        </div>

                        <form
                            onSubmit={handleRegisterTarget}
                            className="grid grid-cols-1 gap-3 md:grid-cols-12"
                        >
                            <div className="md:col-span-4">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                                    Domain atau Alamat IP
                                </label>
                                <input
                                    type="text"
                                    value={data.target}
                                    onChange={(e) =>
                                        setData('target', e.target.value)
                                    }
                                    placeholder="contoh: portal.unpatti.ac.id atau 103.184.22.80"
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none"
                                />
                            </div>

                            <div className="md:col-span-3">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                                    Nama Layanan / Label
                                </label>
                                <input
                                    type="text"
                                    value={data.label}
                                    onChange={(e) =>
                                        setData('label', e.target.value)
                                    }
                                    placeholder="contoh: Portal Akademik"
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1.5 block text-xs font-semibold text-slate-200">
                                    Port Pantauan
                                </label>
                                <input
                                    type="text"
                                    value={data.ports}
                                    onChange={(e) =>
                                        setData('ports', e.target.value)
                                    }
                                    placeholder="80, 443"
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-end md:col-span-2">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="cyber-glow-cyan w-full rounded-lg border border-cyan-300 bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:ring-2 focus:ring-cyan-300/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {processing
                                        ? 'Menyimpan...'
                                        : '+ Daftarkan'}
                                </button>
                            </div>
                        </form>

                        {formError && (
                            <p className="mt-3 rounded-lg border border-rose-400/60 bg-rose-950/85 px-3 py-2 text-xs font-semibold text-rose-200">
                                {formError}
                            </p>
                        )}
                        {formSuccess && (
                            <p className="mt-3 rounded-lg border border-emerald-400/60 bg-emerald-950/85 px-3 py-2 text-xs font-semibold text-emerald-200">
                                {formSuccess}
                            </p>
                        )}
                    </section>

                    {/* Kartu Ringkasan KPI */}
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="cyber-panel rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                                    Waktu Aktif Global
                                </span>
                                <span className="rounded-md border border-emerald-400/40 bg-emerald-950/80 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                                    {summary.healthy}/{summary.total} AKTIF
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
                                {summary.avgUptime}%
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                                {summary.degraded} terganggu ·{' '}
                                {summary.critical} kritis
                            </p>
                        </div>

                        <div className="cyber-panel rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                                    Rata-Rata RTT Respons
                                </span>
                                <span className="rounded-md border border-cyan-400/40 bg-cyan-950/80 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                                    LANGSUNG
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-bold text-cyan-300 tabular-nums">
                                {summary.avgLatency} ms
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                                Puncak p95:{' '}
                                {Math.max(...targets.map((t) => t.p95Ms), 0)} ms
                            </p>
                        </div>

                        <div className="cyber-panel rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                                    Peringatan Risiko Keamanan
                                </span>
                                <span className="rounded-md border border-rose-400/50 bg-rose-950/80 px-2 py-0.5 font-mono text-xs font-bold text-rose-300">
                                    SOC
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-bold text-rose-300 tabular-nums">
                                {summary.highRiskCount} Waspada
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                                Pemantauan anomali trafik, brute-force &amp;
                                pemindaian port
                            </p>
                        </div>

                        <div className="cyber-panel rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                                    Aset TLS &amp; Domain
                                </span>
                                <span className="rounded-md border border-cyan-400/40 bg-cyan-950/80 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                                    TLS 1.3
                                </span>
                            </div>
                            <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
                                {summary.domainCount} Domain
                            </div>
                            <p className="mt-1 text-xs text-slate-300">
                                {summary.total - summary.domainCount} host IP
                                langsung terpantau
                            </p>
                        </div>
                    </section>

                    {/* Tata Letak Utama: Daftar Target + Inspektor Detail & Aliran Keamanan */}
                    <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Tabel Registri Target */}
                        <div className="cyber-panel space-y-4 rounded-2xl p-5 lg:col-span-7">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div>
                                    <h2 className="text-sm font-bold tracking-wide text-white">
                                        Daftar Domain &amp; IP Terpantau
                                    </h2>
                                    <p className="text-xs text-slate-300">
                                        Klik salah satu target untuk melihat
                                        detail keamanan, TLS, dan riwayat
                                        latensi.
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder="Cari domain / IP..."
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none sm:w-48"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {(
                                    [
                                        'all',
                                        'healthy',
                                        'degraded',
                                        'critical',
                                    ] as const
                                ).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setStatusFilter(tab)}
                                        className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                                            statusFilter === tab
                                                ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                                                : 'border-slate-700 bg-[#0a1020] text-slate-300 hover:border-cyan-400/40 hover:text-white'
                                        }`}
                                    >
                                        {tab === 'all'
                                            ? `Semua (${targets.length})`
                                            : statusLabel(tab)}
                                    </button>
                                ))}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-cyan-400/25 text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                                            <th className="py-2.5 pr-3">
                                                Target
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Status
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Latensi
                                            </th>
                                            <th className="px-3 py-2.5">
                                                Risiko
                                            </th>
                                            <th className="py-2.5 pl-3 text-right">
                                                Pemeriksaan
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/90">
                                        {filteredTargets.map((target) => {
                                            const isSelected =
                                                selectedTarget?.id ===
                                                target.id;
                                            return (
                                                <tr
                                                    key={target.id}
                                                    onClick={() =>
                                                        setSelectedId(target.id)
                                                    }
                                                    className={`cursor-pointer transition ${
                                                        isSelected
                                                            ? 'bg-cyan-950/60 ring-1 ring-cyan-400/40 ring-inset'
                                                            : 'hover:bg-slate-900/80'
                                                    }`}
                                                >
                                                    <td className="py-3 pr-3">
                                                        <div className="font-bold text-white">
                                                            {target.label}
                                                        </div>
                                                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-300">
                                                            <span>
                                                                {formatHostDisplay(
                                                                    target,
                                                                )}
                                                            </span>
                                                            <span className="rounded border border-cyan-400/30 bg-[#060a14] px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 uppercase">
                                                                {target.kind ===
                                                                'domain'
                                                                    ? 'DOMAIN'
                                                                    : 'IP'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(target.status)}`}
                                                        >
                                                            <span
                                                                className={`h-1.5 w-1.5 rounded-full ${statusDotClasses(target.status)}`}
                                                            />
                                                            {statusLabel(
                                                                target.status,
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 font-mono font-semibold text-slate-100 tabular-nums">
                                                        {target.latencyMs} ms
                                                    </td>
                                                    <td className="px-3 py-3 font-mono tabular-nums">
                                                        <span
                                                            className={
                                                                target.threatScore >=
                                                                70
                                                                    ? 'font-bold text-rose-400'
                                                                    : target.threatScore >=
                                                                        40
                                                                      ? 'font-bold text-amber-300'
                                                                      : 'font-semibold text-emerald-300'
                                                            }
                                                        >
                                                            {target.threatScore}
                                                            /100
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pl-3 text-right font-mono text-[11px] text-slate-300">
                                                        {target.lastChecked}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredTargets.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="py-8 text-center text-xs text-slate-400"
                                                >
                                                    Tidak ada domain atau IP
                                                    yang cocok dengan filter
                                                    saat ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Kolom Kanan: Inspektor Detail Target + Aliran Kejadian Keamanan */}
                        <div className="space-y-6 lg:col-span-5">
                            {selectedTarget && (
                                <div className="cyber-panel rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                                                Inspektor Target
                                            </span>
                                            <h3 className="mt-0.5 text-base font-bold text-white">
                                                {selectedTarget.label}
                                            </h3>
                                            <p className="font-mono text-xs text-slate-300">
                                                {formatHostDisplay(
                                                    selectedTarget,
                                                )}
                                            </p>
                                            {selectedTarget.url && (
                                                <a
                                                    href={selectedTarget.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-1 inline-block font-mono text-xs text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 hover:text-cyan-200"
                                                >
                                                    {selectedTarget.url}
                                                </a>
                                            )}
                                        </div>
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClasses(selectedTarget.status)}`}
                                        >
                                            <span
                                                className={`h-2 w-2 rounded-full ${statusDotClasses(selectedTarget.status)}`}
                                            />
                                            {statusLabel(selectedTarget.status)}
                                        </span>
                                    </div>

                                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-cyan-400/20 bg-[#060a14] p-3.5 text-xs">
                                        <div>
                                            <dt className="text-slate-400">
                                                Status Uji / HTTP
                                            </dt>
                                            <dd className="mt-0.5 font-mono font-bold text-white">
                                                {selectedTarget.httpStatus}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-400">
                                                TLS / Sertifikat
                                            </dt>
                                            <dd className="mt-0.5 font-mono font-bold text-white">
                                                {selectedTarget.tlsVersion}
                                                {selectedTarget.sslDaysRemaining !==
                                                null
                                                    ? ` (${selectedTarget.sslDaysRemaining} hr)`
                                                    : ''}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-400">
                                                Port Terpantau
                                            </dt>
                                            <dd className="mt-0.5 font-mono font-bold text-cyan-300">
                                                {selectedTarget.monitoredPorts}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-slate-400">
                                                Latensi p95
                                            </dt>
                                            <dd className="mt-0.5 font-mono font-bold text-white">
                                                {selectedTarget.p95Ms} ms
                                            </dd>
                                        </div>
                                    </dl>

                                    {/* Grafik Batang Sampel Latensi */}
                                    <div className="mt-4">
                                        <div className="mb-1.5 flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-200">
                                                Sampel Latensi Terbaru (ms)
                                            </span>
                                            <span className="font-mono font-semibold text-cyan-300">
                                                Saat ini:{' '}
                                                {selectedTarget.latencyMs} ms
                                            </span>
                                        </div>
                                        <div className="flex h-16 items-end gap-1.5 rounded-xl border border-cyan-400/20 bg-[#060a14] p-2.5">
                                            {selectedTarget.history.map(
                                                (sample, idx) => {
                                                    const maxVal = Math.max(
                                                        ...selectedTarget.history,
                                                        100,
                                                    );
                                                    const heightPct = Math.min(
                                                        100,
                                                        Math.max(
                                                            18,
                                                            Math.round(
                                                                (sample /
                                                                    maxVal) *
                                                                    100,
                                                            ),
                                                        ),
                                                    );
                                                    return (
                                                        <div
                                                            key={`${selectedTarget.id}-${idx}`}
                                                            title={`${sample} ms`}
                                                            style={{
                                                                height: `${heightPct}%`,
                                                            }}
                                                            className={`flex-1 rounded-t transition-all ${
                                                                sample > 220
                                                                    ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.45)]'
                                                                    : sample >
                                                                        135
                                                                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]'
                                                                      : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                                                            }`}
                                                        />
                                                    );
                                                },
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-1.5">
                                        <span className="text-xs font-semibold text-slate-200">
                                            Catatan Keamanan &amp; Kesehatan
                                        </span>
                                        <ul className="space-y-1.5 text-xs text-slate-300">
                                            {selectedTarget.recentFindings.map(
                                                (note, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-2"
                                                    >
                                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                                                        <span>{note}</span>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Aliran Kejadian Keamanan Langsung */}
                            <div className="cyber-panel rounded-2xl p-5">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">
                                            Aliran Kejadian Keamanan &amp;
                                            Operasional
                                        </h3>
                                        <p className="text-xs text-slate-300">
                                            Deteksi anomali, perubahan status,
                                            dan rekomendasi mitigasi.
                                        </p>
                                    </div>
                                    <span className="rounded-full border border-cyan-400/35 bg-cyan-950/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                                        {events.length} log
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {events.map((evt) => (
                                        <div
                                            key={evt.id}
                                            className="rounded-xl border border-slate-800 bg-[#060a14]/90 p-3"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadgeClasses(evt.severity)}`}
                                                >
                                                    {severityLabel(
                                                        evt.severity,
                                                    )}{' '}
                                                    · {evt.category}
                                                </span>
                                                <span className="font-mono text-[11px] text-slate-400">
                                                    {evt.timestamp}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-xs font-semibold text-white">
                                                {evt.summary}
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-300">
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
