<?php

namespace Database\Seeders;

use App\Models\Contact;
use App\Models\Debt;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Tenant;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RealBusinessDataSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create Design Partner Tenant
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'bole-tech-hub'],
            [
                'name' => 'Bole Tech Hub Electronics',
                'phone' => '+251911223344',
                'currency_code' => 'ETB',
                'settings' => [
                    'vat_registered' => false,
                    'track_gold_fx' => true,
                ],
                'is_active' => true,
            ]
        );

        TenantScope::setForcedTenantId($tenant->id);

        // 2. Create Users
        $owner = User::firstOrCreate(
            ['email' => 'yoni@boletech.et'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Yoni (Business Owner)',
                'password' => Hash::make('password123'),
                'phone' => '+251911000001',
                'role' => 'owner',
                'permissions' => ['can_view_costs' => true, 'can_discount' => true],
                'is_active' => true,
            ]
        );

        $husa = User::firstOrCreate(
            ['email' => 'husa@boletech.et'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Husa (Lead Sales)',
                'password' => Hash::make('password123'),
                'phone' => '+251911000002',
                'role' => 'salesperson',
                'permissions' => ['can_view_costs' => false, 'can_discount' => true],
                'is_active' => true,
            ]
        );

        $kalid = User::firstOrCreate(
            ['email' => 'kalid@boletech.et'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Kalid (Sales)',
                'password' => Hash::make('password123'),
                'phone' => '+251911000003',
                'role' => 'salesperson',
                'permissions' => ['can_view_costs' => false, 'can_discount' => false],
                'is_active' => true,
            ]
        );

        $neju = User::firstOrCreate(
            ['email' => 'neju@boletech.et'],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Neju (Sales)',
                'password' => Hash::make('password123'),
                'phone' => '+251911000004',
                'role' => 'salesperson',
                'permissions' => ['can_view_costs' => false, 'can_discount' => false],
                'is_active' => true,
            ]
        );

        // 3. Create Contacts (Peers, Debtors, Creditors)
        $contactsData = [
            // Peer Vendors (Neighbour Shop Sourcing)
            ['name' => 'Mekdi', 'phone' => '+251922110001', 'roles' => ['supplier', 'peer_vendor', 'creditor']],
            ['name' => 'Yenus', 'phone' => '+251922110002', 'roles' => ['supplier', 'peer_vendor', 'partner', 'creditor', 'debtor']],
            ['name' => 'Smith', 'phone' => '+251922110003', 'roles' => ['supplier', 'peer_vendor']],
            ['name' => 'Bini', 'phone' => '+251922110004', 'roles' => ['supplier', 'peer_vendor']],
            ['name' => 'Rovi', 'phone' => '+251922110005', 'roles' => ['supplier', 'peer_vendor']],
            ['name' => 'Meles', 'phone' => '+251922110006', 'roles' => ['supplier', 'peer_vendor']],
            ['name' => 'Hani Dagi', 'phone' => '+251922110007', 'roles' => ['supplier', 'peer_vendor']],
            // Debtors (Receivables)
            ['name' => 'Ebro', 'phone' => '+251933110001', 'roles' => ['customer', 'debtor']],
            ['name' => 'Halle', 'phone' => '+251933110002', 'roles' => ['customer', 'debtor', 'salesperson']],
            ['name' => 'Mejid', 'phone' => '+251933110003', 'roles' => ['customer', 'debtor']],
            ['name' => 'Dagi', 'phone' => '+251933110004', 'roles' => ['customer', 'debtor']],
            ['name' => 'Goya', 'phone' => '+251933110005', 'roles' => ['customer', 'debtor']],
            ['name' => 'Fuad', 'phone' => '+251933110006', 'roles' => ['customer', 'debtor', 'salesperson']],
            ['name' => 'Natty', 'phone' => '+251933110007', 'roles' => ['customer', 'debtor']],
            // Creditors (Payables)
            ['name' => 'Kal', 'phone' => '+251944110001', 'roles' => ['supplier', 'creditor']],
            ['name' => 'Tomi', 'phone' => '+251944110002', 'roles' => ['supplier', 'creditor', 'salesperson']],
            ['name' => 'Rahma', 'phone' => '+251944110003', 'roles' => ['supplier', 'creditor']],
        ];

        $contacts = [];
        foreach ($contactsData as $data) {
            $contacts[$data['name']] = Contact::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $data['name']],
                [
                    'phone' => $data['phone'],
                    'roles' => $data['roles'],
                    'is_active' => true,
                ]
            );
        }

        // 4. Create Financial Accounts
        $accountsData = [
            ['name' => 'Commercial Bank of Ethiopia (CBE)', 'type' => 'bank', 'account_number' => '100012345678', 'balance' => 1391633.00],
            ['name' => 'Bank of Abyssinia (BOA)', 'type' => 'bank', 'account_number' => 'BOA8927110', 'balance' => 141980.00],
            ['name' => 'Awash Bank', 'type' => 'bank', 'account_number' => 'AWASH098214', 'balance' => 258505.00],
            ['name' => 'TeleBirr Counter Wallet', 'type' => 'mobile_money', 'account_number' => '0911223344', 'balance' => 84900.00],
            ['name' => 'Zemen Bank', 'type' => 'bank', 'account_number' => 'ZEMEN33190', 'balance' => 58000.00],
            ['name' => 'Cash on Hand (Drawer)', 'type' => 'cash', 'account_number' => null, 'balance' => 573200.00],
            [
                'name' => 'Physical Gold Reserve',
                'type' => 'asset_gold',
                'balance' => 78600.00,
                'is_custom_asset' => true,
                'asset_details' => ['4g_ring_18k' => 58000, '40g_bracelet_21k' => 72800],
            ],
            [
                'name' => 'Forex & USDT Reserve',
                'type' => 'asset_fx',
                'balance' => 2171000.00,
                'is_custom_asset' => true,
                'asset_details' => ['usd_cash' => 11950, 'usdt_bybit' => 756],
            ],
        ];

        $accounts = [];
        foreach ($accountsData as $acc) {
            $accounts[$acc['name']] = FinancialAccount::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $acc['name']],
                [
                    'type' => $acc['type'],
                    'account_number' => $acc['account_number'] ?? null,
                    'currency' => 'ETB',
                    'current_balance' => $acc['balance'],
                    'is_custom_asset' => $acc['is_custom_asset'] ?? false,
                    'asset_details' => $acc['asset_details'] ?? null,
                    'is_active' => true,
                ]
            );
        }

        $this->call(FinancialAccountLogosSeeder::class);

        // 5. Products and Variants
        $iphone16pm = Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'iPhone 16 Pro Max'],
            ['brand' => 'Apple', 'category' => 'phones', 'has_serials' => true]
        );
        $v16pm_desert = ProductVariant::firstOrCreate(
            ['tenant_id' => $tenant->id, 'product_id' => $iphone16pm->id, 'storage' => '256GB', 'color' => 'Desert Titanium'],
            ['default_selling_price' => 185000.00]
        );
        $v16pm_black = ProductVariant::firstOrCreate(
            ['tenant_id' => $tenant->id, 'product_id' => $iphone16pm->id, 'storage' => '256GB', 'color' => 'Black Titanium'],
            ['default_selling_price' => 180000.00]
        );

        $s25ultra = Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Samsung Galaxy S25 Ultra'],
            ['brand' => 'Samsung', 'category' => 'phones', 'has_serials' => true]
        );
        $vs25_512 = ProductVariant::firstOrCreate(
            ['tenant_id' => $tenant->id, 'product_id' => $s25ultra->id, 'storage' => '512GB', 'color' => 'Titanium Silver'],
            ['default_selling_price' => 175000.00]
        );

        $ankerPower = Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Anker Power Bank 20000mAh'],
            ['brand' => 'Anker', 'category' => 'accessories', 'has_serials' => false]
        );
        $vAnker = ProductVariant::firstOrCreate(
            ['tenant_id' => $tenant->id, 'product_id' => $ankerPower->id, 'storage' => null, 'color' => 'Black'],
            ['default_selling_price' => 20000.00]
        );

        $ps5Joystick = Product::firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Sony PlayStation 5 DualSense Wireless Controller'],
            ['brand' => 'Sony', 'category' => 'gaming', 'has_serials' => false]
        );
        $vPs5 = ProductVariant::firstOrCreate(
            ['tenant_id' => $tenant->id, 'product_id' => $ps5Joystick->id, 'color' => 'White'],
            ['default_selling_price' => 11000.00]
        );

        // 6. Serialized Inventory Units (Real December 2025 Stock)
        $units = [
            [
                'variant_id' => $v16pm_desert->id,
                'imei_or_serial' => '354868698000074',
                'battery_health' => 100,
                'cycle_count' => 68,
                'sim_type' => 'esim',
                'condition' => 'used_clean',
                'cost_basis' => 160000.00,
                'status' => 'in_stock',
                'location' => 'Counter Safe',
            ],
            [
                'variant_id' => $v16pm_black->id,
                'imei_or_serial' => '350108724532079',
                'battery_health' => 93,
                'cycle_count' => 19,
                'sim_type' => 'physical',
                'condition' => 'used_clean',
                'cost_basis' => 145000.00,
                'status' => 'in_stock',
                'location' => 'Main Display',
            ],
            [
                'variant_id' => $vs25_512->id,
                'imei_or_serial' => '356356423127980',
                'battery_health' => 100,
                'cycle_count' => 5,
                'sim_type' => 'dual',
                'condition' => 'new',
                'cost_basis' => 147000.00,
                'status' => 'in_stock',
                'location' => 'Main Display',
            ],
        ];

        foreach ($units as $u) {
            InventoryUnit::firstOrCreate(
                ['tenant_id' => $tenant->id, 'imei_or_serial' => $u['imei_or_serial']],
                array_merge($u, ['tenant_id' => $tenant->id])
            );
        }

        // Quantity-based stock
        InventoryStock::updateOrCreate(
            ['tenant_id' => $tenant->id, 'variant_id' => $vAnker->id],
            ['quantity_on_hand' => 18, 'average_cost' => 15000.00]
        );
        InventoryStock::updateOrCreate(
            ['tenant_id' => $tenant->id, 'variant_id' => $vPs5->id],
            ['quantity_on_hand' => 12, 'average_cost' => 8500.00]
        );

        // 7. Debts (Receivables & Payables from Excel)
        $debtsData = [
            // Receivables
            ['contact' => 'Ebro', 'type' => 'receivable', 'amount' => 468000.00, 'paid' => 0.00, 'notes' => 'iPhone 15 and Apple Pen'],
            ['contact' => 'Halle', 'type' => 'receivable', 'amount' => 285000.00, 'paid' => 0.00, 'notes' => 'Running ledger balance'],
            ['contact' => 'Mejid', 'type' => 'receivable', 'amount' => 140000.00, 'paid' => 0.00, 'notes' => '490k - 250k - 100k balance'],
            ['contact' => 'Yenus', 'type' => 'receivable', 'amount' => 351000.00, 'paid' => 0.00, 'notes' => 'Phone credit balance'],
            ['contact' => 'Dagi', 'type' => 'receivable', 'amount' => 122000.00, 'paid' => 0.00, 'notes' => 'Samsung S25 Ultra remaining balance'],
            // Payables
            ['contact' => 'Kal', 'type' => 'payable', 'amount' => 33000.00, 'paid' => 0.00, 'notes' => 'iPhone stock payable'],
            ['contact' => 'Tomi', 'type' => 'payable', 'amount' => 3000.00, 'paid' => 0.00, 'notes' => 'Joystick balance'],
            ['contact' => 'Mekdi', 'type' => 'payable', 'amount' => 105000.00, 'paid' => 0.00, 'notes' => 'Brokered phones payable'],
        ];

        foreach ($debtsData as $d) {
            $contact = $contacts[$d['contact']] ?? null;
            if ($contact) {
                Debt::firstOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'contact_id' => $contact->id,
                        'type' => $d['type'],
                        'original_amount' => $d['amount'],
                    ],
                    [
                        'paid_amount' => $d['paid'],
                        'remaining_amount' => $d['amount'] - $d['paid'],
                        'status' => 'open',
                        'notes' => $d['notes'],
                    ]
                );
            }
        }

        // 8. Recorded Sales (Both Internal Stock and Brokered Neighbour Shop)
        // Sale 1: Brokered Anker Powerbank from Mekdi (Cost 15k, Sold 20k, Profit 5k)
        $sale1 = SalesOrder::firstOrCreate(
            ['tenant_id' => $tenant->id, 'order_number' => 'ORD-2025-001'],
            [
                'customer_id' => null,
                'salesperson_id' => $husa->id,
                'total_amount' => 20000.00,
                'discount_amount' => 0,
                'paid_amount' => 20000.00,
                'payment_status' => 'paid',
                'payment_method' => 'telebirr',
                'financial_account_id' => $accounts['TeleBirr Counter Wallet']->id,
                'notes' => 'Brokered from Mekdi for customer',
                'order_date' => now()->subDays(3),
            ]
        );

        SalesOrderItem::firstOrCreate(
            ['tenant_id' => $tenant->id, 'sales_order_id' => $sale1->id, 'variant_id' => $vAnker->id],
            [
                'quantity' => 1,
                'unit_price' => 20000.00,
                'unit_cost' => 15000.00,
                'profit' => 5000.00,
                'sourcing_type' => 'brokered_neighbour',
                'vendor_contact_id' => $contacts['Mekdi']->id,
                'vendor_cost' => 15000.00,
            ]
        );

        // 9. Routine Operating Expenses (from December 2025 sheet)
        Expense::firstOrCreate(
            ['tenant_id' => $tenant->id, 'description' => 'RIDE dispatch to customer in Bole'],
            [
                'financial_account_id' => $accounts['Cash on Hand (Drawer)']->id,
                'category' => 'ride',
                'amount' => 1262.00,
                'is_owner_draw' => false,
                'date' => now()->subDays(2),
                'created_by' => $owner->id,
            ]
        );
        Expense::firstOrCreate(
            ['tenant_id' => $tenant->id, 'description' => 'Team Lunch & Coffee'],
            [
                'financial_account_id' => $accounts['Cash on Hand (Drawer)']->id,
                'category' => 'food',
                'amount' => 700.00,
                'is_owner_draw' => false,
                'date' => now()->subDays(1),
                'created_by' => $owner->id,
            ]
        );

        TenantScope::setForcedTenantId(null);
    }
}
