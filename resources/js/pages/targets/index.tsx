import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { destroy as deleteTarget, store as storeTarget, update as updateTarget } from '@/actions/App/Http/Controllers/MonitoringController';
import { index as targetsIndex } from '@/routes/targets';
import AppNavbar from '@/components/app-navbar';

type TargetKind = 'domain' | 'ip';
type TargetStatus = 'healthy' | 'degraded' | 'critical';

interface Target {
    id: number;
    label: string;
    host: string;
    kind: TargetKind;
    status: TargetStatus;
    monitoredPorts: string;
    lastChecked: string;
}

interface TargetPaginator {
    data: Target[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface TargetsProps {
    targets: TargetPaginator;
    search: string;
}

const inputClass = 'w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none';

function statusLabel(status: TargetStatus): string {
    if (status === 'healthy') return 'Normal';
    if (status === 'degraded') return 'Terganggu';
    return 'Kritis';
}

function statusClass(status: TargetStatus): string {
    if (status === 'healthy') return 'border-emerald-400/50 bg-emerald-950/70 text-emerald-300';
    if (status === 'degraded') return 'border-amber-400/50 bg-amber-950/70 text-amber-300';
    return 'border-rose-400/50 bg-rose-950/70 text-rose-300';
}

export default function TargetsIndex({ targets, search }: TargetsProps) {
    const [searchValue, setSearchValue] = useState(search);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState<Target | null>(null);
    const form = useForm({ target: '', label: '', ports: '' });

    useEffect(() => setSearchValue(search), [search]);

    useEffect(() => {
        if (searchValue === search) return;

        const timeout = window.setTimeout(() => {
            router.get(targetsIndex.url({ query: searchValue ? { search: searchValue } : {} }), {}, {
                only: ['targets', 'search'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [searchValue, search]);

    function openCreateModal(): void {
        setEditingTarget(null);
        form.resetAndClearErrors();
        form.setData({ target: '', label: '', ports: '' });
        setModalOpen(true);
    }

    function openEditModal(target: Target): void {
        setEditingTarget(target);
        form.clearErrors();
        form.setData({ target: target.host, label: target.label, ports: target.monitoredPorts });
        setModalOpen(true);
    }

    function closeModal(): void {
        setModalOpen(false);
        setEditingTarget(null);
        form.resetAndClearErrors();
    }

    function submitForm(event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: closeModal };

        if (editingTarget) {
            form.put(updateTarget.url(editingTarget.id), options);
        } else {
            form.post(storeTarget.url(), options);
        }
    }

    function removeTarget(target: Target): void {
        if (!window.confirm(`Hapus ${target.host} dari daftar monitoring? Riwayat pemeriksaannya akan tetap tersimpan.`)) return;

        router.delete(deleteTarget.url(target.id), { preserveScroll: true });
    }

    return (
        <>
            <Head title="Domain & IP | Monitoring Domain & IP" />
            <div className="cyber-grid-bg min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
                <header className="sticky top-0 z-20 border-b border-cyan-400/25 bg-[#070b16]/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
                        <div className="cyber-glow-cyan flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/60 bg-cyan-500/20 text-cyan-300" aria-hidden="true">◎</div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">Monitoring Domain &amp; IP</h1>
                            <p className="text-xs text-slate-300">Daftar target yang dipantau</p>
                        </div>
                    </div>
                    <AppNavbar activePage="targets" />
                </header>

                <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="cyber-panel overflow-hidden rounded-2xl">
                        <div className="flex flex-col gap-4 border-b border-cyan-400/15 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-bold text-white">Daftar Domain &amp; IP</h2>
                                <p className="mt-1 text-sm text-slate-400">Kelola target yang terdaftar dalam monitoring.</p>
                            </div>
                            <button type="button" onClick={openCreateModal} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
                                <span aria-hidden="true">＋</span> Tambah Domain / IP
                            </button>
                        </div>
                        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <label htmlFor="target-search" className="sr-only">Cari domain, IP, atau label</label>
                            <input id="target-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Cari domain, IP, atau label…" className={`${inputClass} sm:max-w-sm`} />
                            <p className="text-xs text-slate-400">{targets.total} target terdaftar</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                                <thead className="sticky top-0 z-10 border-y border-cyan-400/20 bg-[#0a1020] text-xs font-semibold uppercase tracking-wide text-slate-300">
                                    <tr>
                                        <th scope="col" className="px-5 py-3">Domain / IP</th>
                                        <th scope="col" className="px-5 py-3">Label</th>
                                        <th scope="col" className="px-5 py-3">Tipe</th>
                                        <th scope="col" className="px-5 py-3">Status</th>
                                        <th scope="col" className="px-5 py-3">Port TCP</th>
                                        <th scope="col" className="px-5 py-3">Pemeriksaan Terakhir</th>
                                        <th scope="col" className="px-5 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-cyan-400/10">
                                    {targets.data.map((target) => (
                                        <tr key={target.id} className="transition hover:bg-cyan-950/20">
                                            <td className="whitespace-nowrap px-5 py-4 font-mono font-semibold text-cyan-200">{target.host}</td>
                                            <td className="px-5 py-4 text-slate-200">{target.label}</td>
                                            <td className="px-5 py-4"><span className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-300">{target.kind === 'ip' ? 'IP' : 'Domain'}</span></td>
                                            <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(target.status)}`}>{statusLabel(target.status)}</span></td>
                                            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-300">{target.monitoredPorts}</td>
                                            <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{target.lastChecked}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => openEditModal(target)} aria-label={`Edit ${target.host}`} className="rounded-md border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/60">Edit</button>
                                                    <button type="button" onClick={() => removeTarget(target)} aria-label={`Hapus ${target.host}`} className="rounded-md border border-rose-400/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/50">Hapus</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {targets.data.length === 0 && (
                                        <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">{search ? 'Tidak ada target yang sesuai dengan pencarian.' : 'Belum ada domain atau IP terdaftar.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-cyan-400/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-400">Menampilkan {targets.from ?? 0}–{targets.to ?? 0} dari {targets.total} target</p>
                            {targets.last_page > 1 && <nav aria-label="Pagination daftar target" className="flex flex-wrap justify-end gap-1">
                                {targets.links.map((link, index) => <button key={`${index}-${link.label}`} type="button" disabled={!link.url} onClick={() => link.url && router.visit(link.url, { preserveScroll: true, only: ['targets', 'search'] })} aria-current={link.active ? 'page' : undefined} aria-label={index === 0 ? 'Halaman sebelumnya' : index === targets.links.length - 1 ? 'Halaman berikutnya' : `Halaman ${link.label}`} className={`min-w-9 rounded-md border px-2.5 py-1.5 text-xs ${link.active ? 'border-cyan-300/50 bg-cyan-950 text-cyan-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-40`} dangerouslySetInnerHTML={{ __html: link.label }} />)}
                            </nav>}
                        </div>
                    </section>
                </main>
            </div>

            {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="target-modal-title" className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-[#0a1020] p-5 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 id="target-modal-title" className="text-base font-bold text-white">{editingTarget ? 'Edit Target' : 'Tambah Domain / IP'}</h2><p className="mt-1 text-xs text-slate-400">Domain akan diperiksa melalui HTTPS. Untuk IP, masukkan alamat IPv4.</p></div>
                        <button type="button" onClick={closeModal} aria-label="Tutup modal" className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
                    </div>
                    <form onSubmit={submitForm} className="space-y-4">
                        <div><label htmlFor="target-host" className="mb-1.5 block text-xs font-semibold text-slate-200">Domain atau IP</label><input id="target-host" autoFocus value={form.data.target} onChange={(event) => form.setData('target', event.target.value)} placeholder="portal.example.com atau 203.0.113.10" className={inputClass} /><ErrorText message={form.errors.target} /></div>
                        <div><label htmlFor="target-label" className="mb-1.5 block text-xs font-semibold text-slate-200">Label (opsional)</label><input id="target-label" value={form.data.label} onChange={(event) => form.setData('label', event.target.value)} placeholder="Nama layanan" className={inputClass} /><ErrorText message={form.errors.label} /></div>
                        <div><label htmlFor="target-ports" className="mb-1.5 block text-xs font-semibold text-slate-200">Port TCP</label><input id="target-ports" value={form.data.ports} onChange={(event) => form.setData('ports', event.target.value)} placeholder="80, 443" className={inputClass} /><p className="mt-1 text-[11px] text-slate-500">Maksimal 5 port, pisahkan dengan koma.</p><ErrorText message={form.errors.ports} /></div>
                        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeModal} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Batal</button><button disabled={form.processing} className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50">{form.processing ? 'Menyimpan…' : editingTarget ? 'Simpan Perubahan' : 'Tambah Target'}</button></div>
                    </form>
                </section>
            </div>}
        </>
    );
}

function ErrorText({ message }: { message?: string }) {
    return message ? <p className="mt-1 text-xs text-rose-300">{message}</p> : null;
}
