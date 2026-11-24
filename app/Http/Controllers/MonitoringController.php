<?php

namespace App\Http\Controllers;

use App\Models\MonitoredTarget;
use App\Models\MonitoringHistory;
use App\Models\Pengaturan;
use App\Services\TargetMonitorService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MonitoringController extends Controller
{
    public function index(): Response
    {
        $targets = MonitoredTarget::query()
            ->where('is_active', true)
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
                'history' => $target->history ?? [],
                'recentFindings' => $target->recent_findings ?? [],
            ]);

        return Inertia::render('welcome', [
            'initialTargets' => $targets,
            'monitoringIntervalSeconds' => (int) (Pengaturan::query()->find('monitoring_browser')?->value['interval_seconds'] ?? 10),
        ]);
    }

    public function targets(Request $request): Response
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));

        $targets = MonitoredTarget::query()
            ->when($search !== '', fn ($query) => $query->where(function ($query) use ($search): void {
                $query->where('host', 'like', "%{$search}%")
                    ->orWhere('label', 'like', "%{$search}%");
            }))
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (MonitoredTarget $target): array => [
                'id' => $target->id,
                'label' => $target->label,
                'host' => $target->host,
                'kind' => $target->kind,
                'isActive' => $target->is_active,
                'monitoredPorts' => $target->monitored_ports,
            ]);

        return Inertia::render('targets/index', [
            'targets' => $targets,
            'search' => $search,
        ]);
    }

    public function updateActive(Request $request, MonitoredTarget $target): RedirectResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $target->update(['is_active' => (bool) $validated['is_active']]);

        return to_route('targets.index');
    }

    public function riwayat(Request $request): Response
    {
        $validated = $request->validate([
            'domain' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'date_format:Y-m-d\\TH:i'],
            'to' => ['nullable', 'date_format:Y-m-d\\TH:i'],
        ]);

        if (($validated['from'] ?? '') !== '' && ($validated['to'] ?? '') !== '' && $validated['to'] < $validated['from']) {
            throw ValidationException::withMessages([
                'to' => 'Waktu akhir harus sama dengan atau setelah waktu awal.',
            ]);
        }

        $domains = MonitoredTarget::query()
            ->where('kind', 'domain')
            ->orderBy('host')
            ->get(['host', 'label'])
            ->map(fn (MonitoredTarget $target): array => [
                'host' => $target->host,
                'label' => $target->label,
            ]);

        $selectedDomain = $validated['domain'] ?? '';
        if ($selectedDomain !== '' && ! $domains->contains('host', $selectedDomain)) {
            abort(404);
        }

        $historyQuery = MonitoringHistory::query()
            ->with('monitoredTarget:id,label,kind')
            ->orderByDesc('checked_at')
            ->orderByDesc('id');

        if ($selectedDomain !== '') {
            $historyQuery->where('host', $selectedDomain);
        }

        if (($validated['from'] ?? '') !== '') {
            $historyQuery->where('checked_at', '>=', Carbon::createFromFormat('Y-m-d\\TH:i', $validated['from']));
        }

        if (($validated['to'] ?? '') !== '') {
            $historyQuery->where('checked_at', '<', Carbon::createFromFormat('Y-m-d\\TH:i', $validated['to'])->addMinute());
        }

        $records = $historyQuery
            ->paginate(10)
            ->withQueryString()
            ->through(fn (MonitoringHistory $record): array => [
                'id' => (string) $record->id,
                'host' => $record->host,
                'label' => $record->monitoredTarget?->label ?? $record->host,
                'kind' => $record->monitoredTarget?->kind
                    ?? (filter_var($record->host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) ? 'ip' : 'domain'),
                'checkedAt' => $record->checked_at->format('d M Y, H:i:s'),
                'status' => $record->status,
                'uptime' => $record->uptime,
                'latencyMs' => $record->latency_ms,
                'p95Ms' => $record->p95_ms,
                'httpStatus' => $record->http_status,
                'sslDaysRemaining' => $record->ssl_days_remaining,
                'tlsVersion' => $record->tls_version,
                'threatScore' => $record->threat_score,
                'findings' => $record->findings ?? [],
            ]);

        return Inertia::render('riwayat', [
            'records' => $records,
            'domains' => $domains,
            'monitoringIntervalSeconds' => (int) (Pengaturan::query()->find('monitoring_browser')?->value['interval_seconds'] ?? 10),
            'filters' => [
                'domain' => $selectedDomain,
                'from' => $validated['from'] ?? '',
                'to' => $validated['to'] ?? '',
            ],
        ]);
    }

    public function store(Request $request, TargetMonitorService $monitor): RedirectResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'string', 'max:255'],
            'label' => ['nullable', 'string', 'max:120'],
            'ports' => ['nullable', 'string', 'max:64'],
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
        $ports = trim((string) ($validated['ports'] ?? '')) !== ''
            ? trim((string) $validated['ports'])
            : ($kind === 'domain' ? '80, 443' : '443');
        if (! preg_match('/^\s*\d+(?:\s*,\s*\d+)*\s*$/', $ports)) {
            return back()->withErrors([
                'ports' => 'Format port harus berupa angka yang dipisahkan koma.',
            ]);
        }

        $portNumbers = array_values(array_unique(array_filter(array_map(
            static fn (string $port): int => (int) trim($port),
            explode(',', $ports),
        ))));

        if ($portNumbers === [] || count($portNumbers) > 5 || collect($portNumbers)->contains(fn (int $port): bool => $port < 1 || $port > 65535)) {
            return back()->withErrors([
                'ports' => 'Masukkan 1–5 port TCP yang valid (1–65535).',
            ]);
        }

        $target = MonitoredTarget::create([
            'slug' => Str::slug($normalizedHost),
            'label' => trim((string) ($validated['label'] ?? '')) !== ''
                ? trim((string) $validated['label'])
                : ($kind === 'domain' ? "Web {$normalizedHost}" : "Host {$normalizedHost}"),
            'host' => $normalizedHost,
            'url' => $kind === 'domain' ? "https://{$normalizedHost}" : null,
            'kind' => $kind,
            'is_active' => true,
            'status' => 'degraded',
            'uptime' => 100.00,
            'latency_ms' => 0,
            'p95_ms' => 0,
            'http_status' => 'Menunggu pemeriksaan pertama',
            'ssl_days_remaining' => null,
            'tls_version' => 'Belum diperiksa',
            'monitored_ports' => implode(', ', $portNumbers),
            'threat_score' => 8,
            'last_checked' => 'Baru didaftarkan',
            'history' => [],
            'recent_findings' => [
                "Pemindaian awal terdaftar untuk {$normalizedHost}",
                'Pemeriksaan konektivitas pertama sedang berjalan',
            ],
        ]);

        $monitor->checkTarget($target);

        return to_route('targets.index');
    }

    public function update(Request $request, MonitoredTarget $target, TargetMonitorService $monitor): RedirectResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'string', 'max:255'],
            'label' => ['nullable', 'string', 'max:120'],
            'ports' => ['nullable', 'string', 'max:64'],
        ]);

        $raw = strtolower(trim($validated['target']));
        $normalizedHost = preg_replace(['#^https?://#i', '#/.*$#'], '', $raw) ?? '';
        $normalizedHost = rtrim($normalizedHost, '/');
        $isIp = filter_var($normalizedHost, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
        $isDomain = ! $isIp && (bool) preg_match('/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/', $normalizedHost);

        if (! $isIp && ! $isDomain) {
            throw ValidationException::withMessages([
                'target' => 'Masukkan domain yang valid atau alamat IPv4 yang valid.',
            ]);
        }

        if (MonitoredTarget::query()->where('host', $normalizedHost)->where('id', '<>', $target->id)->exists()) {
            throw ValidationException::withMessages([
                'target' => "Target {$normalizedHost} sudah terdaftar.",
            ]);
        }

        $kind = $isIp ? 'ip' : 'domain';
        $ports = trim((string) ($validated['ports'] ?? '')) !== ''
            ? trim((string) $validated['ports'])
            : ($kind === 'domain' ? '80, 443' : '443');
        $portNumbers = array_values(array_unique(array_map(
            static fn (string $port): int => (int) trim($port),
            explode(',', $ports),
        )));

        if (! preg_match('/^\s*\d+(?:\s*,\s*\d+)*\s*$/', $ports)
            || $portNumbers === []
            || count($portNumbers) > 5
            || collect($portNumbers)->contains(fn (int $port): bool => $port < 1 || $port > 65535)) {
            throw ValidationException::withMessages([
                'ports' => 'Masukkan 1–5 port TCP yang valid (1–65535), dipisahkan koma.',
            ]);
        }

        $target->update([
            'slug' => Str::slug("{$normalizedHost}-{$target->id}"),
            'label' => trim((string) ($validated['label'] ?? '')) !== ''
                ? trim((string) $validated['label'])
                : ($kind === 'domain' ? "Web {$normalizedHost}" : "Host {$normalizedHost}"),
            'host' => $normalizedHost,
            'url' => $kind === 'domain' ? "https://{$normalizedHost}" : null,
            'kind' => $kind,
            'monitored_ports' => implode(', ', $portNumbers),
        ]);

        if ($target->wasChanged(['host', 'kind', 'monitored_ports'])) {
            $monitor->checkTarget($target);
        }

        return to_route('targets.index');
    }

    public function destroy(MonitoredTarget $target): RedirectResponse
    {
        $target->delete();

        return to_route('targets.index');
    }
}
