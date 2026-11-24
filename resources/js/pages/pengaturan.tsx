import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useId, useRef, useState } from 'react';
import { testGoogleChat, testTelegram, updateGoogleChat, updateHistory, updateTelegram } from '@/actions/App/Http/Controllers/PengaturanController';
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
    statuses: Status[];
}

interface GoogleChatClient {
    id: string;
    configured: boolean;
    targetIds: number[];
    targetAll: boolean;
    statuses: Status[];
}

interface SettingsProps {
    targets: TargetOption[];
    historySettings: { statuses: Status[]; intervalMinutes: number };
    telegram: {
        enabled: boolean;
        tokenConfigured: boolean;
        clients: TelegramClient[];
    };
    googleChat: {
        enabled: boolean;
        clients: GoogleChatClient[];
    };
    connectionTest?: {
        channel: 'telegram' | 'google_chat';
        results: { id: string; recipient: string; success: boolean; message: string }[];
    };
}

const statusOptions: { value: Status; label: string }[] = [
    { value: 'healthy', label: 'Normal' },
    { value: 'degraded', label: 'Terganggu' },
    { value: 'critical', label: 'Kritis' },
];

const inputClass = 'w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none';

function TelegramBrandIcon() {
    return (
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#26A5E4" />
            <path d="m18.7 6.4-2.1 11c-.16.78-.62.97-1.26.6l-3.5-2.58-1.69 1.63c-.19.2-.36.37-.74.37l.26-3.58 6.52-5.9c.28-.25-.06-.39-.43-.14l-8.06 5.08-3.47-1.08c-.75-.23-.76-.75.16-1.12l13.55-5.22c.63-.23 1.18.15.77.94Z" fill="white" />
        </svg>
    );
}

function GoogleChatBrandIcon() {
    return (
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.25 4.25A2.25 2.25 0 0 1 5.5 2h13A2.25 2.25 0 0 1 20.75 4.25v8.5A2.25 2.25 0 0 1 18.5 15h-5.75l-4.5 4v-4H5.5a2.25 2.25 0 0 1-2.25-2.25v-8.5Z" fill="#00832D" />
            <path d="M7.5 7.25A1.25 1.25 0 0 1 8.75 6h11.5v6.75A2.25 2.25 0 0 1 18 15h-2.5v4l-4.5-4H9.25A1.75 1.75 0 0 1 7.5 13.25v-6Z" fill="#2684FC" />
            <path d="M3.25 9.25V4.5A2.5 2.5 0 0 1 5.75 2h10.5v4H8.75A1.25 1.25 0 0 0 7.5 7.25v2H3.25Z" fill="#FFBA00" />
            <path d="M3.25 9.25H7.5v4A1.75 1.75 0 0 0 9.25 15H10v4l-4.5-4h-.25a2 2 0 0 1-2-2v-3.75Z" fill="#EA4335" />
        </svg>
    );
}

function TestConnectionIcon() {
    return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.2-6 4.6 12 2.2-6H21" /></svg>;
}

function DeleteIcon() {
    return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
}

function newClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function StatusFields({ statuses, onChange }: { statuses: Status[]; onChange: (statuses: Status[]) => void }) {
    return (
        <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-slate-200">Status yang dilaporkan</legend>
            <div className="grid grid-cols-1 justify-items-start gap-2 sm:grid-cols-3">
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
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        role="switch"
                        aria-label="Targetkan khusus"
                        aria-checked={!targetAll}
                        onClick={() => onTargetAllChange(!targetAll)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${targetAll ? 'border-slate-600 bg-slate-700' : 'border-cyan-300/50 bg-cyan-500/70'}`}
                    >
                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${targetAll ? 'translate-x-0.5' : 'translate-x-4'}`} />
                    </button>
                    <span className="text-xs font-semibold text-slate-300">Targetkan khusus</span>
                </div>
            </div>

            {!targetAll && (
                <div className="flex flex-wrap items-center gap-2">
                    {selectedIds.length === 0 && <span className="text-xs text-amber-200">Belum ada target dipilih.</span>}
                    {selectedIds.map((id) => {
                        const target = targets.find((item) => item.id === id);
                        if (!target) return null;

                        return <span key={id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/50 px-2.5 py-1 text-xs text-cyan-100">
                            <span className="max-w-56 truncate">{target.host}</span>
                            <button type="button" onClick={() => onChange(selectedIds.filter((selectedId) => selectedId !== id))} aria-label={`Hapus target ${target.host}`} className="rounded-full px-1 text-cyan-300 hover:bg-cyan-800 hover:text-white">×</button>
                        </span>;
                    })}
                    <button type="button" onClick={openModal} disabled={targets.length === 0} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-950/30 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-40">＋ Tambah Domain/IP</button>
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

export default function Pengaturan({ targets, historySettings, telegram, googleChat, connectionTest }: SettingsProps) {
    const [testingClient, setTestingClient] = useState<string | null>(null);
    const [testErrors, setTestErrors] = useState<Record<string, string>>({});
    const skipTelegramAutoSave = useRef(true);
    const skipGoogleChatAutoSave = useRef(true);
    const skipHistoryAutoSave = useRef(true);
    const historySaveTimeout = useRef<number | null>(null);
    const [historyIntervalUnit, setHistoryIntervalUnit] = useState<'seconds' | 'minutes' | 'hours'>(
        historySettings.intervalMinutes < 1 ? 'seconds' : historySettings.intervalMinutes >= 60 && historySettings.intervalMinutes % 60 === 0 ? 'hours' : 'minutes',
    );
    const historyForm = useForm({
        statuses: historySettings.statuses,
        interval_minutes: historySettings.intervalMinutes,
    });
    const telegramForm = useForm({
        enabled: telegram.enabled,
        bot_token: '',
        clear_token: false,
        clients: telegram.clients.map((client) => ({
            id: client.id,
            chat_id: client.chatId,
            target_ids: client.targetIds,
            target_all: client.targetAll,
            statuses: client.statuses,
        })),
    });
    const chatForm = useForm({
        enabled: googleChat.enabled,
        clients: googleChat.clients.map((client) => ({
            id: client.id,
            webhook_url: '',
            clear_webhook: false,
            target_ids: client.targetIds,
            target_all: client.targetAll,
            statuses: client.statuses,
        })),
    });

    useEffect(() => {
        if (skipTelegramAutoSave.current) {
            skipTelegramAutoSave.current = false;

            return;
        }

        const timeout = window.setTimeout(() => {
            telegramForm.put(updateTelegram.url(), {
                preserveScroll: true,
                onSuccess: () => {
                    if (telegramForm.data.bot_token !== '' || telegramForm.data.clear_token) {
                        skipTelegramAutoSave.current = true;
                        telegramForm.setData((data) => ({ ...data, bot_token: '', clear_token: false }));
                    }
                },
            });
        }, 600);

        return () => window.clearTimeout(timeout);
    }, [telegramForm.data]);

    useEffect(() => {
        if (skipGoogleChatAutoSave.current) {
            skipGoogleChatAutoSave.current = false;

            return;
        }

        const timeout = window.setTimeout(() => {
            chatForm.put(updateGoogleChat.url(), {
                preserveScroll: true,
                onSuccess: () => {
                    if (chatForm.data.clients.some((client) => client.webhook_url !== '' || client.clear_webhook)) {
                        skipGoogleChatAutoSave.current = true;
                        chatForm.setData((data) => ({ ...data, clients: data.clients.map((client) => ({ ...client, webhook_url: '', clear_webhook: false })) }));
                    }
                },
            });
        }, 600);

        return () => window.clearTimeout(timeout);
    }, [chatForm.data]);

    useEffect(() => {
        if (skipHistoryAutoSave.current) {
            skipHistoryAutoSave.current = false;

            return;
        }

        const timeout = window.setTimeout(saveHistorySettings, 3000);
        historySaveTimeout.current = timeout;

        return () => {
            window.clearTimeout(timeout);
            if (historySaveTimeout.current === timeout) {
                historySaveTimeout.current = null;
            }
        };
    }, [historyForm.data]);

    function saveHistorySettings(): void {
        if (historySaveTimeout.current !== null) {
            window.clearTimeout(historySaveTimeout.current);
            historySaveTimeout.current = null;
        }

        historyForm.put(updateHistory.url(), { preserveScroll: true });
    }

    const displayedHistoryInterval = historyIntervalUnit === 'seconds'
        ? historyForm.data.interval_minutes * 60
        : historyIntervalUnit === 'hours'
            ? historyForm.data.interval_minutes / 60
            : historyForm.data.interval_minutes;

    function updateHistoryInterval(value: string): void {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < (historyIntervalUnit === 'seconds' ? 1 : historyIntervalUnit === 'minutes' ? 1 / 60 : 1 / 3600)) {
            return;
        }

        const intervalMinutes = historyIntervalUnit === 'seconds'
            ? amount / 60
            : historyIntervalUnit === 'hours'
                ? amount * 60
                : amount;
        historyForm.setData('interval_minutes', Number(intervalMinutes.toFixed(8)));
    }

    function addTelegramClient(): void {
        telegramForm.setData('clients', [...telegramForm.data.clients, {
            id: newClientId(), chat_id: '', target_ids: [], target_all: true, statuses: ['critical', 'degraded'],
        }]);
    }

    function addGoogleChatClient(): void {
        chatForm.setData('clients', [...chatForm.data.clients, {
            id: newClientId(), webhook_url: '', clear_webhook: false, target_ids: [], target_all: true, statuses: ['critical', 'degraded'],
        }]);
    }

    function sendTelegramTest(client: (typeof telegramForm.data.clients)[number], index: number): void {
        const testKey = `telegram:${client.id}`;
        setTestingClient(testKey);
        setTestErrors((currentErrors) => ({ ...currentErrors, [testKey]: '' }));

        router.post(testTelegram.url(), {
            bot_token: telegramForm.data.bot_token,
            clear_token: telegramForm.data.clear_token,
            clients: [{ id: client.id, label: `Chat ID ${index + 1}`, chat_id: client.chat_id }],
        }, {
            preserveScroll: true,
            onError: (errors) => setTestErrors((currentErrors) => ({
                ...currentErrors,
                [testKey]: String(Object.values(errors)[0] ?? 'Tes koneksi gagal divalidasi.'),
            })),
            onFinish: () => setTestingClient(null),
        });
    }

    function sendGoogleChatTest(client: (typeof chatForm.data.clients)[number], index: number): void {
        const testKey = `google_chat:${client.id}`;
        setTestingClient(testKey);
        setTestErrors((currentErrors) => ({ ...currentErrors, [testKey]: '' }));

        router.post(testGoogleChat.url(), {
            clients: [{ id: client.id, label: `Google Chat ${index + 1}`, webhook_url: client.webhook_url, clear_webhook: client.clear_webhook }],
        }, {
            preserveScroll: true,
            onError: (errors) => setTestErrors((currentErrors) => ({
                ...currentErrors,
                [testKey]: String(Object.values(errors)[0] ?? 'Tes koneksi gagal divalidasi.'),
            })),
            onFinish: () => setTestingClient(null),
        });
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
                    <section className="cyber-panel rounded-2xl p-5 sm:p-6" onBlur={saveHistorySettings}>
                        <div className="mb-5">
                            <h2 className="text-base font-bold text-white">Pengaturan Riwayat</h2>
                            <p className="mt-1 text-xs text-slate-400">Atur status target dan interval penyimpanan snapshot ke riwayat.</p>
                        </div>
                        <div className="space-y-5">
                            <StatusFields
                                statuses={historyForm.data.statuses}
                                onChange={(statuses) => historyForm.setData('statuses', statuses)}
                            />
                            <div className="max-w-md">
                                <label htmlFor="history-interval" className="mb-1.5 block text-xs font-semibold text-slate-200">Simpan setiap</label>
                                <div className="grid grid-cols-[1fr_140px] gap-2">
                                    <input
                                        id="history-interval"
                                        type="number"
                                        min={historyIntervalUnit === 'seconds' ? '1' : historyIntervalUnit === 'minutes' ? '0.01666667' : '0.00027778'}
                                        step="any"
                                        value={Number(displayedHistoryInterval.toFixed(4))}
                                        onChange={(event) => updateHistoryInterval(event.target.value)}
                                        className={inputClass}
                                    />
                                    <select value={historyIntervalUnit} onChange={(event) => setHistoryIntervalUnit(event.target.value as typeof historyIntervalUnit)} className={inputClass}>
                                        <option value="seconds">Detik</option>
                                        <option value="minutes">Menit</option>
                                        <option value="hours">Jam</option>
                                    </select>
                                </div>
                                <ErrorText>{historyForm.errors.interval_minutes}</ErrorText>
                                <p aria-live="polite" className="mt-2 text-xs text-slate-400">{historyForm.processing ? 'Menyimpan perubahan…' : 'Interval disimpan dalam menit dan diperbarui otomatis.'}</p>
                            </div>
                        </div>
                    </section>

                    <section className="cyber-panel rounded-2xl p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-bold text-white"><TelegramBrandIcon />Telegram</h2>
                            </div>
                            <button type="button" role="switch" aria-label="Aktifkan Telegram" aria-checked={telegramForm.data.enabled} onClick={() => telegramForm.setData('enabled', !telegramForm.data.enabled)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${telegramForm.data.enabled ? 'border-cyan-300/50 bg-cyan-500/70' : 'border-slate-600 bg-slate-700'}`}>
                                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${telegramForm.data.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <form onSubmit={(event) => event.preventDefault()} className="space-y-5">
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
                                                <div className="flex items-center gap-2"><button type="button" disabled={testingClient !== null} onClick={() => sendTelegramTest(client, index)} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/35 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50"><TestConnectionIcon />{testingClient === `telegram:${client.id}` ? 'Mengirim…' : 'Tes Koneksi'}</button><button type="button" onClick={() => telegramForm.setData('clients', telegramForm.data.clients.filter((item) => item.id !== client.id))} className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950/50"><DeleteIcon />Hapus Client</button></div>
                                        </div>
                                            {connectionTest?.channel === 'telegram' && connectionTest.results.some((result) => result.id === client.id) && <ConnectionTestResults results={connectionTest.results.filter((result) => result.id === client.id)} />}
                                            {testErrors[`telegram:${client.id}`] && <ErrorText>{testErrors[`telegram:${client.id}`]}</ErrorText>}
                                        <div>
                                            <label htmlFor={`telegram-chat-id-${client.id}`} className="mb-1.5 block text-xs font-semibold text-slate-200">Chat ID</label>
                                            <input id={`telegram-chat-id-${client.id}`} value={client.chat_id} onChange={(event) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, chat_id: event.target.value } : item))} placeholder="Contoh: -1001234567890" className={inputClass} />
                                            <ErrorText>{telegramForm.errors[`clients.${index}.chat_id`]}</ErrorText>
                                        </div>
                                        <StatusFields statuses={client.statuses} onChange={(statuses) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, statuses } : item))} />
                                        <TargetSelection targets={targets} selectedIds={client.target_ids} targetAll={client.target_all} onTargetAllChange={(targetAll) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, target_all: targetAll } : item))} onChange={(targetIds) => telegramForm.setData('clients', telegramForm.data.clients.map((item) => item.id === client.id ? { ...item, target_ids: targetIds } : item))} />
                                        <ErrorText>{telegramForm.errors[`clients.${index}.target_ids`]}</ErrorText>
                                    </div>
                                ))}
                                {telegramForm.errors.clients && <ErrorText>{telegramForm.errors.clients}</ErrorText>}
                                <button type="button" onClick={addTelegramClient} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50">＋ Tambah Chat ID</button>
                            </div>

                            <p aria-live="polite" className="text-xs text-slate-400">{telegramForm.processing ? 'Menyimpan perubahan…' : 'Perubahan tersimpan otomatis.'}</p>
                        </form>
                    </section>

                    <section className="cyber-panel rounded-2xl p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-bold text-white"><GoogleChatBrandIcon />Google Chat</h2>
                            </div>
                            <button type="button" role="switch" aria-label="Aktifkan Google Chat" aria-checked={chatForm.data.enabled} onClick={() => chatForm.setData('enabled', !chatForm.data.enabled)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${chatForm.data.enabled ? 'border-cyan-300/50 bg-cyan-500/70' : 'border-slate-600 bg-slate-700'}`}>
                                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white transition-transform ${chatForm.data.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <form onSubmit={(event) => event.preventDefault()} className="space-y-5">
                            <div className="space-y-4">
                                {chatForm.data.clients.map((client, index) => {
                                    const configured = googleChat.clients.find((savedClient) => savedClient.id === client.id)?.configured ?? false;

                                    return (
                                        <div key={client.id} className="space-y-4 rounded-xl border border-cyan-400/15 bg-[#080d19]/70 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-semibold text-cyan-200">Google Chat {index + 1}</h3>
                                                <div className="flex items-center gap-2"><button type="button" disabled={testingClient !== null} onClick={() => sendGoogleChatTest(client, index)} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/35 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-50"><TestConnectionIcon />{testingClient === `google_chat:${client.id}` ? 'Mengirim…' : 'Tes Koneksi'}</button><button type="button" onClick={() => chatForm.setData('clients', chatForm.data.clients.filter((item) => item.id !== client.id))} className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950/50"><DeleteIcon />Hapus Client</button></div>
                                            </div>
                                            {connectionTest?.channel === 'google_chat' && connectionTest.results.some((result) => result.id === client.id) && <ConnectionTestResults results={connectionTest.results.filter((result) => result.id === client.id)} />}
                                            {testErrors[`google_chat:${client.id}`] && <ErrorText>{testErrors[`google_chat:${client.id}`]}</ErrorText>}
                                            <div>
                                                <label htmlFor={`google-webhook-${client.id}`} className="mb-1.5 block text-xs font-semibold text-slate-200">Incoming webhook URL</label>
                                                <input id={`google-webhook-${client.id}`} type="password" autoComplete="new-password" value={client.webhook_url} onChange={(event) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, webhook_url: event.target.value } : item))} placeholder={configured ? 'Webhook tersimpan · isi hanya untuk mengganti' : 'https://chat.googleapis.com/v1/spaces/...'} className={inputClass} />
                                                <ErrorText>{chatForm.errors[`clients.${index}.webhook_url`]}</ErrorText>
                                                {configured && <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={client.clear_webhook} onChange={(event) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, clear_webhook: event.target.checked } : item))} className="accent-rose-400" />Hapus webhook tersimpan</label>}
                                            </div>
                                            <StatusFields statuses={client.statuses} onChange={(statuses) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, statuses } : item))} />
                                            <TargetSelection targets={targets} selectedIds={client.target_ids} targetAll={client.target_all} onTargetAllChange={(targetAll) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, target_all: targetAll } : item))} onChange={(targetIds) => chatForm.setData('clients', chatForm.data.clients.map((item) => item.id === client.id ? { ...item, target_ids: targetIds } : item))} />
                                            <ErrorText>{chatForm.errors[`clients.${index}.target_ids`]}</ErrorText>
                                        </div>
                                    );
                                })}
                                {chatForm.errors.clients && <ErrorText>{chatForm.errors.clients}</ErrorText>}
                                <button type="button" onClick={addGoogleChatClient} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50">＋ Tambah Google Chat</button>
                            </div>

                            <p aria-live="polite" className="text-xs text-slate-400">{chatForm.processing ? 'Menyimpan perubahan…' : 'Perubahan tersimpan otomatis.'}</p>
                        </form>
                    </section>
                </main>
            </div>
        </>
    );
}

function ConnectionTestResults({ results }: { results: NonNullable<SettingsProps['connectionTest']>['results'] }) {
    const successfulCount = results.filter((result) => result.success).length;

    return (
        <div aria-live="polite" className="space-y-2 rounded-lg border border-slate-700 bg-[#070b16] p-3">
            <p className={`text-sm font-semibold ${successfulCount === results.length ? 'text-emerald-300' : 'text-amber-200'}`}>
                Tes koneksi: {successfulCount} dari {results.length} tujuan berhasil.
            </p>
            {results.map((result) => (
                <p key={result.id} className={`text-xs ${result.success ? 'text-emerald-200' : 'text-rose-300'}`}>
                    {result.recipient}: {result.message}
                </p>
            ))}
        </div>
    );
}
