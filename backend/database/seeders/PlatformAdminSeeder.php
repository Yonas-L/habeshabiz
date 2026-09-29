<?php

namespace Database\Seeders;

use App\Models\PlatformAdmin;
use Illuminate\Database\Seeder;

class PlatformAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $email = strtolower(trim((string) (env('PLATFORM_ADMIN_EMAIL') ?: 'yonas@mail.com')));
        $name = (string) (env('PLATFORM_ADMIN_NAME') ?: 'Yonas');
        $password = (string) (env('PLATFORM_ADMIN_PASSWORD') ?: '434344#Yonas');

        PlatformAdmin::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
            ]
        );
    }
}
