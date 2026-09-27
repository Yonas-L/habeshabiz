<?php

namespace App\Services;

use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TenantOnboardingService
{
    /**
     * Onboard a new tenant with initial owner account and starting data seed.
     *
     * @param  array<string, mixed>  $data
     * @return array{token: string, user: User, tenant: Tenant}
     */
    public function onboard(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $baseSlug = Str::slug($data['business_name']);
            $slug = $baseSlug.'-'.strtolower(Str::random(5));

            $city = $data['city'] ?? 'Addis Ababa';
            $teamSize = $data['team_size'] ?? '1';

            // 1. Create Tenant
            $tenant = Tenant::create([
                'name' => $data['business_name'],
                'slug' => $slug,
                'phone' => $data['owner_phone'],
                'currency_code' => 'ETB',
                'business_type' => $data['business_type'],
                'settings' => [
                    'city' => $city,
                    'address' => $city,
                    'team_size' => $teamSize,
                    'tin_number' => $data['tin_number'] ?? null,
                    'logo_url' => null,
                    'footer_note' => 'Thank you for your business. Defect coverage valid for 7 days with intact warranty and receipt.',
                    'secondary_currencies' => ['USD'],
                    'vat_registered' => false,
                ],
                'is_active' => true,
            ]);

            // Set forced tenant ID so any tenant-scoped operations hook cleanly
            TenantScope::setForcedTenantId($tenant->id);

            // 2. Create Owner User
            $user = User::create([
                'tenant_id' => $tenant->id,
                'name' => $data['owner_name'],
                'email' => $data['owner_email'],
                'phone' => $data['owner_phone'],
                'password' => Hash::make($data['password']),
                'role' => 'owner',
                'permissions' => [
                    'can_view_costs' => true,
                    'can_discount' => true,
                ],
                'is_active' => true,
            ]);

            // 3. Seed Default Financial Accounts (Zero balance starter accounts)
            $this->seedStarterAccounts($tenant);

            // 4. Seed Products & Categories based on business type
            $this->seedCatalog($tenant, $data['business_type']);

            // Reset tenant scope
            TenantScope::setForcedTenantId(null);

            // 5. Generate Sanctum Token
            $token = $user->createToken('habeshabiz_api_token')->plainTextToken;

            return [
                'token' => $token,
                'user' => $user,
                'tenant' => $tenant,
            ];
        });
    }

    /**
     * Seed baseline operational accounts.
     */
    protected function seedStarterAccounts(Tenant $tenant): void
    {
        $accounts = [
            [
                'name' => 'Cash in Safe',
                'type' => 'cash',
                'current_balance' => 0.00,
            ],
            [
                'name' => 'Commercial Bank of Ethiopia (CBE)',
                'type' => 'bank',
                'current_balance' => 0.00,
            ],
            [
                'name' => 'Telebirr Merchant',
                'type' => 'mobile_money',
                'current_balance' => 0.00,
            ],
        ];

        foreach ($accounts as $acc) {
            FinancialAccount::create([
                'tenant_id' => $tenant->id,
                'name' => $acc['name'],
                'type' => $acc['type'],
                'currency' => 'ETB',
                'current_balance' => $acc['current_balance'],
                'is_custom_asset' => false,
                'is_active' => true,
            ]);
        }
    }

    /**
     * Seed catalog taxonomy, products and variants.
     */
    protected function seedCatalog(Tenant $tenant, string $businessType): void
    {
        match ($businessType) {
            'electronics' => $this->seedElectronics($tenant),
            'clothing' => $this->seedClothing($tenant),
            'food_beverage' => $this->seedFoodBeverage($tenant),
            default => $this->seedGeneralRetail($tenant),
        };
    }

    /**
     * Seed 2026-accurate electronics catalog for Ethiopian market.
     */
    protected function seedElectronics(Tenant $tenant): void
    {
        $categoriesData = [
            [
                'slug' => 'smartphones',
                'name' => 'Smartphones',
                'icon' => 'smartphone',
                'has_serials' => true,
                'sort_order' => 1,
            ],
            [
                'slug' => 'tablets',
                'name' => 'Tablets',
                'icon' => 'tablet',
                'has_serials' => true,
                'sort_order' => 2,
            ],
            [
                'slug' => 'laptops',
                'name' => 'Laptops & Computers',
                'icon' => 'laptop',
                'has_serials' => true,
                'sort_order' => 3,
            ],
            [
                'slug' => 'accessories',
                'name' => 'Accessories (Chargers, Cables, Cases)',
                'icon' => 'headphones',
                'has_serials' => false,
                'sort_order' => 4,
            ],
            [
                'slug' => 'audio',
                'name' => 'Audio (Earbuds, Headphones, Speakers)',
                'icon' => 'volume-2',
                'has_serials' => false,
                'sort_order' => 5,
            ],
            [
                'slug' => 'wearables',
                'name' => 'Smart Watches & Wearables',
                'icon' => 'watch',
                'has_serials' => true,
                'sort_order' => 6,
            ],
            [
                'slug' => 'powerbanks',
                'name' => 'Power Banks & Batteries',
                'icon' => 'battery-charging',
                'has_serials' => false,
                'sort_order' => 7,
            ],
        ];

        $categories = [];
        foreach ($categoriesData as $cat) {
            $categories[$cat['slug']] = Category::create([
                'tenant_id' => $tenant->id,
                'slug' => $cat['slug'],
                'name' => $cat['name'],
                'icon' => $cat['icon'],
                'has_serials' => $cat['has_serials'],
                'sort_order' => $cat['sort_order'],
                'is_active' => true,
            ]);
        }

        // --- Smartphones ---
        $smartphones = [
            [
                'name' => 'Samsung Galaxy S25',
                'brand' => 'Samsung',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Phantom Black'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Icy Blue'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Phantom Black'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Icy Blue'],
                ],
            ],
            [
                'name' => 'Samsung Galaxy A56',
                'brand' => 'Samsung',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Blue'],
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'White'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Blue'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'White'],
                ],
            ],
            [
                'name' => 'Samsung Galaxy A36',
                'brand' => 'Samsung',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Blue'],
                ],
            ],
            [
                'name' => 'iPhone 16',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '128GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'color' => 'White'],
                    ['storage' => '128GB', 'color' => 'Pink'],
                    ['storage' => '128GB', 'color' => 'Teal'],
                    ['storage' => '256GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'color' => 'White'],
                    ['storage' => '256GB', 'color' => 'Pink'],
                    ['storage' => '256GB', 'color' => 'Teal'],
                    ['storage' => '512GB', 'color' => 'Black'],
                    ['storage' => '512GB', 'color' => 'White'],
                    ['storage' => '512GB', 'color' => 'Pink'],
                    ['storage' => '512GB', 'color' => 'Teal'],
                ],
            ],
            [
                'name' => 'iPhone 16 Pro',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '256GB', 'color' => 'Black Titanium'],
                    ['storage' => '256GB', 'color' => 'White Titanium'],
                    ['storage' => '256GB', 'color' => 'Desert Titanium'],
                    ['storage' => '512GB', 'color' => 'Black Titanium'],
                    ['storage' => '512GB', 'color' => 'White Titanium'],
                    ['storage' => '512GB', 'color' => 'Desert Titanium'],
                    ['storage' => '1TB', 'color' => 'Black Titanium'],
                    ['storage' => '1TB', 'color' => 'White Titanium'],
                    ['storage' => '1TB', 'color' => 'Desert Titanium'],
                ],
            ],
            [
                'name' => 'iPhone 15',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '128GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'color' => 'Blue'],
                    ['storage' => '128GB', 'color' => 'Green'],
                    ['storage' => '128GB', 'color' => 'Yellow'],
                    ['storage' => '128GB', 'color' => 'Pink'],
                    ['storage' => '256GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'color' => 'Blue'],
                    ['storage' => '256GB', 'color' => 'Green'],
                    ['storage' => '256GB', 'color' => 'Yellow'],
                    ['storage' => '256GB', 'color' => 'Pink'],
                ],
            ],
            [
                'name' => 'iPhone 15 Pro Max',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '256GB', 'color' => 'Black Titanium'],
                    ['storage' => '256GB', 'color' => 'Blue Titanium'],
                    ['storage' => '512GB', 'color' => 'Black Titanium'],
                    ['storage' => '512GB', 'color' => 'Blue Titanium'],
                ],
            ],
            [
                'name' => 'Tecno Spark 30 Pro',
                'brand' => 'Tecno',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Silver'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Gold'],
                ],
            ],
            [
                'name' => 'Tecno Camon 40',
                'brand' => 'Tecno',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Green'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Green'],
                ],
            ],
            [
                'name' => 'Infinix Hot 50 Pro',
                'brand' => 'Infinix',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Purple'],
                ],
            ],
            [
                'name' => 'Infinix Note 40 Pro',
                'brand' => 'Infinix',
                'variants' => [
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Gold'],
                ],
            ],
            [
                'name' => 'Xiaomi Redmi Note 14 Pro',
                'brand' => 'Xiaomi',
                'variants' => [
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Blue'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'White'],
                ],
            ],
            [
                'name' => 'Xiaomi 15',
                'brand' => 'Xiaomi',
                'variants' => [
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'White'],
                    ['storage' => '512GB', 'ram' => '16GB', 'color' => 'Black'],
                    ['storage' => '512GB', 'ram' => '16GB', 'color' => 'White'],
                ],
            ],
            [
                'name' => 'OPPO A3 Pro',
                'brand' => 'OPPO',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Blue'],
                ],
            ],
            [
                'name' => 'Huawei Nova 13',
                'brand' => 'Huawei',
                'variants' => [
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Pink'],
                ],
            ],
            [
                'name' => 'Vivo V40',
                'brand' => 'Vivo',
                'variants' => [
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '12GB', 'color' => 'Blue'],
                ],
            ],
            [
                'name' => 'Nokia G42 5G',
                'brand' => 'Nokia',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Grey'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['smartphones'], $smartphones, true);

        // --- Tablets ---
        $tablets = [
            [
                'name' => 'iPad (10th gen)',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '64GB WiFi', 'color' => 'Blue'],
                    ['storage' => '64GB WiFi', 'color' => 'Pink'],
                    ['storage' => '64GB WiFi', 'color' => 'Silver'],
                    ['storage' => '64GB WiFi', 'color' => 'Yellow'],
                    ['storage' => '256GB WiFi', 'color' => 'Blue'],
                    ['storage' => '256GB WiFi', 'color' => 'Pink'],
                    ['storage' => '256GB WiFi', 'color' => 'Silver'],
                    ['storage' => '256GB WiFi', 'color' => 'Yellow'],
                    ['storage' => '64GB WiFi+Cellular', 'color' => 'Blue'],
                    ['storage' => '64GB WiFi+Cellular', 'color' => 'Pink'],
                    ['storage' => '64GB WiFi+Cellular', 'color' => 'Silver'],
                    ['storage' => '64GB WiFi+Cellular', 'color' => 'Yellow'],
                ],
            ],
            [
                'name' => 'iPad Pro M4 11-inch',
                'brand' => 'Apple',
                'variants' => [
                    ['storage' => '256GB', 'color' => 'Space Black'],
                    ['storage' => '256GB', 'color' => 'Silver'],
                    ['storage' => '512GB', 'color' => 'Space Black'],
                    ['storage' => '512GB', 'color' => 'Silver'],
                ],
            ],
            [
                'name' => 'Samsung Galaxy Tab S10 FE',
                'brand' => 'Samsung',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Black'],
                    ['storage' => '128GB', 'ram' => '6GB', 'color' => 'Blue'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Black'],
                    ['storage' => '256GB', 'ram' => '8GB', 'color' => 'Blue'],
                ],
            ],
            [
                'name' => 'Samsung Galaxy Tab A9+',
                'brand' => 'Samsung',
                'variants' => [
                    ['storage' => '64GB', 'ram' => '4GB', 'color' => 'Black'],
                    ['storage' => '64GB', 'ram' => '4GB', 'color' => 'Silver'],
                ],
            ],
            [
                'name' => 'Lenovo Tab P12',
                'brand' => 'Lenovo',
                'variants' => [
                    ['storage' => '128GB', 'ram' => '8GB', 'color' => 'Grey'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['tablets'], $tablets, true);

        // --- Laptops & Computers ---
        $laptops = [
            [
                'name' => 'MacBook Air M3 13-inch',
                'brand' => 'Apple',
                'variants' => [
                    ['ram' => '8GB', 'storage' => '256GB', 'color' => 'Midnight'],
                    ['ram' => '8GB', 'storage' => '256GB', 'color' => 'Starlight'],
                    ['ram' => '8GB', 'storage' => '256GB', 'color' => 'Silver'],
                    ['ram' => '8GB', 'storage' => '256GB', 'color' => 'Sky Blue'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Midnight'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Starlight'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Silver'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Sky Blue'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Midnight'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Starlight'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Silver'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Sky Blue'],
                ],
            ],
            [
                'name' => 'MacBook Pro M4 14-inch',
                'brand' => 'Apple',
                'variants' => [
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Space Black'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Silver'],
                    ['ram' => '24GB', 'storage' => '1TB', 'color' => 'Space Black'],
                    ['ram' => '24GB', 'storage' => '1TB', 'color' => 'Silver'],
                ],
            ],
            [
                'name' => 'HP Pavilion 15',
                'brand' => 'HP',
                'variants' => [
                    ['ram' => '8GB', 'storage' => '512GB SSD', 'color' => 'Silver'],
                    ['ram' => '16GB', 'storage' => '512GB SSD', 'color' => 'Silver'],
                ],
            ],
            [
                'name' => 'Dell Inspiron 15',
                'brand' => 'Dell',
                'variants' => [
                    ['ram' => '8GB', 'storage' => '512GB SSD', 'color' => 'Black'],
                    ['ram' => '8GB', 'storage' => '512GB SSD', 'color' => 'Silver'],
                    ['ram' => '16GB', 'storage' => '1TB SSD', 'color' => 'Black'],
                    ['ram' => '16GB', 'storage' => '1TB SSD', 'color' => 'Silver'],
                ],
            ],
            [
                'name' => 'Lenovo IdeaPad Slim 5',
                'brand' => 'Lenovo',
                'variants' => [
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Grey'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Blue'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Grey'],
                    ['ram' => '16GB', 'storage' => '512GB', 'color' => 'Blue'],
                ],
            ],
            [
                'name' => 'Asus VivoBook 15',
                'brand' => 'Asus',
                'variants' => [
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Black'],
                    ['ram' => '8GB', 'storage' => '512GB', 'color' => 'Silver'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['laptops'], $laptops, true);

        // --- Accessories (Quantity-based, has_serials = false) ---
        $accessories = [
            ['name' => 'Apple 20W USB-C Charger', 'brand' => 'Apple', 'variants' => [['specs' => ['20W USB-C']]]],
            ['name' => 'Apple MagSafe Charger', 'brand' => 'Apple', 'variants' => [['specs' => ['Wireless MagSafe']]]],
            ['name' => 'Samsung 25W Adapter', 'brand' => 'Samsung', 'variants' => [['specs' => ['25W Fast Charge']]]],
            ['name' => 'USB-C to USB-C Cable 1m', 'brand' => 'Generic', 'variants' => [['specs' => ['1 Meter', 'Braided']]]],
            ['name' => 'USB-C to Lightning Cable', 'brand' => 'Generic', 'variants' => [['specs' => ['1 Meter']]]],
            [
                'name' => 'iPhone 16 Silicone Case',
                'brand' => 'Apple',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Blue'],
                    ['color' => 'Pink'],
                    ['color' => 'Clear'],
                ],
            ],
            [
                'name' => 'Samsung Galaxy S25 Case',
                'brand' => 'Samsung',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Clear'],
                    ['color' => 'Blue'],
                ],
            ],
            ['name' => 'Tempered Glass Screen Protector Universal', 'brand' => 'Generic', 'variants' => [['specs' => ['9H Hardness', 'Anti-Scratch']]]],
            ['name' => 'AirTag', 'brand' => 'Apple', 'variants' => [['specs' => ['Standard']]]],
            ['name' => 'Samsung SmartTag 2', 'brand' => 'Samsung', 'variants' => [['specs' => ['Bluetooth & UWB']]]],
        ];

        $this->createProductGroup($tenant, $categories['accessories'], $accessories, false);

        // --- Audio (Quantity-based, has_serials = false) ---
        $audio = [
            ['name' => 'AirPods 4', 'brand' => 'Apple', 'variants' => [['specs' => ['Active Noise Cancellation']]]],
            ['name' => 'AirPods Pro 2', 'brand' => 'Apple', 'variants' => [['specs' => ['USB-C Case']]]],
            [
                'name' => 'Samsung Galaxy Buds 3 Pro',
                'brand' => 'Samsung',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'White'],
                ],
            ],
            [
                'name' => 'JBL Tune 770NC',
                'brand' => 'JBL',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Blue'],
                    ['color' => 'White'],
                ],
            ],
            ['name' => 'Sony WH-1000XM6', 'brand' => 'Sony', 'variants' => [['color' => 'Black']]],
            [
                'name' => 'Xiaomi Redmi Buds 6',
                'brand' => 'Xiaomi',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'White'],
                ],
            ],
            [
                'name' => 'Anker Soundcore P40i',
                'brand' => 'Anker',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Blue'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['audio'], $audio, false);

        // --- Smart Watches & Wearables (has_serials = true) ---
        $wearables = [
            [
                'name' => 'Apple Watch Series 10',
                'brand' => 'Apple',
                'variants' => [
                    ['specs' => ['42mm'], 'color' => 'Black Aluminum'],
                    ['specs' => ['42mm'], 'color' => 'Silver Aluminum'],
                    ['specs' => ['42mm'], 'color' => 'Rose Gold'],
                    ['specs' => ['46mm'], 'color' => 'Black Aluminum'],
                    ['specs' => ['46mm'], 'color' => 'Silver Aluminum'],
                    ['specs' => ['46mm'], 'color' => 'Rose Gold'],
                ],
            ],
            ['name' => 'Apple Watch Ultra 2', 'brand' => 'Apple', 'variants' => [['specs' => ['49mm'], 'color' => 'Titanium Natural']]],
            [
                'name' => 'Samsung Galaxy Watch 7',
                'brand' => 'Samsung',
                'variants' => [
                    ['specs' => ['40mm'], 'color' => 'Black'],
                    ['specs' => ['40mm'], 'color' => 'Silver'],
                    ['specs' => ['40mm'], 'color' => 'Green'],
                    ['specs' => ['44mm'], 'color' => 'Black'],
                    ['specs' => ['44mm'], 'color' => 'Silver'],
                    ['specs' => ['44mm'], 'color' => 'Green'],
                ],
            ],
            ['name' => 'Xiaomi Smart Band 9', 'brand' => 'Xiaomi', 'variants' => [['color' => 'Black']]],
            [
                'name' => 'Amazfit GTR 4',
                'brand' => 'Amazfit',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Brown'],
                ],
            ],
            [
                'name' => 'Huawei Band 9',
                'brand' => 'Huawei',
                'variants' => [
                    ['color' => 'Black'],
                    ['color' => 'Pink'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['wearables'], $wearables, true);

        // --- Power Banks & Batteries (Quantity-based, has_serials = false) ---
        $powerbanks = [
            ['name' => 'Anker PowerCore 20000', 'brand' => 'Anker', 'variants' => [['specs' => ['20,000mAh', '20W PD']]]],
            ['name' => 'Baseus 30000mAh Power Bank', 'brand' => 'Baseus', 'variants' => [['specs' => ['30,000mAh', '65W Fast Charge']]]],
            ['name' => 'Xiaomi Power Bank 3 10000mAh', 'brand' => 'Xiaomi', 'variants' => [['specs' => ['10,000mAh', 'Dual USB-A']]]],
            ['name' => 'Ugreen 25000mAh 200W Power Bank', 'brand' => 'Ugreen', 'variants' => [['specs' => ['25,000mAh', '200W High Output']]]],
            ['name' => 'Anker 737 Power Bank 24000mAh', 'brand' => 'Anker', 'variants' => [['specs' => ['24,000mAh', '140W Smart Display']]]],
        ];

        $this->createProductGroup($tenant, $categories['powerbanks'], $powerbanks, false);
    }

    /**
     * Seed clothing categories and sample catalog.
     */
    protected function seedClothing(Tenant $tenant): void
    {
        $categoriesData = [
            ['slug' => 'mens_clothing', 'name' => "Men's Clothing", 'icon' => 'shirt', 'has_serials' => false, 'sort_order' => 1],
            ['slug' => 'womens_clothing', 'name' => "Women's Clothing", 'icon' => 'scissors', 'has_serials' => false, 'sort_order' => 2],
            ['slug' => 'shoes', 'name' => 'Shoes & Footwear', 'icon' => 'footprints', 'has_serials' => false, 'sort_order' => 3],
            ['slug' => 'bags_accessories', 'name' => 'Bags & Accessories', 'icon' => 'briefcase', 'has_serials' => false, 'sort_order' => 4],
        ];

        $categories = [];
        foreach ($categoriesData as $cat) {
            $categories[$cat['slug']] = Category::create([
                'tenant_id' => $tenant->id,
                'slug' => $cat['slug'],
                'name' => $cat['name'],
                'icon' => $cat['icon'],
                'has_serials' => false,
                'sort_order' => $cat['sort_order'],
                'is_active' => true,
            ]);
        }

        $items = [
            [
                'name' => 'Classic Cotton T-Shirt',
                'brand' => 'Zara',
                'variants' => [
                    ['specs' => ['Size M'], 'color' => 'Black'],
                    ['specs' => ['Size L'], 'color' => 'White'],
                    ['specs' => ['Size XL'], 'color' => 'Navy'],
                ],
            ],
            [
                'name' => 'Slim Fit Denim Jeans',
                'brand' => "Levi's",
                'variants' => [
                    ['specs' => ['Size 32'], 'color' => 'Dark Blue'],
                    ['specs' => ['Size 34'], 'color' => 'Black'],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['mens_clothing'], $items, false);
    }

    /**
     * Seed food and beverage categories and sample catalog.
     */
    protected function seedFoodBeverage(Tenant $tenant): void
    {
        $categoriesData = [
            ['slug' => 'hot_drinks', 'name' => 'Hot Drinks & Coffee', 'icon' => 'coffee', 'has_serials' => false, 'sort_order' => 1],
            ['slug' => 'cold_drinks', 'name' => 'Cold Drinks & Juices', 'icon' => 'glass-water', 'has_serials' => false, 'sort_order' => 2],
            ['slug' => 'snacks_pastries', 'name' => 'Snacks & Pastries', 'icon' => 'croissant', 'has_serials' => false, 'sort_order' => 3],
            ['slug' => 'meals', 'name' => 'Meals & Specials', 'icon' => 'utensils', 'has_serials' => false, 'sort_order' => 4],
        ];

        $categories = [];
        foreach ($categoriesData as $cat) {
            $categories[$cat['slug']] = Category::create([
                'tenant_id' => $tenant->id,
                'slug' => $cat['slug'],
                'name' => $cat['name'],
                'icon' => $cat['icon'],
                'has_serials' => false,
                'sort_order' => $cat['sort_order'],
                'is_active' => true,
            ]);
        }

        $items = [
            [
                'name' => 'Ethiopian Yirgacheffe Roast (250g)',
                'brand' => 'Tomoca',
                'variants' => [
                    ['specs' => ['Medium Roast']],
                    ['specs' => ['Dark Roast']],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['hot_drinks'], $items, false);
    }

    /**
     * Seed general retail categories and sample catalog.
     */
    protected function seedGeneralRetail(Tenant $tenant): void
    {
        $categoriesData = [
            ['slug' => 'packaged_goods', 'name' => 'Packaged Goods', 'icon' => 'package', 'has_serials' => false, 'sort_order' => 1],
            ['slug' => 'beverages', 'name' => 'Beverages', 'icon' => 'cup-soda', 'has_serials' => false, 'sort_order' => 2],
            ['slug' => 'personal_care', 'name' => 'Personal Care', 'icon' => 'sparkles', 'has_serials' => false, 'sort_order' => 3],
            ['slug' => 'household', 'name' => 'Household Essentials', 'icon' => 'home', 'has_serials' => false, 'sort_order' => 4],
        ];

        $categories = [];
        foreach ($categoriesData as $cat) {
            $categories[$cat['slug']] = Category::create([
                'tenant_id' => $tenant->id,
                'slug' => $cat['slug'],
                'name' => $cat['name'],
                'icon' => $cat['icon'],
                'has_serials' => false,
                'sort_order' => $cat['sort_order'],
                'is_active' => true,
            ]);
        }

        $items = [
            [
                'name' => 'Mineral Water 500ml',
                'brand' => 'Ambo',
                'variants' => [
                    ['specs' => ['Sparkling']],
                    ['specs' => ['Still']],
                ],
            ],
        ];

        $this->createProductGroup($tenant, $categories['beverages'], $items, false);
    }

    /**
     * Helper to create products and their variants within a category.
     *
     * @param  array<int, array<string, mixed>>  $products
     */
    protected function createProductGroup(Tenant $tenant, Category $category, array $products, bool $hasSerials): void
    {
        foreach ($products as $prodData) {
            $product = Product::create([
                'tenant_id' => $tenant->id,
                'category_id' => $category->id,
                'category' => $category->slug,
                'name' => $prodData['name'],
                'brand' => $prodData['brand'] ?? 'Generic',
                'has_serials' => $hasSerials,
                'is_active' => true,
            ]);

            $variants = $prodData['variants'] ?? [];
            if (empty($variants)) {
                ProductVariant::create([
                    'tenant_id' => $tenant->id,
                    'product_id' => $product->id,
                    'storage' => null,
                    'ram' => null,
                    'color' => null,
                    'specs' => null,
                    'default_selling_price' => null,
                ]);
            } else {
                foreach ($variants as $variantData) {
                    ProductVariant::create([
                        'tenant_id' => $tenant->id,
                        'product_id' => $product->id,
                        'storage' => $variantData['storage'] ?? null,
                        'ram' => $variantData['ram'] ?? null,
                        'color' => $variantData['color'] ?? null,
                        'specs' => $variantData['specs'] ?? null,
                        'default_selling_price' => null,
                    ]);
                }
            }
        }
    }
}
