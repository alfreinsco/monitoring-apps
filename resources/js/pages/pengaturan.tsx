import { Head, useForm } from '@inertiajs/react';
import { useId, useState } from 'react';
import { updateGoogleChat, updateTelegram } from '@/actions/App/Http/Controllers/PengaturanController';
import AppNavbar from '@/components/app-navbar';

type Status = 'healthy' | 'degraded' | 'critical';

interface TargetOption {
    id: number;
    label: string;
    host: string;
    kind: 'domain' | 'ip';
}

interface TelegramClient {
    id: string;
    chatId: string;
    targetIds: number[];
    targetAll: boolean;
}

interface GoogleChatClient {
    id: string;
    configured: boolean;
    targetIds: number[];
    targetAll: boolean;
}

interface SettingsProps {
    targets: TargetOption[];
    telegram: {
        enabled: boolean;
        tokenConfigured: boolean;
        statuses: Status[];
        clients: TelegramClient[];
    };
    googleChat: {
        enabled: boolean;
        statuses: Status[];
        clients: GoogleChatClient[];
    };
}

const statusOptions: { value: Status; label: string }[] = [
    { value: 'healthy', label: 'Normal' },
    { value: 'degraded', label: 'Terganggu' },
    { value: 'critical', label: 'Kritis' },
];

const inputClass = 'w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none';

function newClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function StatusFields({ statuses, onChange }: { statuses: Status[]; onChange: (statuses: Status[]) => void }) {
    return (
        <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-slate-200">Status yang dilaporkan</legend>
            <div className="flex flex-wrap gap-4">
                {statusOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={statuses.includes(option.value)}
                            onChange={(event) => onChange(event.target.checked
                                ? [...statuses, option.value]
                                : statuses.filter((status) => status !== option.value))}
                            className="h-4 w-4 accent-cyan-400"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

function TargetSelection({
    targets,
    selectedIds,
    targetAll,
    onTargetAllChange,
    onChange,
}: {
    targets: TargetOption[];
    selectedIds: number[];
    targetAll: boolean;
    onTargetAllChange: (targetAll: boolean) => void;
    onChange: (targetIds: number[]) => void;
}) {
    const [modalOpen, setModalOpen] = useState(false);
    const [draftIds, setDraftIds] = useState<number[]>([]);
    const [targetSearch, setTargetSearch] = useState('');
    const searchId = useId();

    function openModal(): void {
        setDraftIds(selectedIds);
        setTargetSearch('');
        setModalOpen(true);
    }

    const filteredTargets = targets.filter((target) => {
        const query = targetSearch.trim().toLocaleLowerCase();

        return target.host.toLocaleLowerCase().includes(query)
            || target.label.toLocaleLowerCase().includes(query);
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-slate-200">Target penerima</p>
                    <p className="mt-1 text-[11px] text-slate-500">{targetAll ? 'Semua domain dan IP akan menerima notifikasi.' : 'Notifikasi hanya dikirim ke target yang dipilih.'}</p>
                </div>
                <div className="flex items-center gap-2">
                    {!targetAll && <button type="button" onClick={openModal} disabled={targets.length === 0} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50 disabled:cursor-not-allowed disabled:opacity-40">＋ Tambah Domain/IP</button>}
                    <span className="text-xs font-semibold text-slate-300">Targetkan khusus</span>
                    <button
                        type="button"
                        role="switch"
                        aria-label="Targetkan khusus"
                        aria-checked={!targetAll}
                        onClick={() => onTargetAllChange(!targetAll)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${targetAll ? 'border-slate-600 bg-slate-700' : 'border-cyan-300/50 bg-cyan-500/70'}`}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white transition-transform ${targetAll ? 'translate-x-0.5' : 'translate-x-[22px]'}`} />
                    </button>
                </div>
            </div>

            {!targetAll && (
                <div className="flex flex-wrap gap-2">
                    {selectedIds.map((id) => {
                        const target = targets.find((item) => item.id === id);
                        if (!target) return null;

                        return <span key={id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/50 px-2.5 py-1 text-xs text-cyan-100">
                            <span className="max-w-56 truncate">{target.host}</span>
                            <button type="button" onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))} aria-label={`Hapus target ${target.host}`} className="rounded-full px-1 text-cyan-300 hover:bg-cyan-800 hover:text-white">×</button>
                        </span>;
                    })}
                    {selectedIds.length === 0 && <p className="text-xs text-amber-200">Belum ada target dipilih. Tambahkan target atau aktifkan Semua target.</p>}
                </div>
            )}

            {modalOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="target-picker-title" className="w-full max-w-xl rounded-2xl border border-cyan-400/30 bg-[#0a1020] p-5 sm:p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div><h3 id="target-picker-title" className="text-base font-bold text-white">Pilih Domain &amp; IP</h3><p className="mt-1 text-xs text-slate-400">Pilih satu atau beberapa target untuk tujuan notifikasi ini.</p></div>
                        <button type="button" onClick={() => setModalOpen(false)} aria-label="Tutup modal" className="rounded-md px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white">×</button>
                    </div>
                    <label htmlFor={searchId} className="sr-only">Cari domain, IP, atau label</label>
                    <input id={searchId} type="search" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Cari domain, IP, atau label…" className={`${inputClass} mb-3`} />
                    {targets.length === 0 ? <p className="rounded-lg border border-slate-700 px-3 py-8 text-center text-sm text-slate-400">Belum ada domain atau IP terdaftar.</p> : filteredTargets.length === 0 ? <p className="rounded-lg border border-slate-700 px-3 py-8 text-center text-sm text-slate-400">Tidak ada target yang cocok dengan pencarian.</p> : <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                        {filteredTargets.map((target) => {
                            const isSelected = draftIds.includes(target.id);

                            return <button key={target.id} type="button" aria-pressed={isSelected} onClick={() => setDraftIds((currentIds) => isSelected ? currentIds.filter((id) => id !== target.id) : [...currentIds, target.id])} className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${isSelected ? 'border-cyan-300/50 bg-cyan-950/60' : 'border-slate-700 bg-[#070b16] hover:border-cyan-400/30'}`}>
                                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{target.label}</span><span className="mt-0.5 block truncate font-mono text-xs text-slate-400">{target.host} · {target.kind === 'ip' ? 'IP' : 'Domain'}</span></span>
                                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${isSelected ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-slate-600 text-transparent'}`}>✓</span>
                            </button>;
                        })}
                    </div>}
                    <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-400">{draftIds.length} target dipilih</p>
                        <div className="flex gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Batal</button><button type="button" onClick={() => { onChange(draftIds); setModalOpen(false); }} className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25">Simpan Pilihan</button></div>
                    </div>
                </section>
            </div>}
        </div>
    );
}

function ErrorText({ children }: { children?: string }) {
    return children ? <p className="mt-1 text-xs text-rose-300">{children}</p> : null;
}

export default function Pengaturan({ targets, telegram, googleChat }: SettingsProps) {
    const telegramForm = useForm({
        enabled: telegram.enabled,
        bot_token: '',
        clear_token: false,
        statuses: telegram.statuses,
        clients: telegram.clients.map((client) => ({
            id: client.id,
            chat_id: client.chatId,
            target_ids: client.targetIds,
            target_all: client.targetAll,
        })),
    });
    const chatForm = useForm({
        enabled: googleChat.enabled,
        statuses: googleChat.statuses,
        clients: googleChat.clients.map((client) => ({
            id: client.id,
            webhook_url: '',
            clear_webhook: false,
            target_ids: client.targetIds,
            target_all: client.targetAll,
        })),
    });

    function addTelegramClient(): void {
        telegramForm.setData('clients', [...telegramForm.data.clients, {
            id: newClientId(), chat_id: '', target_ids: [], target_all: true,
        }]);
    }

    function addGoogleChatClient(): void {
        chatForm.setData('clients', [...chatForm.data.clients, {
            id: newClientId(), webhook_url: '', clear_webhook: false, target_ids: [], target_all: true,
        }]);
    }

    return (
        <>
            <Head title="Pengaturan | Monitoring Domain & IP" />
            <div className="cyber-grid-bg min-h-screen bg-[#050811] text-slate-100 selection:bg-cyan-400/30 selection:text-cyan-100">
                <header className="sticky top-0 z-20 border-b border-cyan-400/25 bg-[#070b16]/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
                        <div className="cyber-glow-cyan flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/60 bg-cyan-500/20 text-cyan-300" aria-hidden="true">◎</div>
                        <div>
                            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">Monitoring Domain &amp; IP</h1>
                            <p className="text-xs text-slate-300">Pengaturan notifikasi monitoring</p>
                        </div>
                    </div>
                    <AppNavbar activePage="pengaturan" />
                </header>

                <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                    <section className="cyber-panel rounded-2xl p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-white">Telegram</h2>
                                <p className="mt-1 text-sm text-slate-400">Satu token bot dapat mengirim notifikasi ke beberapa Chat ID.</p>
                            </div>
                            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
                                <input type="checkbox" checked={telegramForm.data.enabled} onChange={(event) => telegramForm.setData('enabled', event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                                Aktif
                            </label>
                        </div>

                        <form onSubmit={(event) => { event.preventDefault(); telegramForm.put(updateTelegram.url(), { preserveScroll: true, onSuccess: () => telegramForm.setData((data) => ({ ...data, bot_token: '', clear_token: false })) }); }} className="space-y-5">
                            <div>
                                <label htmlFor="telegram-token" className="mb-1.5 block text-xs font-semibold text-slate-200">Token bot Telegram</label>
                                <input id="telegram-token" type="password" autoComplete="new-password" value={telegramForm.data.bot_token} onChange={(event) => telegramForm.setData('bot_token', event.target.value)} placeholder={telegram.tokenConfigured ? 'Token tersimpan · isi hanya untuk mengganti' : 'Masukkan token bot Telegram'} className={inputClass} />
                                <ErrorText>{telegramForm.errors.bot_token}</ErrorText>
                                {telegram.tokenConfigured && <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={telegramForm.data.clear_token} onChange={(event) => telegramForm.setData('clear_token', event.target.checked)} className="accent-rose-400" />Hapus token tersimpan</label>}
                            </div>

                            <div className="space-y-4">
                                {telegramForm.data.clients.map((client, index) => (
                                    <div key={client.id} className="space-y-4 rounded-xl border border-cyan-400/15 bg-[#080d19]/70 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-sm font-semibold text-cyan-200">Client Telegram {index + 1}</h3>
                                            <button type="button" onClick={() => telegramForm.setData('clients', telegramForm.data.clients.filter((item) => item.id !== client.id))} className="rounded-md border border-rose-400/30 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950/50">Hapus Client</button>
                                        </div>
                                        <div>
                                            <label htmlFor={`telegram-chat-id-${client.id}`} className="mb-1.5 block text-xs font-semibold text-slate-200">Chat ID</label>
                                            <input id={`telegram-chat-id-${client.id}`} value={client.chat_id} onChange={(event) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, chat_id: event.target.value } : item))} placeholder="Contoh: -1001234567890" className={inputClass} />
                                            <ErrorText>{telegramForm.errors[`clients.${index}.chat_id`]}</ErrorText>
                                        </div>
                                        <TargetSelection targets={targets} selectedIds={client.target_ids} targetAll={client.target_all} onTargetAllChange={(targetAll) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, target_all: targetAll } : item))} onChange={(targetIds) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, target_ids: targetIds } : item))} />
                                        <ErrorText>{telegramForm.errors[`clients.${index}.target_ids`]}</ErrorText>
                                    </div>
                                ))}
                                {telegramForm.errors.clients && <ErrorText>{telegramForm.errors.clients}</ErrorText>}
                                <button type="button" onClick={addTelegramClient} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50">＋ Tambah Chat ID</button>
                            </div>

                            <StatusFields statuses={telegramForm.data.statuses} onChange={(statuses) => telegramForm.setData('statuses', statuses)} />
                            <button disabled={telegramForm.processing} className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50">{telegramForm.processing ? 'Menyimpan…' : 'Simpan Telegram'}</button>
                        </form>
                    </section>

                    <section className="cyber-panel rounded-2xl p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-white">Google Chat</h2>
                                <p className="mt-1 text-sm text-slate-400">Tambahkan beberapa incoming webhook dan atur target untuk tiap webhook.</p>
                            </div>
                            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
                                <input type="checkbox" checked={chatForm.data.enabled} onChange={(event) => chatForm.setData('enabled', event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                                Aktif
                            </label>
                        </div>

                        <form onSubmit={(event) => { event.preventDefault(); chatForm.put(updateGoogleChat.url(), { preserveScroll: true, onSuccess: () => chatForm.setData((data) => ({ ...data, clients: data.clients.map((client) => ({ ...client, webhook_url: '', clear_webhook: false })) })) }); }} className="space-y-5">
                            <div className="space-y-4">
                                {chatForm.data.clients.map((client, index) => {
                                    const configured = googleChat.clients.find((savedClient) => savedClient.id === client.id)?.configured ?? false;

                                    return (
                                        <div key={client.id} className="space-y-4 rounded-xl border border-cyan-400/15 bg-[#080d19]/70 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-semibold text-cyan-200">Google Chat {index + 1}</h3>
                                                <button type="button" onClick={() => chatForm.setData('clients', chatForm.data.clients.filter((item) => item.id !== client.id))} className="rounded-md border border-rose-400/30 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950/50">Hapus Client</button>
                                            </div>
                                            <div>
                                                <label htmlFor={`google-webhook-${client.id}`} className="mb-1.5 block text-xs font-semibold text-slate-200">Incoming webhook URL</label>
                                                <input id={`google-webhook-${client.id}`} type="password" autoComplete="new-password" value={client.webhook_url} onChange={(event) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, webhook_url: event.target.value } : item))} placeholder={configured ? 'Webhook tersimpan · isi hanya untuk mengganti' : 'https://chat.googleapis.com/v1/spaces/...'} className={inputClass} />
                                                <ErrorText>{chatForm.errors[`clients.${index}.webhook_url`]}</ErrorText>
                                                {configured && <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={client.clear_webhook} onChange={(event) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, clear_webhook: event.target.checked } : item))} className="accent-rose-400" />Hapus webhook tersimpan</label>}
                                            </div>
                                            <TargetSelection targets={targets} selectedIds={client.target_ids} targetAll={client.target_all} onTargetAllChange={(targetAll) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, target_all: targetAll } : item))} onChange={(targetIds) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, target_ids: targetIds } : item))} />
                                            <ErrorText>{chatForm.errors[`clients.${index}.target_ids`]}</ErrorText>
                                        </div>
                                    );
                                })}
                                {chatForm.errors.clients && <ErrorText>{chatForm.errors.clients}</ErrorText>}
                                <button type="button" onClick={addGoogleChatClient} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50">＋ Tambah Google Chat</button>
                            </div>

                            <StatusFields statuses={chatForm.data.statuses} onChange={(statuses) => chatForm.setData('statuses', statuses)} />
                            <button disabled={chatForm.processing} className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50">{chatForm.processing ? 'Menyimpan…' : 'Simpan Google Chat'}</button>
                        </form>
                    </section>
                </main>
            </div>
        </>
    );
}
