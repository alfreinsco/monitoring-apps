<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitored_targets', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('label');
            $table->string('host')->unique();
            $table->string('url')->nullable();
            $table->string('kind', 20)->default('domain');
            $table->string('status', 20)->default('healthy');
            $table->decimal('uptime', 5, 2)->default(100.00);
            $table->unsignedInteger('latency_ms')->default(45);
            $table->unsignedInteger('p95_ms')->default(85);
            $table->string('http_status', 64)->default('200 OK');
            $table->unsignedSmallInteger('ssl_days_remaining')->nullable();
            $table->string('tls_version', 64)->default('TLS 1.3');
            $table->string('monitored_ports', 64)->default('80, 443');
            $table->unsignedTinyInteger('threat_score')->default(5);
            $table->string('last_checked', 64)->default('Baru saja');
            $table->string('region', 64)->default('CGK-DC1');
            $table->json('history')->nullable();
            $table->json('recent_findings')->nullable();
            $table->timestamps();
        });

        Schema::create('security_events', function (Blueprint $table) {
            $table->id();
            $table->string('timestamp', 32);
            $table->string('target');
            $table->string('severity', 20)->default('low');
            $table->string('category', 100);
            $table->text('summary');
            $table->text('mitigation');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('security_events');
        Schema::dropIfExists('monitored_targets');
    }
};
