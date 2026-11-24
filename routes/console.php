<?php

use App\Services\TargetMonitorService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('monitoring:check', function (TargetMonitorService $monitor): void {
    $count = $monitor->checkAll();

    $this->info("Pemeriksaan nyata selesai untuk {$count} target.");
})->purpose('Jalankan pemeriksaan nyata untuk seluruh target pantauan');

Schedule::command('monitoring:check')->everyMinute()->withoutOverlapping();
