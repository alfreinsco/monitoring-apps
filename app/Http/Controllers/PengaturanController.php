<?php

namespace App\Http\Controllers;

use App\Models\Pengaturan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class PengaturanController extends Controller
{
    private const DEFAULT_STATUSES = ['critical', 'degraded'];

    public function index(): Response
    {
        $telegram = Pengaturan::query()->find('telegram')?->value ?? [];
        $googleChat = Pengaturan::query()->find('google_chat')?->value ?? [];

        return Inertia::render('pengaturan', [
            'telegram' => [
                'enabled' => (bool) ($telegram['enabled'] ?? false),
                'chatId' => (string) ($telegram['chat_id'] ?? ''),
                'tokenConfigured' => filled($telegram['bot_token'] ?? null),
                'statuses' => $telegram['statuses'] ?? self::DEFAULT_STATUSES,
            ],
            'googleChat' => [
                'enabled' => (bool) ($googleChat['enabled'] ?? false),
                'webhookConfigured' => filled($googleChat['webhook_url'] ?? null),
                'statuses' => $googleChat['statuses'] ?? self::DEFAULT_STATUSES,
            ],
        ]);
    }

    public function updateTelegram(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'bot_token' => ['nullable', 'string', 'max:4096'],
            'chat_id' => ['nullable', 'string', 'max:255'],
            'clear_token' => ['sometimes', 'boolean'],
            'statuses' => ['present', 'array', 'max:3'],
            'statuses.*' => ['string', 'in:healthy,degraded,critical'],
        ]);

        $currentValue = Pengaturan::query()->find('telegram')?->value ?? [];
        $botToken = $this->updatedSecret(
            $validated['bot_token'] ?? '',
            $currentValue['bot_token'] ?? null,
            (bool) ($validated['clear_token'] ?? false),
        );
        $chatId = trim((string) ($validated['chat_id'] ?? $currentValue['chat_id'] ?? ''));

        if ($validated['enabled'] && ($botToken === null || $chatId === '')) {
            $errorKey = $botToken === null ? 'bot_token' : 'chat_id';
            throw ValidationException::withMessages([
                $errorKey => 'Isi token bot dan Chat ID sebelum mengaktifkan Telegram.',
            ]);
        }

        Pengaturan::query()->updateOrCreate(
            ['key' => 'telegram'],
            ['value' => [
                'enabled' => (bool) $validated['enabled'],
                'bot_token' => $botToken,
                'chat_id' => $chatId,
                'statuses' => array_values(array_unique($validated['statuses'])),
            ]],
        );

        return to_route('pengaturan.index');
    }

    public function updateGoogleChat(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'webhook_url' => ['nullable', 'string', 'max:4096', 'url', 'starts_with:https://'],
            'clear_webhook' => ['sometimes', 'boolean'],
            'statuses' => ['present', 'array', 'max:3'],
            'statuses.*' => ['string', 'in:healthy,degraded,critical'],
        ]);

        $webhookUrl = trim((string) ($validated['webhook_url'] ?? ''));
        if ($webhookUrl !== '' && parse_url($webhookUrl, PHP_URL_HOST) !== 'chat.googleapis.com') {
            throw ValidationException::withMessages([
                'webhook_url' => 'Gunakan URL incoming webhook resmi dari chat.googleapis.com.',
            ]);
        }

        $currentValue = Pengaturan::query()->find('google_chat')?->value ?? [];
        $encryptedWebhook = $this->updatedSecret(
            $webhookUrl,
            $currentValue['webhook_url'] ?? null,
            (bool) ($validated['clear_webhook'] ?? false),
        );

        if ($validated['enabled'] && $encryptedWebhook === null) {
            throw ValidationException::withMessages([
                'webhook_url' => 'Isi URL incoming webhook sebelum mengaktifkan Google Chat.',
            ]);
        }

        Pengaturan::query()->updateOrCreate(
            ['key' => 'google_chat'],
            ['value' => [
                'enabled' => (bool) $validated['enabled'],
                'webhook_url' => $encryptedWebhook,
                'statuses' => array_values(array_unique($validated['statuses'])),
            ]],
        );

        return to_route('pengaturan.index');
    }

    private function updatedSecret(string $newSecret, ?string $storedSecret, bool $clear): ?string
    {
        if ($clear) {
            return null;
        }

        $newSecret = trim($newSecret);

        return $newSecret !== '' ? Crypt::encryptString($newSecret) : $storedSecret;
    }
}
