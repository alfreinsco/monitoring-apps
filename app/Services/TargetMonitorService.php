<?php

namespace App\Services;

use App\Models\MonitoredTarget;
use App\Models\MonitoringHistory;
use App\Models\Pengaturan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class TargetMonitorService
{
    public function __construct(private readonly MonitoringNotifier $notifier) {}

    /**
     * Jalankan pemeriksaan kesehatan & keamanan nyata untuk seluruh target atau satu target tertentu.
     */
    public function checkAll(): int
    {
        $targets = MonitoredTarget::query()->where('is_active', true)->get();

        foreach ($targets as $target) {
            $this->checkTarget($target);
        }

        return $targets->count();
    }

    /** Simpan snapshot target sesuai status dan interval yang dikonfigurasi. */
    public function recordDueHistories(): int
    {
        $settings = Pengaturan::query()->find('riwayat')?->value ?? [];
        $statuses = $settings['statuses'] ?? ['healthy', 'degraded', 'critical'];
        $intervalSeconds = max(1, ((float) ($settings['interval_minutes'] ?? 1)) * 60);
        $latestChecks = MonitoringHistory::query()
            ->selectRaw('monitored_target_id, MAX(checked_at) as last_checked_at')
            ->groupBy('monitored_target_id')
            ->pluck('last_checked_at', 'monitored_target_id');
        $now = now();
        $recorded = 0;

        foreach (MonitoredTarget::query()->where('is_active', true)->get() as $target) {
            if (! in_array($target->status, $statuses, true)) {
                continue;
            }

            $lastCheckedAt = $latestChecks->get($target->id);
            if ($lastCheckedAt !== null && Carbon::parse($lastCheckedAt)->diffInSeconds($now) + 0.001 < $intervalSeconds) {
                continue;
            }

            $target->histories()->create([
                'host' => $target->host,
                'status' => $target->status,
                'uptime' => $target->uptime,
                'latency_ms' => $target->latency_ms,
                'p95_ms' => $target->p95_ms,
                'http_status' => $target->http_status,
                'ssl_days_remaining' => $target->ssl_days_remaining,
                'tls_version' => $target->tls_version,
                'threat_score' => $target->threat_score,
                'findings' => $target->recent_findings ?? [],
                'checked_at' => $now,
            ]);
            $latestChecks->put($target->id, $now->toDateTimeString());
            $recorded++;
        }

        return $recorded;
    }

    public function checkTarget(MonitoredTarget $target): MonitoredTarget
    {
        if (! $target->is_active) {
            return $target;
        }

        $previousStatus = (string) $target->status;
        $checkedAt = now();

        if ($target->kind === 'ip') {
            $result = $this->probeIpTarget($target);
        } else {
            $result = $this->probeDomainTarget($target);
        }

        $history = is_array($target->history) ? $target->history : [];
        $history[] = $result['latency_ms'];
        if (count($history) > 12) {
            $history = array_slice($history, -12);
        }

        $p95Ms = $this->calculateP95($history, $result['latency_ms']);
        $uptime = $this->recalculateUptime((float) $target->uptime, $result['status']);

        DB::transaction(function () use ($target, $result, $uptime, $p95Ms, $history, $checkedAt): void {
            $target->update([
                'status' => $result['status'],
                'uptime' => $uptime,
                'latency_ms' => $result['latency_ms'],
                'p95_ms' => $p95Ms,
                'http_status' => $result['http_status'],
                'ssl_days_remaining' => $result['ssl_days_remaining'],
                'tls_version' => $result['tls_version'],
                'threat_score' => $result['threat_score'],
                'last_checked' => "Pukul {$checkedAt->format('H:i:s')} WIT",
                'history' => $history,
                'recent_findings' => $result['recent_findings'],
            ]);

        });

        $updatedTarget = $target->fresh() ?? $target;
        $this->notifier->notifyStatusChange($updatedTarget, $previousStatus);

        return $updatedTarget;
    }

    /**
     * @return array{
     *     status: string,
     *     latency_ms: int,
     *     http_status: string,
     *     ssl_days_remaining: int|null,
     *     tls_version: string,
     *     threat_score: int,
     *     recent_findings: list<string>
     * }
     */
    private function probeDomainTarget(MonitoredTarget $target): array
    {
        $url = $target->url ?: "https://{$target->host}";
        $sslInfo = $this->inspectSslCertificate($target->host);
        $findings = [];
        $threatScore = 5;
        $ports = array_values(array_filter(array_map(
            static fn (string $port): int => (int) trim($port),
            explode(',', $target->monitored_ports ?: '443'),
        )));
        $closedPorts = [];

        foreach ($ports as $port) {
            $errno = 0;
            $errstr = '';
            $socket = @fsockopen($target->host, $port, $errno, $errstr, 2.0);

            if (is_resource($socket)) {
                fclose($socket);
            } else {
                $closedPorts[] = $port;
            }
        }

        $start = hrtime(true);

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'SentinelGrid-UNPATTI-Monitor/1.0',
                'Accept' => 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            ])
                ->withOptions([
                    'verify' => true,
                    'allow_redirects' => false,
                ])
                ->connectTimeout(6)
                ->timeout(12)
                ->get($url);

            $latencyMs = max(1, (int) round((hrtime(true) - $start) / 1_000_000));
            $code = $response->status();
            $reason = $this->httpReasonPhrase($code);
            $httpStatus = "{$code} {$reason}";

            if ($code >= 500) {
                $status = 'critical';
                $threatScore += 65;
                $findings[] = "Server mengembalikan galat HTTP {$httpStatus} saat pemindaian aktif";
            } elseif ($code === 429 || $code === 403) {
                $status = 'degraded';
                $threatScore += 30;
                $findings[] = "Endpoint merespons pembatasan akses/WAF ({$httpStatus})";
            } elseif ($code >= 400) {
                $status = 'degraded';
                $threatScore += 35;
                $findings[] = "Respons klien tidak normal ({$httpStatus}) pada rute utama";
            } elseif ($latencyMs > 1800) {
                $status = 'degraded';
                $threatScore += 22;
                $findings[] = "Latensi respons tinggi ({$latencyMs} ms), melampaui ambang 1.800 ms";
            } else {
                $status = 'healthy';
                $findings[] = "Endpoint HTTPS aktif ({$httpStatus}) dengan RTT {$latencyMs} ms";
            }

            if ($closedPorts !== []) {
                if ($status === 'healthy') {
                    $status = 'degraded';
                }
                $threatScore += 12;
                $findings[] = 'Port TCP tidak merespons: '.implode(', ', $closedPorts);
            }

            // Periksa header keamanan HTTP dasar
            $hasHsts = $response->hasHeader('Strict-Transport-Security');
            $hasXFrame = $response->hasHeader('X-Frame-Options') || $response->hasHeader('Content-Security-Policy');

            if ($hasHsts) {
                $findings[] = 'Header HSTS (Strict-Transport-Security) terdeteksi aktif';
            } else {
                $threatScore += 6;
                $findings[] = 'Header HSTS belum terpasang pada respons utama';
            }

            if (! $hasXFrame) {
                $threatScore += 5;
            }

            // Evaluasi SSL/TLS
            if ($sslInfo['days_remaining'] !== null) {
                if ($sslInfo['days_remaining'] <= 0) {
                    $status = 'critical';
                    $threatScore += 50;
                    $findings[] = 'Sertifikat SSL/TLS telah kedaluwarsa!';
                } elseif ($sslInfo['days_remaining'] <= 14) {
                    if ($status === 'healthy') {
                        $status = 'degraded';
                    }
                    $threatScore += 25;
                    $findings[] = "Sertifikat SSL akan berakhir dalam {$sslInfo['days_remaining']} hari";
                } else {
                    $findings[] = "Sertifikat {$sslInfo['tls_version']} valid ({$sslInfo['days_remaining']} hari tersisa)";
                }
            } else {
                $threatScore += 15;
                $findings[] = 'Handshake SSL/TLS tidak dapat diverifikasi langsung pada port 443';
            }

            return [
                'status' => $status,
                'latency_ms' => $latencyMs,
                'http_status' => $httpStatus,
                'ssl_days_remaining' => $sslInfo['days_remaining'],
                'tls_version' => $sslInfo['tls_version'],
                'threat_score' => min(100, $threatScore),
                'recent_findings' => array_slice($findings, 0, 4),
            ];
        } catch (Throwable $e) {
            $latencyMs = max(1, (int) round((hrtime(true) - $start) / 1_000_000));
            $message = Str::limit($e->getMessage(), 110);

            return [
                'status' => 'critical',
                'latency_ms' => $latencyMs,
                'http_status' => 'Timeout / Unreachable',
                'ssl_days_remaining' => $sslInfo['days_remaining'],
                'tls_version' => $sslInfo['tls_version'],
                'threat_score' => 88,
                'recent_findings' => [
                    "Gagal menjangkau {$target->host}: {$message}",
                    'Periksa layanan web server (Nginx/Apache), DNS, atau aturan firewall',
                ],
            ];
        }
    }

    /**
     * @return array{
     *     status: string,
     *     latency_ms: int,
     *     http_status: string,
     *     ssl_days_remaining: int|null,
     *     tls_version: string,
     *     threat_score: int,
     *     recent_findings: list<string>
     * }
     */
    private function probeIpTarget(MonitoredTarget $target): array
    {
        $ports = array_values(array_filter(array_map(
            static fn (string $p): int => (int) trim($p),
            explode(',', $target->monitored_ports ?: '443'),
        )));

        if ($ports === []) {
            $ports = [443];
        }

        $openPorts = [];
        $closedPorts = [];
        $latencies = [];

        foreach ($ports as $port) {
            $start = hrtime(true);
            $errno = 0;
            $errstr = '';
            $socket = @fsockopen($target->host, $port, $errno, $errstr, 3.0);
            $elapsed = max(1, (int) round((hrtime(true) - $start) / 1_000_000));

            if (is_resource($socket)) {
                fclose($socket);
                $openPorts[] = $port;
                $latencies[] = $elapsed;
            } else {
                $closedPorts[] = $port;
            }
        }

        $avgLatency = $latencies !== [] ? (int) round(array_sum($latencies) / count($latencies)) : 3000;

        if ($openPorts === []) {
            return [
                'status' => 'critical',
                'latency_ms' => $avgLatency,
                'http_status' => 'TCP Unreachable',
                'ssl_days_remaining' => null,
                'tls_version' => 'Pemindaian TCP Langsung',
                'threat_score' => 85,
                'recent_findings' => [
                    'Seluruh port pantauan ('.implode(', ', $ports).') tidak merespons',
                    'Periksa konektivitas jaringan host atau aturan firewall',
                ],
            ];
        }

        $status = $closedPorts !== [] || $avgLatency > 350 ? 'degraded' : 'healthy';
        $threatScore = $status === 'healthy' ? 12 : 42;
        $findings = [
            'Port TCP terbuka: '.implode(', ', $openPorts)." (RTT rata-rata {$avgLatency} ms)",
        ];

        if ($closedPorts !== []) {
            $findings[] = 'Port tertutup/terfilter: '.implode(', ', $closedPorts);
        }

        return [
            'status' => $status,
            'latency_ms' => $avgLatency,
            'http_status' => 'TCP/'.implode(',', $openPorts).' Aktif',
            'ssl_days_remaining' => null,
            'tls_version' => 'Pemindaian TCP Langsung',
            'threat_score' => $threatScore,
            'recent_findings' => $findings,
        ];
    }

    /**
     * @return array{days_remaining: int|null, tls_version: string}
     */
    private function inspectSslCertificate(string $host): array
    {
        try {
            $context = stream_context_create([
                'ssl' => [
                    'capture_peer_cert' => true,
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'SNI_enabled' => true,
                    'peer_name' => $host,
                ],
            ]);

            $errno = 0;
            $errstr = '';
            $client = @stream_socket_client(
                "ssl://{$host}:443",
                $errno,
                $errstr,
                5.0,
                STREAM_CLIENT_CONNECT,
                $context,
            );

            if (! is_resource($client)) {
                return ['days_remaining' => null, 'tls_version' => 'TLS Tidak Terbaca'];
            }

            $params = stream_context_get_params($client);
            $cryptoMeta = stream_get_meta_data($client);
            fclose($client);

            $protocol = $cryptoMeta['crypto']['protocol'] ?? 'TLS 1.3';
            $tlsVersion = str_starts_with(strtoupper((string) $protocol), 'TLS') ? strtoupper((string) $protocol) : 'TLS 1.3';

            $certResource = $params['options']['ssl']['peer_certificate'] ?? null;
            if ($certResource === null) {
                return ['days_remaining' => null, 'tls_version' => $tlsVersion];
            }

            $parsed = openssl_x509_parse($certResource);
            if (! is_array($parsed) || ! isset($parsed['validTo_time_t'])) {
                return ['days_remaining' => null, 'tls_version' => $tlsVersion];
            }

            $validTo = Carbon::createFromTimestamp((int) $parsed['validTo_time_t']);
            $daysRemaining = (int) now()->diffInDays($validTo, false);

            return [
                'days_remaining' => max(0, $daysRemaining),
                'tls_version' => $tlsVersion,
            ];
        } catch (Throwable) {
            return ['days_remaining' => null, 'tls_version' => 'TLS 1.3'];
        }
    }

    /**
     * @param  list<int>  $history
     */
    private function calculateP95(array $history, int $fallback): int
    {
        if ($history === []) {
            return $fallback;
        }

        sort($history);
        $index = (int) ceil(count($history) * 0.95) - 1;
        $index = max(0, min(count($history) - 1, $index));

        return (int) $history[$index];
    }

    private function recalculateUptime(float $currentUptime, string $status): float
    {
        $sampleScore = match ($status) {
            'healthy' => 100.0,
            'degraded' => 98.5,
            default => 90.0,
        };

        $updated = ($currentUptime * 0.92) + ($sampleScore * 0.08);

        return round(min(100.0, max(0.0, $updated)), 2);
    }

    private function httpReasonPhrase(int $code): string
    {
        return match ($code) {
            200 => 'OK',
            201 => 'Created',
            301 => 'Moved',
            302 => 'Found',
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            429 => 'Too Many Requests',
            500 => 'Internal Server Error',
            502 => 'Bad Gateway',
            503 => 'Service Unavailable',
            504 => 'Gateway Timeout',
            default => 'HTTP',
        };
    }
}

function StrLimit(string $value, int $limit): string
{
    return mb_strlen($value) > $limit ? mb_substr($value, 0, $limit - 3).'...' : $value;
}
