<?php

use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\PengaturanController;
use Illuminate\Support\Facades\Route;

Route::get('/', [MonitoringController::class, 'index'])->name('home');
Route::get('/targets', [MonitoringController::class, 'targets'])->name('targets.index');
Route::get('/riwayat', [MonitoringController::class, 'riwayat'])->name('riwayat.index');
Route::get('/pengaturan', [PengaturanController::class, 'index'])->name('pengaturan.index');
Route::put('/pengaturan/telegram', [PengaturanController::class, 'updateTelegram'])->name('pengaturan.telegram.update');
Route::put('/pengaturan/google-chat', [PengaturanController::class, 'updateGoogleChat'])->name('pengaturan.google-chat.update');
Route::put('/pengaturan/riwayat', [PengaturanController::class, 'updateHistory'])->name('pengaturan.riwayat.update');
Route::post('/pengaturan/telegram/test', [PengaturanController::class, 'testTelegram'])->name('pengaturan.telegram.test');
Route::post('/pengaturan/google-chat/test', [PengaturanController::class, 'testGoogleChat'])->name('pengaturan.google-chat.test');
Route::post('/targets', [MonitoringController::class, 'store'])->name('targets.store');
Route::put('/targets/{target}', [MonitoringController::class, 'update'])->name('targets.update');
Route::delete('/targets/{target}', [MonitoringController::class, 'destroy'])->name('targets.destroy');
