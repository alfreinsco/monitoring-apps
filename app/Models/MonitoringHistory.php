<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonitoringHistory extends Model
{
    protected $table = 'riwayat';

    protected $fillable = [
        'monitored_target_id',
        'host',
        'status',
        'uptime',
        'latency_ms',
        'p95_ms',
        'http_status',
        'ssl_days_remaining',
        'tls_version',
        'threat_score',
        'findings',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'uptime' => 'float',
            'latency_ms' => 'integer',
            'p95_ms' => 'integer',
            'ssl_days_remaining' => 'integer',
            'threat_score' => 'integer',
            'findings' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    public function monitoredTarget(): BelongsTo
    {
        return $this->belongsTo(MonitoredTarget::class);
    }
}
