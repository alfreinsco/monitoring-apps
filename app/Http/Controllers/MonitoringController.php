<?php

namespace App\Http\Controllers;

use App\Models\MonitoredTarget;
use App\Models\SecurityEvent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class MonitoringController extends Controller
{
    public function index(): Response
    {
        $targets = MonitoredTarget::query()
            ->orderByDesc('id')
            ->get()
            ->map(fn (MonitoredTarget $target): array => [
                'id' => (string) $target->id,
                'label' => $target->label,
                'host' => $target->host,
                'url' => $target->url,
                'kind' => $target->kind,
                'status' => $target->status,
                'uptime' => $target->uptime,
                'latencyMs' => $target->latency_ms,
                'p95Ms' => $target->p95_ms,
                'httpStatus' => $target->http_status,
                'sslDaysRemaining' => $target->ssl_days_remaining,
                'tlsVersion' => $target->tls_version,
                'monitoredPorts' => $target->monitored_ports,
                'threatScore' => $target->threat_score,
                'lastChecked' => $target->last_checked,
                'region' => $target->region,
                'history' => $target->history ?? [],
                'recentFindings' => $target->recent_findings ?? [],
            ]);

        $events = SecurityEvent::query()
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (SecurityEvent $event): array => [
                'id' => (string) $event->id,
                'timestamp' => $event->timestamp,
                'target' => $event->target,
                'severity' => $event->severity,
                'category' => $event->category,
                'summary' => $event->summary,
                'mitigation' => $event->mitigation,
            ]);

        return Inertia::render('welcome', [
            'initialTargets' => $targets,
            'initialEvents' => $events,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'string', 'max:255'],
            'label' => ['nullable', 'string', 'max:120'],
            'ports' => ['nullable', 'string', 'max:64'],
            'region' => ['nullable', 'string', 'max:64'],
        ]);

        $raw = strtolower(trim($validated['target']));
        $normalizedHost = preg_replace(['#^https?://#i', '#/.*$#'], '', $raw) ?? '';
        $normalizedHost = rtrim($normalizedHost, '/');

        $isIp = filter_var($normalizedHost, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
        $isDomain = ! $isIp && (bool) preg_match('/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/', $normalizedHost);

        if (! $isIp && ! $isDomain) {
            return back()->withErrors([
                'target' => 'Masukkan nama domain yang valid (contoh: portal.unpatti.ac.id) atau alamat IPv4 yang valid (contoh: 103.184.22.50).',
            ]);
        }

        if (MonitoredTarget::where('host', $normalizedHost)->exists()) {
            return back()->withErrors([
                'target' => "Target {$normalizedHost} sudah terdaftar dalam pantauan aktif.",
            ]);
        }

        $kind = $isIp ? 'ip' : 'domain';
        $initialLatency = $kind === 'domain' ? 48 : 36;

        $target = MonitoredTarget::create([
            'slug' => Str::slug($normalizedHost),
            'label' => trim((string) ($validated['label'] ?? '')) !== ''
                ? trim((string) $validated['label'])
                : ($kind === 'domain' ? "Web {$normalizedHost}" : "Host {$normalizedHost}"),
            'host' => $normalizedHost,
            'url' => $kind === 'domain' ? "https://{$normalizedHost}" : null,
            'kind' => $kind,
            'status' => 'healthy',
            'uptime' => 100.00,
            'latency_ms' => $initialLatency,
            'p95_ms' => $initialLatency + 34,
            'http_status' => $kind === 'domain' ? '200 OK' : 'ICMP / TCP Aktif',
            'ssl_days_remaining' => $kind === 'domain' ? 82 : null,
            'tls_version' => $kind === 'domain' ? 'TLS 1.3' : 'Pemindaian IP Langsung',
            'monitored_ports' => trim((string) ($validated['ports'] ?? '')) !== ''
                ? trim((string) $validated['ports'])
                : ($kind === 'domain' ? '80, 443' : '443'),
            'threat_score' => 8,
            'last_checked' => 'Baru didaftarkan',
            'region' => trim((string) ($validated['region'] ?? '')) !== ''
                ? trim((string) $validated['region'])
                : 'CGK-DC1',
            'history' => [52, 49, 51, 47, 50, 46, $initialLatency],
            'recent_findings' => [
                "Pemindaian awal terdaftar untuk {$normalizedHost}",
                'Profil dasar keamanan & latensi berhasil diinisialisasi',
            ],
        ]);

        SecurityEvent::create([
            'timestamp' => now()->format('H:i:s'),
            'target' => $target->host,
            'severity' => 'low',
            'category' => 'Target Terdaftar',
            'summary' => sprintf(
                'Target %s baru (%s) mulai dipantau secara langsung',
                $kind === 'domain' ? 'DOMAIN' : 'IP',
                $target->host,
            ),
            'mitigation' => 'Verifikasi aturan firewall & ambang peringatan sesuai tingkat kekritisan aset.',
        ]);

        return back();
    }
}
