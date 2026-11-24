<?php

namespace App\Services;

use App\Models\MonitoredTarget;
use App\Models\Pengaturan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class MonitoringNotifier
{
    private const DEFAULT_STATUSES = ['critical', 'degraded'];

    /**
     * @param  list<array{id: string, chat_id: string, label?: string}>  $clients
     * @return list<array{id: string, recipient: string, success: bool, message: string}>
     */
    public function testTelegram(string $token, array $clients): array
    {
        $results = [];
        $message = 'Tes koneksi berhasil. Monitoring Domain & IP dapat mengirim notifikasi ke Chat ID ini.';

        foreach ($clients as $index => $client) {
            try {
                $response = Http::asForm()->connectTimeout(4)->timeout(8)->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $client['chat_id'],
                    'text' => $message,
                ]);
                $success = $response->successful() && $response->json('ok') === true;

                $results[] = [
                    'id' => $client['id'],
                    'recipient' => $client['label'] ?? 'Chat ID '.$client['chat_id'],
                    'success' => $success,
                    'message' => $success ? 'Pesan tes berhasil dikirim.' : 'Telegram menolak pesan tes. Periksa token dan Chat ID.',
                ];
            } catch (Throwable $exception) {
                Log::warning('Tes koneksi Telegram gagal.', ['exception' => $exception::class]);
                $results[] = [
                    'id' => $client['id'],
                    'recipient' => $client['label'] ?? 'Chat ID '.$client['chat_id'],
                    'success' => false,
                    'message' => 'Koneksi gagal. Periksa jaringan, token bot, dan Chat ID.',
                ];
            }
        }

        return $results;
    }

    /**
     * @param  list<array{id: string, webhook_url: string, label?: string}>  $clients
     * @return list<array{id: string, recipient: string, success: bool, message: string}>
     */
    public function testGoogleChat(array $clients): array
    {
        $results = [];
        $message = 'Tes koneksi berhasil. Monitoring Domain & IP dapat mengirim notifikasi ke ruang Google Chat ini.';

        foreach ($clients as $index => $client) {
            try {
                $response = Http::connectTimeout(4)->timeout(8)->post($client['webhook_url'], ['text' => $message]);
                $success = $response->successful();

                $results[] = [
                    'id' => $client['id'],
                    'recipient' => $client['label'] ?? 'Google Chat '.($index + 1),
                    'success' => $success,
                    'message' => $success ? 'Pesan tes berhasil dikirim.' : 'Webhook menolak pesan tes. Periksa konfigurasi webhook.',
                ];
            } catch (Throwable $exception) {
                Log::warning('Tes koneksi Google Chat gagal.', ['exception' => $exception::class]);
                $results[] = [
                    'id' => $client['id'],
                    'recipient' => $client['label'] ?? 'Google Chat '.($index + 1),
                    'success' => false,
                    'message' => 'Koneksi gagal. Periksa jaringan dan URL webhook.',
                ];
            }
        }

        return $results;
    }

    public function notifyStatusChange(MonitoredTarget $target, string $previousStatus): void
    {
        if ($previousStatus === $target->status) {
            return;
        }

        $message = "Monitoring {$target->host}: {$previousStatus} → {$target->status}\nUptime: {$target->uptime}% · Latensi: {$target->latency_ms} ms · Skor ancaman: {$target->threat_score}";

        $this->sendTelegram($target, $message);
        $this->sendGoogleChat($target, $message);
    }

    private function sendTelegram(MonitoredTarget $target, string $message): void
    {
        $settings = Pengaturan::query()->find('telegram')?->value ?? [];
        if (! ($settings['enabled'] ?? false)) {
            return;
        }

        try {
            $token = Crypt::decryptString($settings['bot_token'] ?? '');
        } catch (Throwable $exception) {
            Log::warning('Gagal mengirim notifikasi Telegram.', ['exception' => $exception::class]);

            return;
        }

        $clients = $settings['clients'] ?? null;
        if (! is_array($clients) && filled($settings['chat_id'] ?? null)) {
            $clients = [[
                'chat_id' => $settings['chat_id'],
                'target_all' => true,
                'target_ids' => [$target->id],
            ]];
        }

        foreach ($clients ?? [] as $client) {
            $statuses = $client['statuses'] ?? $settings['statuses'] ?? self::DEFAULT_STATUSES;
            if (! in_array($target->status, $statuses, true)) {
                continue;
            }

            $targetIds = array_map('intval', $client['target_ids'] ?? []);
            $receivesAllTargets = (bool) ($client['target_all'] ?? ($targetIds === []));
            if (! $receivesAllTargets && ! in_array($target->id, $targetIds, true)) {
                continue;
            }

            try {
                $response = Http::asForm()->connectTimeout(4)->timeout(8)->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $client['chat_id'],
                    'text' => $message,
                ])->throw();

                if (! $response->json('ok')) {
                    throw new \RuntimeException('Telegram menolak pengiriman pesan.');
                }
            } catch (Throwable $exception) {
                Log::warning('Gagal mengirim notifikasi Telegram.', ['exception' => $exception::class]);
            }
        }
    }

    private function sendGoogleChat(MonitoredTarget $target, string $message): void
    {
        $settings = Pengaturan::query()->find('google_chat')?->value ?? [];
        if (! ($settings['enabled'] ?? false)) {
            return;
        }

        $clients = $settings['clients'] ?? null;
        if (! is_array($clients) && filled($settings['webhook_url'] ?? null)) {
            $clients = [
                'legacy_webhook' => [
                    'webhook_url' => $settings['webhook_url'],
                    'target_all' => true,
                    'target_ids' => [$target->id],
                ],
            ];
        }

        foreach ($clients ?? [] as $client) {
            $statuses = $client['statuses'] ?? $settings['statuses'] ?? self::DEFAULT_STATUSES;
            if (! in_array($target->status, $statuses, true)) {
                continue;
            }

            $targetIds = array_map('intval', $client['target_ids'] ?? []);
            $receivesAllTargets = (bool) ($client['target_all'] ?? ($targetIds === []));
            if (! $receivesAllTargets && ! in_array($target->id, $targetIds, true)) {
                continue;
            }

            try {
                $webhookUrl = Crypt::decryptString($client['webhook_url'] ?? '');
                Http::connectTimeout(4)->timeout(8)->post($webhookUrl, ['text' => $message])->throw();
            } catch (Throwable $exception) {
                Log::warning('Gagal mengirim notifikasi Google Chat.', ['exception' => $exception::class]);
            }
        }
    }
}
