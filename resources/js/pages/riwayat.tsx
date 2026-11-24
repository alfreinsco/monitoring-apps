import { Head, Link, router, usePoll } from '@inertiajs/react';
import { Fragment, useEffect, useState } from 'react';
import { index as riwayatIndex } from '@/routes/riwayat';
import AppBrand from '@/components/app-brand';
import AppNavbar from '@/components/app-navbar';

type TargetStatus = 'healthy' | 'degraded' | 'critical';

interface MonitoringRecord {
    id: string;
    host: string;
    label: string;
    kind: 'domain' | 'ip';
    checkedAt: string;
    status: TargetStatus;
    uptime: number;
    latencyMs: number;
    p95Ms: number;
    httpStatus: string;
    sslDaysRemaining: number | null;
    tlsVersion: string;
    threatScore: number;
    findings: string[];
}

interface DomainOption {
    host: string;
    label: string;
}

interface HistoryPaginator {
    data: MonitoringRecord[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
}

interface RiwayatProps {
    records: HistoryPaginator;
    domains: DomainOption[];
    monitoringIntervalSeconds: number;
    filters: {
        domain: string;
        from: string;
        to: string;
    };
}

interface FilterValues {
    domain: string;
    from: string;
    to: string;
}

function filterQuery(filters: FilterValues, page: number): {
    domain?: string;
    from?: string;
    to?: string;
    page: number;
} {
    return {
        ...(filters.domain !== '' ? { domain: filters.domain } : {}),
        ...(filters.from !== '' ? { from: filters.from } : {}),
        ...(filters.to !== '' ? { to: filters.to } : {}),
        page,
    };
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

function statusBadgeClasses(status: TargetStatus): string {
    switch (status) {
        case 'healthy':
            return 'border-emerald-400/50 bg-emerald-950/90 text-emerald-300';
        case 'degraded':
            return 'border-amber-400/50 bg-amber-950/90 text-amber-300';
        case 'critical':
            return 'border-rose-400/60 bg-rose-950/90 text-rose-300';
    }
}

export default function Riwayat({ records, domains, filters, monitoringIntervalSeconds }: RiwayatProps) {
    const [domain, setDomain] = useState(filters.domain);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [filterError, setFilterError] = useState<string | null>(null);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    usePoll(monitoringIntervalSeconds * 1000, {
        only: ['records'],
    }, {
        mode: 'rest',
    });

    useEffect(() => {
        setDomain(filters.domain);
        setFrom(filters.from);
        setTo(filters.to);
    }, [filters.domain, filters.from, filters.to]);

    function updateFilters(nextFilters: FilterValues): void {
        setFilterError(null);
        setExpandedRecordId(null);

        if (nextFilters.from !== '' && nextFilters.to !== '' && nextFilters.to < nextFilters.from) {
            setFilterError('Waktu akhir harus sama dengan atau setelah waktu awal.');

            return;
        }

        router.get(riwayatIndex.url({ query: filterQuery(nextFilters, 1) }), {}, {
            only: ['records', 'filters'],
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    }

    function goToPage(page: number): void {
        setExpandedRecordId(null);
        router.get(riwayatIndex.url({ query: filterQuery(filters, page) }), {}, {
            only: ['records', 'filters'],
            preserveScroll: true,
            preserveState: true,
        });
    }

    function toggleRecord(recordId: string): void {
        setExpandedRecordId((currentId) => currentId === recordId ? null : recordId);
    }

    return (
        <>
            <Head title="Riwayat Monitoring | Monitoring Domain & IP" />
            <div className="cyber-grid-bg min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
                <header className="sticky top-0 z-20 border-b border-cyan-400/25 bg-[#070b16]/95 backdrop-blur-md">
                    <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
                        <AppBrand subtitle="Riwayat pemeriksaan monitoring" />
                    </div>
                    <AppNavbar activePage="riwayat" />
                </header>

                <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="cyber-panel rounded-2xl p-5">
                        <div className="mb-4">
                            <h2 className="text-sm font-bold tracking-wide text-cyan-300 uppercase">Filter Riwayat</h2>
                            <p className="mt-1 text-xs text-slate-300">Pilih domain dan rentang waktu pemeriksaan. Filter tersimpan di URL.</p>
                        </div>
                        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
                            <div>
                                <label htmlFor="domain-filter" className="mb-1.5 block text-xs font-semibold text-slate-200">Domain</label>
                                <select
                                    id="domain-filter"
                                    value={domain}
                                    onChange={(event) => {
                                        const nextDomain = event.target.value;
                                        setDomain(nextDomain);
                                        updateFilters({ domain: nextDomain, from, to });
                                    }}
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                                >
                                    <option value="">Semua domain</option>
                                    {domains.map((option) => (
                                        <option key={option.host} value={option.host}>
                                            {option.label} · {option.host}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="from-filter" className="mb-1.5 block text-xs font-semibold text-slate-200">Dari tanggal &amp; waktu</label>
                                <input
                                    id="from-filter"
                                    type="datetime-local"
                                    value={from}
                                    onChange={(event) => {
                                        const nextFrom = event.target.value;
                                        setFrom(nextFrom);
                                        updateFilters({ domain, from: nextFrom, to });
                                    }}
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label htmlFor="to-filter" className="mb-1.5 block text-xs font-semibold text-slate-200">Sampai tanggal &amp; waktu</label>
                                <input
                                    id="to-filter"
                                    type="datetime-local"
                                    value={to}
                                    onChange={(event) => {
                                        const nextTo = event.target.value;
                                        setTo(nextTo);
                                        updateFilters({ domain, from, to: nextTo });
                                    }}
                                    className="w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2 text-sm text-white focus:border-cyan-300 focus:outline-none"
                                />
                            </div>
                            {(domain !== '' || from !== '' || to !== '') && (
                                <div>
                                    <Link href={riwayatIndex.url()} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-600 bg-[#0d1528] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-white">
                                        Reset Filter
                                    </Link>
                                </div>
                            )}
                        </div>
                        {filterError && (
                            <p role="alert" className="mt-3 rounded-lg border border-rose-400/60 bg-rose-950/85 px-3 py-2 text-xs font-semibold text-rose-200">
                                {filterError}
                            </p>
                        )}
                    </section>

                    <section className="cyber-panel space-y-4 rounded-2xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-white">Riwayat Pemeriksaan Monitoring</h2>
                                <p className="text-xs text-slate-300">Satu rekaman untuk setiap target pada setiap siklus pemeriksaan backend.</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-cyan-400/35 bg-cyan-950/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                                {records.total} rekaman
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full min-w-[940px] border-collapse text-left text-xs">
                                <thead className="bg-[#0d1528] text-[11px] font-semibold tracking-wide text-slate-300 uppercase">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Domain/IP</th>
                                        <th scope="col" className="px-4 py-3">Uptime</th>
                                        <th scope="col" className="px-4 py-3">Latensi</th>
                                        <th scope="col" className="px-4 py-3">P95</th>
                                        <th scope="col" className="px-4 py-3">HTTP/TCP</th>
                                        <th scope="col" className="px-4 py-3">TLS</th>
                                        <th scope="col" className="px-4 py-3">Skor Ancaman</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                            {records.data.length === 0 ? (
                                <tr>
                                <td colSpan={7} className="bg-[#060a14]/90 p-4 text-sm text-slate-400">
                                    {records.total === 0 && domain === '' && from === '' && to === ''
                                        ? 'Belum ada riwayat pemeriksaan. Rekaman akan muncul setelah backend menjalankan siklus monitoring.'
                                        : 'Tidak ada riwayat pemeriksaan yang cocok dengan filter ini.'}
                                </td>
                                </tr>
                            ) : (
                                records.data.map((record) => {
                                    const isExpanded = expandedRecordId === record.id;

                                    return (
                                        <Fragment key={record.id}>
                                            <tr
                                                tabIndex={0}
                                                aria-expanded={isExpanded}
                                                onClick={() => toggleRecord(record.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        toggleRecord(record.id);
                                                    }
                                                }}
                                                className="cursor-pointer bg-[#060a14]/90 text-slate-200 transition hover:bg-cyan-950/30 focus-visible:outline-2 focus-visible:outline-cyan-300"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span aria-hidden="true" className={`text-cyan-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                            ›
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block font-semibold text-white">{record.label}</span>
                                                            <span className="mt-0.5 block font-mono text-[11px] text-slate-400">{record.host} · {record.kind === 'ip' ? 'IP' : 'Domain'}</span>
                                                            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClasses(record.status)}`}>
                                                                {statusLabel(record.status)} · {record.checkedAt}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">{record.uptime.toFixed(2)}%</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">{record.latencyMs} ms</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">{record.p95Ms} ms</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">{record.httpStatus}</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">
                                                    {record.tlsVersion}
                                                    {record.sslDaysRemaining !== null && <span className="mt-1 block text-[11px] text-slate-400">{record.sslDaysRemaining} hari tersisa</span>}
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono">{record.threatScore}/100</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-[#0a1020]">
                                                    <td colSpan={7} className="border-t border-cyan-400/15 px-5 py-4">
                                                        <h3 className="mb-2 text-xs font-bold tracking-wide text-cyan-200 uppercase">Detail Pemeriksaan</h3>
                                                        {record.findings.length > 0 ? (
                                                            <ul className="space-y-1.5 text-xs text-slate-300">
                                                                {record.findings.map((finding, index) => (
                                                                    <li key={`${record.id}-${index}`} className="flex items-start gap-2">
                                                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                                                                        <span>{finding}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <p className="text-xs text-slate-400">Tidak ada detail tambahan untuk pemeriksaan ini.</p>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })
                            )}
                                </tbody>
                            </table>
                        </div>

                        {records.last_page > 1 && (
                            <nav aria-label="Paginasi riwayat" className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                                <button type="button" onClick={() => goToPage(records.current_page - 1)} disabled={records.current_page <= 1} className="rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40">
                                    Sebelumnya
                                </button>
                                <span className="text-center text-xs text-slate-400">
                                    Halaman {records.current_page} dari {records.last_page}
                                    {records.from !== null && records.to !== null && <> · {records.from}–{records.to} dari {records.total}</>}
                                </span>
                                <button type="button" onClick={() => goToPage(records.current_page + 1)} disabled={records.current_page >= records.last_page} className="rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40">
                                    Berikutnya
                                </button>
                            </nav>
                        )}
                    </section>
                </main>
            </div>
        </>
    );
}
