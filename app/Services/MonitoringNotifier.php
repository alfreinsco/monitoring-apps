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
            $response = Http::asForm()->connectTimeout(4)->timeout(8)->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $settings['chat_id'],
                'text' => $message,
            ])->throw();

            if (! $response->json('ok')) {
                throw new \RuntimeException('Telegram menolak pengiriman pesan.');
            }
        } catch (Throwable $exception) {
            Log::warning('Gagal mengirim notifikasi Telegram.', ['exception' => $exception::class]);
        }
    }

    private function sendGoogleChat(MonitoredTarget $target, string $message): void
    {
        $settings = Pengaturan::query()->find('google_chat')?->value ?? [];
        if (! ($settings['enabled'] ?? false) || ! in_array($target->status, $settings['statuses'] ?? [], true)) {
            return;
        }

        try {
            $webhookUrl = Crypt::decryptString($settings['webhook_url'] ?? '');
            Http::connectTimeout(4)->timeout(8)->post($webhookUrl, ['text' => $message])->throw();
        } catch (Throwable $exception) {
            Log::warning('Gagal mengirim notifikasi Google Chat.', ['exception' => $exception::class]);
        }
    }
}
