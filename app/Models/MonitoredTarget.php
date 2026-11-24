<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MonitoredTarget extends Model
{
    protected $fillable = [
        'slug',
        'label',
        'host',
        'url',
        'kind',
        'status',
        'uptime',
        'latency_ms',
        'p95_ms',
        'http_status',
        'ssl_days_remaining',
        'tls_version',
        'monitored_ports',
        'threat_score',
        'last_checked',
        'region',
        'history',
        'recent_findings',
    ];

    protected function casts(): array
    {
        return [
            'uptime' => 'float',
            'latency_ms' => 'integer',
            'p95_ms' => 'integer',
            'ssl_days_remaining' => 'integer',
            'threat_score' => 'integer',
            'history' => 'array',
            'recent_findings' => 'array',
        ];
    }

    public function histories(): HasMany
    {
        return $this->hasMany(MonitoringHistory::class);
    }
}
