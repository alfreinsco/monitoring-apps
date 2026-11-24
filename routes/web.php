<?php

use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\PengaturanController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MonitoringController::class, 'index'])->name('home');
Route::get('/riwayat', [MonitoringController::class, 'riwayat'])->name('riwayat.index');
Route::get('/pengaturan', [PengaturanController::class, 'index'])->name('pengaturan.index');
Route::put('/pengaturan/telegram', [PengaturanController::class, 'updateTelegram'])->name('pengaturan.telegram.update');
Route::put('/pengaturan/google-chat', [PengaturanController::class, 'updateGoogleChat'])->name('pengaturan.google-chat.update');
Route::post('/targets', [MonitoringController::class, 'store'])->name('targets.store');
