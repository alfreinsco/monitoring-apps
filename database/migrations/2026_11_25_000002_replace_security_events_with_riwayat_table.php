<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('security_events');

        Schema::create('riwayat', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('monitored_target_id')
                ->nullable()
                ->constrained('monitored_targets')
                ->nullOnDelete();
            $table->string('host');
            $table->string('status', 20);
            $table->decimal('uptime', 5, 2);
            $table->unsignedInteger('latency_ms');
            $table->unsignedInteger('p95_ms');
            $table->string('http_status', 64);
            $table->unsignedSmallInteger('ssl_days_remaining')->nullable();
            $table->string('tls_version', 64);
            $table->unsignedTinyInteger('threat_score');
            $table->json('findings')->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->index('checked_at');
            $table->index(['host', 'checked_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('riwayat');

        Schema::create('security_events', function (Blueprint $table): void {
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
};
