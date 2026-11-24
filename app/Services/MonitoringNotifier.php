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
        if (! ($settings['enabled'] ?? false) || ! in_array($target->status, $settings['statuses'] ?? [], true)) {
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
        if (! ($settings['enabled'] ?? false) || ! in_array($target->status, $settings['statuses'] ?? [], true)) {
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
