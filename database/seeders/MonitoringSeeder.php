<?php

namespace Database\Seeders;

use App\Models\MonitoredTarget;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class MonitoringSeeder extends Seeder
{
    public function run(): void
    {
        $targets = [
            [
                'label' => 'PMB Mandiri Sarjana UNPATTI',
                'host' => 'mandiri.pmb.unpatti.ac.id',
                'url' => 'https://mandiri.pmb.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.97,
                'latency_ms' => 46,
                'p95_ms' => 92,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 74,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 7,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [48, 45, 47, 44, 46, 45, 46],
                'recent_findings' => [
                    'Sertifikat SSL/TLS valid dan HSTS aktif',
                    'Endpoint pendaftaran mandiri merespons normal tanpa galat 5xx',
                ],
            ],
            [
                'label' => 'PMB Mandiri Pascasarjana UNPATTI',
                'host' => 'mandiri-pasca.pmb.unpatti.ac.id',
                'url' => 'https://mandiri-pasca.pmb.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.95,
                'latency_ms' => 52,
                'p95_ms' => 104,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 74,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 9,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [54, 51, 55, 50, 53, 51, 52],
                'recent_findings' => [
                    'Portal pendaftaran pascasarjana siap menerima sesi login',
                    'Rate-limit perlindungan brute-force aktif pada rute autentikasi',
                ],
            ],
            [
                'label' => 'Repository Digital UNPATTI',
                'host' => 'repository.unpatti.ac.id',
                'url' => 'https://repository.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.94,
                'latency_ms' => 58,
                'p95_ms' => 116,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 68,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 10,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [61, 59, 57, 60, 56, 59, 58],
                'recent_findings' => [
                    'Indeks dokumen & unduhan berkas PDF berjalan stabil',
                    'Header keamanan CSP & X-Frame-Options terkonfigurasi',
                ],
            ],
            [
                'label' => 'Sistem Kerja Sama (SIKERMA) UNPATTI',
                'host' => 'sikerma.unpatti.ac.id',
                'url' => 'https://sikerma.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.96,
                'latency_ms' => 49,
                'p95_ms' => 96,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 81,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 6,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [50, 48, 51, 47, 49, 50, 49],
                'recent_findings' => [
                    'Ketersediaan portal dokumen kerja sama 99.96%',
                    'Nihil anomali permintaan pada endpoint publik',
                ],
            ],
            [
                'label' => 'Unit Bisnis (UBIS) UNPATTI',
                'host' => 'ubis.unpatti.ac.id',
                'url' => 'https://ubis.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.92,
                'latency_ms' => 64,
                'p95_ms' => 124,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 62,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 12,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [66, 63, 68, 62, 65, 63, 64],
                'recent_findings' => [
                    'Koneksi HTTPS terenkripsi dengan TLS 1.3',
                    'Waktu respons halaman utama berada dalam batas normal',
                ],
            ],
            [
                'label' => 'Seleksi PPDS FK UNPATTI',
                'host' => 'seleksi-ppds.fk.unpatti.ac.id',
                'url' => 'https://seleksi-ppds.fk.unpatti.ac.id',
                'kind' => 'domain',
                'status' => 'healthy',
                'uptime' => 99.98,
                'latency_ms' => 44,
                'p95_ms' => 89,
                'http_status' => '200 OK',
                'ssl_days_remaining' => 79,
                'tls_version' => 'TLS 1.3',
                'monitored_ports' => '80, 443',
                'threat_score' => 8,
                'last_checked' => 'Baru saja',
                'region' => 'CGK-DC1',
                'history' => [46, 44, 45, 43, 45, 43, 44],
                'recent_findings' => [
                    'Portal seleksi PPDS Fakultas Kedokteran aktif penuh',
                    'Validasi sertifikat SSL & proteksi WAF edge normal',
                ],
            ],
        ];

        foreach ($targets as $item) {
            MonitoredTarget::updateOrCreate(
                ['host' => $item['host']],
                [
                    ...$item,
                    'slug' => Str::slug($item['host']),
                    'status' => 'degraded',
                    'uptime' => 0,
                    'latency_ms' => 0,
                    'p95_ms' => 0,
                    'http_status' => 'Menunggu pemeriksaan pertama',
                    'ssl_days_remaining' => null,
                    'tls_version' => 'Belum diperiksa',
                    'threat_score' => 0,
                    'last_checked' => 'Belum diperiksa',
                    'history' => [],
                    'recent_findings' => ['Target menunggu hasil pemeriksaan nyata pertama'],
                ],
            );
        }
    }
}
