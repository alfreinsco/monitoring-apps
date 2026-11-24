import { Head, Link, router, usePoll } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { home } from '@/routes';
import { index as notesIndex } from '@/routes/notes';

type Severity = 'low' | 'medium' | 'high';

interface SecurityEvent {
    id: string;
    timestamp: string;
    target: string;
    severity: Severity;
    category: string;
    summary: string;
    mitigation: string;
}

interface DomainOption {
    host: string;
    label: string;
}

interface EventPaginator {
    data: SecurityEvent[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
}

interface NotesProps {
    events: EventPaginator;
    domains: DomainOption[];
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

function severityLabel(severity: Severity): string {
    switch (severity) {
        case 'high':
            return 'Tinggi';
        case 'medium':
            return 'Sedang';
        case 'low':
            return 'Rendah';
    }
}

function severityBadgeClasses(severity: Severity): string {
    switch (severity) {
        case 'high':
            return 'border-rose-400/50 bg-rose-950/90 text-rose-300';
        case 'medium':
            return 'border-amber-400/50 bg-amber-950/90 text-amber-300';
        case 'low':
            return 'border-cyan-400/50 bg-cyan-950/90 text-cyan-300';
    }
}

export default function Catatan({ events, domains, filters }: NotesProps) {
    const [domain, setDomain] = useState(filters.domain);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [filterError, setFilterError] = useState<string | null>(null);

    usePoll(10000, {
        only: ['events'],
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

        if (nextFilters.from !== '' && nextFilters.to !== '' && nextFilters.to < nextFilters.from) {
            setFilterError('Waktu akhir harus sama dengan atau setelah waktu awal.');

            return;
        }

        router.get(notesIndex.url({ query: filterQuery(nextFilters, 1) }), {}, {
            only: ['events', 'filters'],
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    }

    function goToPage(page: number): void {
        router.get(notesIndex.url({ query: filterQuery(filters, page) }), {}, {
            only: ['events', 'filters'],
            preserveScroll: true,
            preserveState: true,
        });
    }

    return (
        <>
            <Head title="Catatan | Monitoring Domain & IP" />
            <div className="cyber-grid-bg min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
                <header className="sticky top-0 z-20 border-b border-cyan-400/25 bg-[#070b16]/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
                        <div className="cyber-glow-cyan flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/60 bg-cyan-500/20 text-cyan-300">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                                Monitoring Domain &amp; IP
                            </h1>
                            <p className="text-xs text-slate-300">Catatan Keamanan &amp; Operasional</p>
                        </div>
                    </div>
                    <nav aria-label="Navigasi utama" className="border-t border-cyan-400/15">
                        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
                            <Link
                                href={home.url()}
                                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-cyan-950/60 hover:text-cyan-200"
                            >
                                Monitor
                            </Link>
                            <Link
                                href={notesIndex.url()}
                                aria-current="page"
                                className="shrink-0 rounded-lg bg-cyan-950/70 px-3 py-1.5 text-xs font-semibold text-cyan-200"
                            >
                                Catatan
                            </Link>
                            <Link
                                href={`${home.url()}#pengaturan`}
                                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-cyan-950/60 hover:text-cyan-200"
                            >
                                Pengaturan
                            </Link>
                        </div>
                    </nav>
                </header>

                <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="cyber-panel rounded-2xl p-5">
                        <div className="mb-4">
                            <h2 className="text-sm font-bold tracking-wide text-cyan-300 uppercase">Filter Catatan</h2>
                            <p className="mt-1 text-xs text-slate-300">Pilih domain dan rentang tanggal serta waktu. Pilihan filter tersimpan di URL.</p>
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
                                    <Link href={notesIndex.url()} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-600 bg-[#0d1528] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-white">
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
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-white">Aliran Kejadian Keamanan &amp; Operasional</h2>
                                <p className="text-xs text-slate-300">Deteksi anomali, perubahan status, dan rekomendasi mitigasi.</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-cyan-400/35 bg-cyan-950/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                                {events.total} catatan
                            </span>
                        </div>

                        <div className="space-y-3">
                            {events.data.length === 0 ? (
                                <p className="rounded-xl border border-slate-800 bg-[#060a14]/90 p-4 text-sm text-slate-400">Tidak ada catatan yang cocok dengan filter ini.</p>
                            ) : (
                                events.data.map((event) => (
                                    <article key={event.id} className="rounded-xl border border-slate-800 bg-[#060a14]/90 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadgeClasses(event.severity)}`}>
                                                    {severityLabel(event.severity)} · {event.category}
                                                </span>
                                                <span className="font-mono text-[11px] text-cyan-200">{event.target}</span>
                                            </div>
                                            <time className="font-mono text-[11px] text-slate-400">{event.timestamp}</time>
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-white">{event.summary}</p>
                                        <p className="mt-1 text-[11px] text-slate-300">Mitigasi: {event.mitigation}</p>
                                    </article>
                                ))
                            )}
                        </div>

                        {events.last_page > 1 && (
                            <nav aria-label="Paginasi catatan" className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                                <button
                                    type="button"
                                    onClick={() => goToPage(events.current_page - 1)}
                                    disabled={events.current_page <= 1}
                                    className="rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Sebelumnya
                                </button>
                                <span className="text-center text-xs text-slate-400">
                                    Halaman {events.current_page} dari {events.last_page}
                                    {events.from !== null && events.to !== null && <> · {events.from}–{events.to} dari {events.total}</>}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => goToPage(events.current_page + 1)}
                                    disabled={events.current_page >= events.last_page}
                                    className="rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                                >
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
