<?php

namespace App\Http\Controllers;

use App\Models\MonitoredTarget;
use App\Models\Pengaturan;
use App\Services\MonitoringNotifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PengaturanController extends Controller
{
    private const DEFAULT_STATUSES = ['critical', 'degraded'];

    public function index(): Response
    {
        $telegram = Pengaturan::query()->find('telegram')?->value ?? [];
        $googleChat = Pengaturan::query()->find('google_chat')?->value ?? [];
        $history = Pengaturan::query()->find('riwayat')?->value ?? [];
        $targets = MonitoredTarget::query()
            ->orderBy('label')
            ->get(['id', 'label', 'host', 'kind'])
            ->map(fn (MonitoredTarget $target): array => [
                'id' => $target->id,
                'label' => $target->label,
                'host' => $target->host,
                'kind' => $target->kind,
            ]);

        return Inertia::render('pengaturan', [
            'targets' => $targets,
            'historySettings' => [
                'statuses' => $history['statuses'] ?? ['healthy', 'degraded', 'critical'],
                'intervalMinutes' => (float) ($history['interval_minutes'] ?? 1),
            ],
            'telegram' => [
                'enabled' => (bool) ($telegram['enabled'] ?? false),
                'tokenConfigured' => filled($telegram['bot_token'] ?? null),
                'clients' => $this->telegramClients($telegram, $targets->pluck('id')->all()),
            ],
            'googleChat' => [
                'enabled' => (bool) ($googleChat['enabled'] ?? false),
                'clients' => $this->googleChatClients($googleChat, $targets->pluck('id')->all()),
            ],
        ]);
    }

    public function updateHistory(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'statuses' => ['present', 'array', 'max:3'],
            'statuses.*' => ['string', 'in:healthy,degraded,critical'],
            'interval_minutes' => ['required', 'numeric', 'min:0.0166667', 'max:10080'],
        ]);

        Pengaturan::query()->updateOrCreate(
            ['key' => 'riwayat'],
            ['value' => [
                'statuses' => array_values(array_unique($validated['statuses'])),
                'interval_minutes' => (float) $validated['interval_minutes'],
            ]],
        );

        return to_route('pengaturan.index');
    }

    public function updateTelegram(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'bot_token' => ['nullable', 'string', 'max:4096'],
            'clear_token' => ['sometimes', 'boolean'],
            'clients' => ['present', 'array', 'list', 'max:50'],
            'clients.*.id' => ['required', 'string', 'max:64', 'distinct'],
            'clients.*.chat_id' => ['nullable', 'string', 'max:255', 'distinct'],
            'clients.*.statuses' => ['present', 'array', 'max:3'],
            'clients.*.statuses.*' => ['string', 'in:healthy,degraded,critical'],
            'clients.*.target_all' => ['required', 'boolean'],
            'clients.*.target_ids' => ['present', 'array', 'list'],
            'clients.*.target_ids.*' => ['integer', 'exists:monitored_targets,id'],
        ]);

        $currentValue = Pengaturan::query()->find('telegram')?->value ?? [];
        $botToken = $this->updatedSecret(
            $validated['bot_token'] ?? '',
            $currentValue['bot_token'] ?? null,
            (bool) ($validated['clear_token'] ?? false),
        );

        if ($validated['enabled'] && ($botToken === null || $validated['clients'] === [])) {
            $errorKey = $botToken === null ? 'bot_token' : 'clients';
            throw ValidationException::withMessages([
                $errorKey => 'Isi token bot dan tambahkan minimal satu Chat ID sebelum mengaktifkan Telegram.',
            ]);
        }

        if ($validated['enabled']) {
            foreach ($validated['clients'] as $index => $client) {
                if (trim((string) ($client['chat_id'] ?? '')) === '') {
                    throw ValidationException::withMessages([
                        "clients.{$index}.chat_id" => 'Isi Chat ID sebelum mengaktifkan client Telegram ini.',
                    ]);
                }

                if (! $client['target_all'] && $client['target_ids'] === []) {
                    throw ValidationException::withMessages([
                        "clients.{$index}.target_ids" => 'Tambahkan minimal satu domain atau IP, atau pilih semua target.',
                    ]);
                }
            }
        }

        Pengaturan::query()->updateOrCreate(
            ['key' => 'telegram'],
            ['value' => [
                'enabled' => (bool) $validated['enabled'],
                'bot_token' => $botToken,
                'clients' => array_map(fn (array $client): array => [
                    'id' => $client['id'],
                    'chat_id' => trim((string) ($client['chat_id'] ?? '')),
                    'statuses' => array_values(array_unique($client['statuses'])),
                    'target_all' => (bool) $client['target_all'],
                    'target_ids' => array_values(array_unique(array_map('intval', $client['target_ids']))),
                ], $validated['clients']),
            ]],
        );

        return to_route('pengaturan.index');
    }

    public function testTelegram(Request $request, MonitoringNotifier $notifier): RedirectResponse
    {
        $validated = $request->validate([
            'bot_token' => ['nullable', 'string', 'max:4096'],
            'clear_token' => ['sometimes', 'boolean'],
            'clients' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'clients.*.id' => ['required', 'string', 'max:64'],
            'clients.*.label' => ['nullable', 'string', 'max:120'],
            'clients.*.chat_id' => ['required', 'string', 'max:255'],
        ]);

        $currentValue = Pengaturan::query()->find('telegram')?->value ?? [];
        $token = trim((string) ($validated['bot_token'] ?? ''));
        if ($token === '') {
            if ($validated['clear_token'] ?? false) {
                throw ValidationException::withMessages([
                    'bot_token' => 'Masukkan token bot untuk melakukan tes koneksi.',
                ]);
            }

            try {
                $token = Crypt::decryptString($currentValue['bot_token'] ?? '');
            } catch (Throwable) {
                throw ValidationException::withMessages([
                    'bot_token' => 'Masukkan token bot sebelum melakukan tes koneksi.',
                ]);
            }
        }

        Inertia::flash('connectionTest', [
            'channel' => 'telegram',
            'results' => $notifier->testTelegram($token, $validated['clients']),
        ]);

        return to_route('pengaturan.index');
    }

    public function updateGoogleChat(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'clients' => ['present', 'array', 'list', 'max:50'],
            'clients.*.id' => ['required', 'string', 'max:64', 'distinct'],
            'clients.*.webhook_url' => ['nullable', 'string', 'max:4096', 'url', 'starts_with:https://'],
            'clients.*.clear_webhook' => ['sometimes', 'boolean'],
            'clients.*.statuses' => ['present', 'array', 'max:3'],
            'clients.*.statuses.*' => ['string', 'in:healthy,degraded,critical'],
            'clients.*.target_all' => ['required', 'boolean'],
            'clients.*.target_ids' => ['present', 'array', 'list'],
            'clients.*.target_ids.*' => ['integer', 'exists:monitored_targets,id'],
        ]);

        $currentValue = Pengaturan::query()->find('google_chat')?->value ?? [];
        $currentClients = $currentValue['clients'] ?? [];
        if (! array_key_exists('clients', $currentValue) && filled($currentValue['webhook_url'] ?? null)) {
            $currentClients = [['id' => 'legacy-0', 'webhook_url' => $currentValue['webhook_url']]];
        }
        $clients = [];

        foreach ($validated['clients'] as $index => $client) {
            $webhookUrl = trim((string) ($client['webhook_url'] ?? ''));
            if ($webhookUrl !== '' && parse_url($webhookUrl, PHP_URL_HOST) !== 'chat.googleapis.com') {
                throw ValidationException::withMessages([
                    "clients.{$index}.webhook_url" => 'Gunakan URL incoming webhook resmi dari chat.googleapis.com.',
                ]);
            }

            $storedClient = collect($currentClients)->firstWhere('id', $client['id']);
            if ($storedClient === null
                && ($currentClients[$index]['id'] ?? null) === null
                && $client['id'] === "legacy-{$index}") {
                $storedClient = $currentClients[$index];
            }
            $storedWebhook = $storedClient['webhook_url'] ?? null;
            $webhookSecret = $this->updatedSecret(
                $webhookUrl,
                $storedWebhook,
                (bool) ($client['clear_webhook'] ?? false),
            );

            if ($validated['enabled'] && $webhookSecret === null) {
                throw ValidationException::withMessages([
                    "clients.{$index}.webhook_url" => 'Isi URL webhook untuk tujuan Google Chat ini.',
                ]);
            }

            $clients[] = [
                'id' => $client['id'],
                'webhook_url' => $webhookSecret,
                'statuses' => array_values(array_unique($client['statuses'])),
                'target_all' => (bool) $client['target_all'],
                'target_ids' => array_values(array_unique(array_map('intval', $client['target_ids']))),
            ];
        }

        if ($validated['enabled'] && $clients === []) {
            throw ValidationException::withMessages([
                'clients' => 'Tambahkan minimal satu webhook Google Chat sebelum mengaktifkan kanal ini.',
            ]);
        }

        if ($validated['enabled']) {
            foreach ($validated['clients'] as $index => $client) {
                if (! $client['target_all'] && $client['target_ids'] === []) {
                    throw ValidationException::withMessages([
                        "clients.{$index}.target_ids" => 'Tambahkan minimal satu domain atau IP, atau pilih semua target.',
                    ]);
                }
            }
        }

        Pengaturan::query()->updateOrCreate(
            ['key' => 'google_chat'],
            ['value' => [
                'enabled' => (bool) $validated['enabled'],
                'clients' => $clients,
            ]],
        );

        return to_route('pengaturan.index');
    }

    public function testGoogleChat(Request $request, MonitoringNotifier $notifier): RedirectResponse
    {
        $validated = $request->validate([
            'clients' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'clients.*.id' => ['required', 'string', 'max:64'],
            'clients.*.label' => ['nullable', 'string', 'max:120'],
            'clients.*.webhook_url' => ['nullable', 'string', 'max:4096', 'url', 'starts_with:https://'],
            'clients.*.clear_webhook' => ['sometimes', 'boolean'],
        ]);

        $currentSettings = Pengaturan::query()->find('google_chat')?->value ?? [];
        $currentClients = $currentSettings['clients'] ?? [];
        if (! array_key_exists('clients', $currentSettings) && filled($currentSettings['webhook_url'] ?? null)) {
            $currentClients = [['id' => 'legacy-0', 'webhook_url' => $currentSettings['webhook_url']]];
        }

        $clients = [];
        foreach ($validated['clients'] as $index => $client) {
            $webhookUrl = trim((string) ($client['webhook_url'] ?? ''));
            if ($webhookUrl !== '' && parse_url($webhookUrl, PHP_URL_HOST) !== 'chat.googleapis.com') {
                throw ValidationException::withMessages([
                    "clients.{$index}.webhook_url" => 'Gunakan URL incoming webhook resmi dari chat.googleapis.com.',
                ]);
            }

            if ($webhookUrl === '') {
                if ($client['clear_webhook'] ?? false) {
                    throw ValidationException::withMessages([
                        "clients.{$index}.webhook_url" => 'Masukkan URL webhook untuk melakukan tes koneksi.',
                    ]);
                }

                $storedClient = collect($currentClients)->firstWhere('id', $client['id']);
                if ($storedClient === null
                    && ($currentClients[$index]['id'] ?? null) === null
                    && $client['id'] === "legacy-{$index}") {
                    $storedClient = $currentClients[$index];
                }

                try {
                    $webhookUrl = Crypt::decryptString($storedClient['webhook_url'] ?? '');
                } catch (Throwable) {
                    throw ValidationException::withMessages([
                        "clients.{$index}.webhook_url" => 'Masukkan URL webhook sebelum melakukan tes koneksi.',
                    ]);
                }
            }

            $clients[] = [
                'id' => $client['id'],
                'label' => $client['label'] ?? null,
                'webhook_url' => $webhookUrl,
            ];
        }

        Inertia::flash('connectionTest', [
            'channel' => 'google_chat',
            'results' => $notifier->testGoogleChat($clients),
        ]);

        return to_route('pengaturan.index');
    }

    /** @param array<string, mixed> $settings
     * @param  list<int>  $allTargetIds
     * @return list<array{id: string, chatId: string, targetIds: list<int>, targetAll: bool, statuses: list<string>}>
     */
    private function telegramClients(array $settings, array $allTargetIds): array
    {
        $clients = $settings['clients'] ?? null;
        if (is_array($clients)) {
            return array_map(fn (array $client, int $index): array => [
                'id' => (string) ($client['id'] ?? "legacy-{$index}"),
                'chatId' => (string) ($client['chat_id'] ?? ''),
                'targetIds' => array_values(array_intersect(array_map('intval', $client['target_ids'] ?? []), $allTargetIds)),
                'targetAll' => (bool) ($client['target_all'] ?? $this->targetsAreAll($client['target_ids'] ?? [], $allTargetIds)),
                'statuses' => $client['statuses'] ?? $settings['statuses'] ?? self::DEFAULT_STATUSES,
            ], $clients, array_keys($clients));
        }

        if (filled($settings['chat_id'] ?? null)) {
            return [[
                'id' => 'legacy-0',
                'chatId' => (string) $settings['chat_id'],
                'targetIds' => $allTargetIds,
                'targetAll' => true,
                'statuses' => $settings['statuses'] ?? self::DEFAULT_STATUSES,
            ]];
        }

        return [];
    }

    /** @param array<string, mixed> $settings
     * @param  list<int>  $allTargetIds
     * @return list<array{id: string, configured: bool, targetIds: list<int>, targetAll: bool, statuses: list<string>}>
     */
    private function googleChatClients(array $settings, array $allTargetIds): array
    {
        $clients = $settings['clients'] ?? null;
        if (is_array($clients)) {
            return array_map(fn (array $client, int $index): array => [
                'id' => (string) ($client['id'] ?? "legacy-{$index}"),
                'configured' => filled($client['webhook_url'] ?? null),
                'targetIds' => array_values(array_intersect(array_map('intval', $client['target_ids'] ?? []), $allTargetIds)),
                'targetAll' => (bool) ($client['target_all'] ?? $this->targetsAreAll($client['target_ids'] ?? [], $allTargetIds)),
                'statuses' => $client['statuses'] ?? $settings['statuses'] ?? self::DEFAULT_STATUSES,
            ], $clients, array_keys($clients));
        }

        if (filled($settings['webhook_url'] ?? null)) {
            return [[
                'id' => 'legacy-0',
                'configured' => true,
                'targetIds' => $allTargetIds,
                'targetAll' => true,
                'statuses' => $settings['statuses'] ?? self::DEFAULT_STATUSES,
            ]];
        }

        return [];
    }

    private function updatedSecret(string $newSecret, ?string $storedSecret, bool $clear): ?string
    {
        if ($clear) {
            return null;
        }

        $newSecret = trim($newSecret);

        return $newSecret !== '' ? Crypt::encryptString($newSecret) : $storedSecret;
    }

    /** @param list<int|string> $selectedTargetIds
     * @param  list<int>  $allTargetIds
     */
    private function targetsAreAll(array $selectedTargetIds, array $allTargetIds): bool
    {
        $selectedTargetIds = array_values(array_unique(array_map('intval', $selectedTargetIds)));

        return $selectedTargetIds === [] || $allTargetIds === [] || array_diff($allTargetIds, $selectedTargetIds) === [];
    }
}
