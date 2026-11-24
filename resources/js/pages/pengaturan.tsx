import { Head, useForm } from '@inertiajs/react';
import { updateGoogleChat, updateTelegram } from '@/actions/App/Http/Controllers/PengaturanController';
import AppNavbar from '@/components/app-navbar';

type Status = 'healthy' | 'degraded' | 'critical';

interface ChannelSettings {
    enabled: boolean;
    statuses: Status[];
}

interface SettingsProps {
    telegram: ChannelSettings & { chatId: string; tokenConfigured: boolean };
    googleChat: ChannelSettings & { webhookConfigured: boolean };
}

const statusOptions: { value: Status; label: string }[] = [
    { value: 'healthy', label: 'Normal' },
    { value: 'degraded', label: 'Terganggu' },
    { value: 'critical', label: 'Kritis' },
];

const inputClass = 'w-full rounded-lg border border-cyan-400/35 bg-[#060a14] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none';

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

function ErrorText({ children }: { children?: string }) {
    return children ? <p className="mt-1 text-xs text-rose-300">{children}</p> : null;
}

export default function Pengaturan({ telegram, googleChat }: SettingsProps) {
    const telegramForm = useForm({
        enabled: telegram.enabled,
        bot_token: '',
        chat_id: telegram.chatId,
        clear_token: false,
        statuses: telegram.statuses,
    });
    const chatForm = useForm({
        enabled: googleChat.enabled,
        webhook_url: '',
        clear_webhook: false,
        statuses: googleChat.statuses,
    });

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
                                <p className="mt-1 text-sm text-slate-400">Kirim notifikasi ketika status monitoring berubah.</p>
                            </div>
                            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
                                <input type="checkbox" checked={telegramForm.data.enabled} onChange={(event) => telegramForm.setData('enabled', event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                                Aktif
                            </label>
                        </div>
                        <form onSubmit={(event) => { event.preventDefault(); telegramForm.put(updateTelegram.url(), { preserveScroll: true, onSuccess: () => telegramForm.reset('bot_token', 'clear_token') }); }} className="space-y-5">
                            <div>
                                <label htmlFor="telegram-token" className="mb-1.5 block text-xs font-semibold text-slate-200">Bot token</label>
                                <input id="telegram-token" type="password" autoComplete="new-password" value={telegramForm.data.bot_token} onChange={(event) => telegramForm.setData('bot_token', event.target.value)} placeholder={telegram.tokenConfigured ? 'Token tersimpan · isi hanya untuk mengganti' : 'Masukkan token bot Telegram'} className={inputClass} />
                                <ErrorText>{telegramForm.errors.bot_token}</ErrorText>
                                {telegram.tokenConfigured && <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={telegramForm.data.clear_token} onChange={(event) => telegramForm.setData('clear_token', event.target.checked)} className="accent-rose-400" />Hapus token tersimpan</label>}
                            </div>
                            <div>
                                <label htmlFor="telegram-chat-id" className="mb-1.5 block text-xs font-semibold text-slate-200">Chat ID</label>
                                <input id="telegram-chat-id" value={telegramForm.data.chat_id} onChange={(event) => telegramForm.setData('chat_id', event.target.value)} placeholder="Contoh: -1001234567890" className={inputClass} />
                                <ErrorText>{telegramForm.errors.chat_id}</ErrorText>
                            </div>
                            <StatusFields statuses={telegramForm.data.statuses} onChange={(statuses) => telegramForm.setData('statuses', statuses)} />
                            <button disabled={telegramForm.processing} className="rounded-lg border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50">{telegramForm.processing ? 'Menyimpan…' : 'Simpan Telegram'}</button>
                        </form>
                    </section>

                    <section className="cyber-panel rounded-2xl p-5 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-bold text-white">Google Chat</h2>
                                <p className="mt-1 text-sm text-slate-400">Kirim notifikasi melalui incoming webhook Google Chat.</p>
                            </div>
                            <label className="flex shrink-0 items-center gap-2 text-sm text-slate-200">
                                <input type="checkbox" checked={chatForm.data.enabled} onChange={(event) => chatForm.setData('enabled', event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                                Aktif
                            </label>
                        </div>
                        <form onSubmit={(event) => { event.preventDefault(); chatForm.put(updateGoogleChat.url(), { preserveScroll: true, onSuccess: () => chatForm.reset('webhook_url', 'clear_webhook') }); }} className="space-y-5">
                            <div>
                                <label htmlFor="google-chat-webhook" className="mb-1.5 block text-xs font-semibold text-slate-200">Incoming webhook URL</label>
                                <input id="google-chat-webhook" type="password" autoComplete="new-password" value={chatForm.data.webhook_url} onChange={(event) => chatForm.setData('webhook_url', event.target.value)} placeholder={googleChat.webhookConfigured ? 'Webhook tersimpan · isi hanya untuk mengganti' : 'https://chat.googleapis.com/v1/spaces/...'} className={inputClass} />
                                <ErrorText>{chatForm.errors.webhook_url}</ErrorText>
                                {googleChat.webhookConfigured && <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={chatForm.data.clear_webhook} onChange={(event) => chatForm.setData('clear_webhook', event.target.checked)} className="accent-rose-400" />Hapus webhook tersimpan</label>}
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
