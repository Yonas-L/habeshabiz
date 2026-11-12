<?php

namespace Tests;

use App\Models\PlatformSetting;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (class_exists(PlatformSetting::class)) {
            PlatformSetting::set('registration_open', 'true');
        }

        if (class_exists(TenantScope::class)) {
            TenantScope::setForcedTenantId(null);
        }
    }

    protected function tearDown(): void
    {
        if (class_exists(TenantScope::class)) {
            TenantScope::setForcedTenantId(null);
        }

        parent::tearDown();
    }
}
