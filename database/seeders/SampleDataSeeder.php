<?php

namespace Database\Seeders;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerCredit;
use App\Models\CustomerSegment;
use App\Models\CustomerSegmentMembership;
use App\Models\CustomerVoucher;
use App\Models\LoyaltyPointHistory;
use App\Models\Payable;
use App\Models\PayablePayment;
use App\Models\PricingRule;
use App\Models\PricingRuleBundleItem;
use App\Models\PricingRuleQtyBreak;
use App\Models\Product;
use App\Models\ProductWarehouse;
use App\Models\Profit;
use App\Models\PromoBanner;
use App\Models\Receivable;
use App\Models\ReceivablePayment;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Setting;
use App\Models\StockMutation;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SampleDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        Cart::truncate();
        LoyaltyPointHistory::truncate();
        CustomerVoucher::truncate();
        CustomerCredit::truncate();
        SalesReturnItem::truncate();
        SalesReturn::truncate();
        CashierShift::truncate();
        StockMutation::truncate();
        ReceivablePayment::truncate();
        PayablePayment::truncate();
        Receivable::truncate();
        Payable::truncate();
        TransactionDetail::truncate();
        Profit::truncate();
        Transaction::truncate();
        if (Schema::hasTable('pricing_rule_bundle_items')) {
            PricingRuleBundleItem::truncate();
        }
        if (Schema::hasTable('pricing_rule_qty_breaks')) {
            PricingRuleQtyBreak::truncate();
        }
        if (Schema::hasTable('pricing_rules')) {
            PricingRule::truncate();
        }
        if (Schema::hasTable('customer_segment_memberships')) {
            CustomerSegmentMembership::truncate();
        }
        if (Schema::hasTable('customer_segments')) {
            CustomerSegment::truncate();
        }
        if (Schema::hasTable('promo_banners')) {
            PromoBanner::truncate();
        }
        ProductWarehouse::truncate();
        Product::truncate();
        Category::truncate();
        Customer::truncate();
        Supplier::truncate();

        Schema::enableForeignKeyConstraints();

        // Ensure storage directories exist
        Storage::disk('public')->makeDirectory('category');
        Storage::disk('public')->makeDirectory('products');
        Storage::disk('public')->makeDirectory('banners');

        $this->command->info('1. Seeding Fashion Store Profile & Settings...');
        $this->seedStoreSettings();

        $this->command->info('2. Seeding Customers & VIP Loyalty Tiers...');
        $customers = $this->seedCustomers();
        $this->seedCustomerSegments($customers);

        $this->command->info('3. Seeding Loyalty Vouchers & Coupons...');
        $this->seedCustomerVouchers($customers);

        $this->command->info('4. Seeding Fashion Suppliers...');
        $suppliers = $this->seedSuppliers();

        $this->command->info('5. Seeding Fashion Categories with Curated Images...');
        $categories = $this->seedCategories();

        $this->command->info('6. Seeding Fashion Master Products & Color-Size Variant Matrix...');
        $products = $this->seedProducts($categories);

        $this->command->info('7. Seeding Advanced Pricing Rules (OOTD Bundling & Qty Breaks)...');
        $this->seedPricingRules($products);

        $this->command->info('8. Seeding E-Catalog Promo Banners...');
        $this->seedPromoBanners($categories);

        $this->command->info('9. Seeding Fashion Transactions...');
        $this->seedTransactions($customers, $products);

        $this->command->info('10. Seeding Receivables (Boutique B2B Invoices)...');
        $this->seedReceivables($customers);

        $this->command->info('11. Seeding Payables (Garment & Textile Invoices)...');
        $this->seedPayables($suppliers);

        $this->command->info('Fashion Store Sample Data seeding completed successfully!');
    }

    /**
     * Download image from URL and save to storage with resilient SVG fallback.
     */
    private function downloadImage(string $url, string $folder, string $filename, string $title = 'Item', string $bgColor = '#111827'): ?string
    {
        $targetJpg = $folder.'/'.$filename.'.jpg';
        $targetSvg = $folder.'/'.$filename.'.svg';

        if (Storage::disk('public')->exists($targetJpg)) {
            return $filename.'.jpg';
        }
        if (Storage::disk('public')->exists($targetSvg)) {
            return $filename.'.svg';
        }

        try {
            $this->command->info("  Downloading image for: {$filename}...");
            $response = Http::timeout(6)->get($url);

            if ($response->successful()) {
                Storage::disk('public')->put($targetJpg, $response->body());

                return $filename.'.jpg';
            }
        } catch (\Throwable $e) {
            $this->command->warn("  Image download skipped for {$filename} (using offline SVG fallback)");
        }

        // Resilient, beautiful minimalist SVG placeholder
        $escapedTitle = htmlspecialchars($title, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="{$bgColor}"/>
  <rect x="25" y="25" width="550" height="550" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.15"/>
  <circle cx="300" cy="240" r="60" fill="#ffffff" fill-opacity="0.08"/>
  <text x="50%" y="360" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="600" letter-spacing="1">{$escapedTitle}</text>
  <text x="50%" y="400" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill-opacity="0.6" letter-spacing="2">VELOUR APPAREL &amp; CO.</text>
</svg>
SVG;

        Storage::disk('public')->put($targetSvg, $svg);

        return $filename.'.svg';
    }

    /**
     * Seed store settings for Velour Apparel & Co.
     */
    private function seedStoreSettings(): void
    {
        $settings = [
            'store_name' => ['value' => 'VELOUR APPAREL & CO.', 'description' => 'Nama butik retail fashion'],
            'store_address' => ['value' => 'Jl. Senopati No. 88, Kebayoran Baru, Jakarta Selatan, DKI Jakarta 12190', 'description' => 'Alamat lengkap toko'],
            'store_phone' => ['value' => '0812-9988-7766', 'description' => 'Nomor WhatsApp resmi toko'],
            'store_email' => ['value' => 'hello@velourapparel.test', 'description' => 'Email butik'],
            'store_website' => ['value' => 'https://velourapparel.test', 'description' => 'Website katalog online'],
            'store_city' => ['value' => 'Jakarta Selatan', 'description' => 'Kota toko'],
            'monthly_sales_target' => ['value' => '35000000', 'description' => 'Target penjualan bulanan butik'],
        ];

        foreach ($settings as $key => $payload) {
            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => $payload['value'],
                    'description' => $payload['description'],
                ]
            );
        }
    }

    /**
     * Seed master fashion customers with VIP membership tiers.
     */
    private function seedCustomers(): Collection
    {
        $customers = collect([
            [
                'name' => 'Salsa Bella',
                'no_telp' => '6281211112222',
                'address' => 'Jl. Gunawarman No. 24, Jakarta Selatan',
                'is_loyalty_member' => true,
                'member_code' => 'MEM-SALSA01',
                'loyalty_tier' => 'platinum',
                'loyalty_points' => 540,
                'loyalty_total_spent' => 6850000,
                'loyalty_transaction_count' => 14,
                'loyalty_member_since' => now()->subMonths(10),
            ],
            [
                'name' => 'Dimas Ramadhan',
                'no_telp' => '6281233334444',
                'address' => 'Jl. Suryo No. 12, Kebayoran Baru, Jakarta Selatan',
                'is_loyalty_member' => true,
                'member_code' => 'MEM-DIMAS02',
                'loyalty_tier' => 'gold',
                'loyalty_points' => 220,
                'loyalty_total_spent' => 2450000,
                'loyalty_transaction_count' => 7,
                'loyalty_member_since' => now()->subMonths(5),
            ],
            [
                'name' => 'Clara Natasha',
                'no_telp' => '6281255556666',
                'address' => 'Jl. Kemang Raya No. 45, Jakarta Selatan',
                'is_loyalty_member' => true,
                'member_code' => 'MEM-CLARA03',
                'loyalty_tier' => 'silver',
                'loyalty_points' => 75,
                'loyalty_total_spent' => 890000,
                'loyalty_transaction_count' => 3,
                'loyalty_member_since' => now()->subMonths(2),
            ],
            [
                'name' => 'Aldi Pratama',
                'no_telp' => '6281277778888',
                'address' => 'Jl. Cikajang No. 18, Senopati, Jakarta Selatan',
                'is_loyalty_member' => true,
                'member_code' => 'MEM-ALDI04',
                'loyalty_tier' => 'bronze',
                'loyalty_points' => 30,
                'loyalty_total_spent' => 350000,
                'loyalty_transaction_count' => 1,
                'loyalty_member_since' => now()->subWeeks(2),
            ],
            [
                'name' => 'Bunga Amelia',
                'no_telp' => '6281299990000',
                'address' => 'Jl. Panglima Polim No. 9, Jakarta Selatan',
                'is_loyalty_member' => true,
                'member_code' => 'MEM-BUNGA05',
                'loyalty_tier' => 'gold',
                'loyalty_points' => 190,
                'loyalty_total_spent' => 2100000,
                'loyalty_transaction_count' => 5,
                'loyalty_member_since' => now()->subMonths(4),
            ],
            [
                'name' => 'Randi Oktavian',
                'no_telp' => '6281312345678',
                'address' => 'Jl. Dharmawangsa No. 3, Jakarta Selatan',
            ],
            [
                'name' => 'Gina Putri',
                'no_telp' => '6281398765432',
                'address' => 'Jl. Gandaria I No. 15, Jakarta Selatan',
            ],
            [
                'name' => 'Hendra Wijaya',
                'no_telp' => '6281787654321',
                'address' => 'Jl. Bangka Raya No. 27, Mampang, Jakarta Selatan',
            ],
        ]);

        return $customers
            ->map(fn ($customer) => Customer::create($customer))
            ->keyBy('name');
    }

    /**
     * Seed CRM Customer Segments.
     */
    private function seedCustomerSegments(Collection $customers): void
    {
        if (! Schema::hasTable('customer_segments')) {
            return;
        }

        $segments = [
            [
                'name' => 'VIP & High Spenders',
                'slug' => 'vip-high-spenders',
                'type' => 'auto',
                'is_active' => true,
                'description' => 'Pelanggan loyal dengan total belanja di atas Rp 2.000.000.',
                'auto_rule_type' => 'total_spent',
                'rule_config' => ['min_total_spent' => 2000000],
            ],
            [
                'name' => 'Streetwear Trendsetters',
                'slug' => 'streetwear-trendsetters',
                'type' => 'manual',
                'is_active' => true,
                'description' => 'Member pecinta koleksi streetwear, kaos boxy, dan denim.',
            ],
            [
                'name' => 'Weekend Shoppers',
                'slug' => 'weekend-shoppers',
                'type' => 'manual',
                'is_active' => true,
                'description' => 'Pelanggan aktif berbelanja di butik fisik saat akhir pekan.',
            ],
        ];

        foreach ($segments as $data) {
            $segment = CustomerSegment::create($data);

            if ($segment->slug === 'vip-high-spenders') {
                $vipCustomers = $customers->filter(fn ($c) => ($c->loyalty_total_spent ?? 0) >= 2000000);
                foreach ($vipCustomers as $c) {
                    CustomerSegmentMembership::create([
                        'customer_segment_id' => $segment->id,
                        'customer_id' => $c->id,
                        'source' => 'system',
                        'matched_at' => now()->subMonths(2),
                    ]);
                }
            } elseif ($segment->slug === 'streetwear-trendsetters') {
                $streetwear = $customers->filter(fn ($c) => in_array($c->name, ['Salsa Bella', 'Dimas Ramadhan', 'Aldi Pratama']));
                foreach ($streetwear as $c) {
                    CustomerSegmentMembership::create([
                        'customer_segment_id' => $segment->id,
                        'customer_id' => $c->id,
                        'source' => 'manual',
                        'matched_at' => now()->subMonth(),
                    ]);
                }
            }
        }
    }

    /**
     * Seed customer vouchers & public coupons.
     */
    private function seedCustomerVouchers(Collection $customers): void
    {
        $salsa = $customers->get('Salsa Bella');
        $dimas = $customers->get('Dimas Ramadhan');

        if ($salsa) {
            CustomerVoucher::create([
                'customer_id' => $salsa->id,
                'code' => 'VCR-VIP50K',
                'name' => 'Voucher Eksklusif VIP Platinum',
                'discount_type' => 'fixed_amount',
                'discount_value' => 50000,
                'minimum_order' => 250000,
                'is_active' => true,
                'starts_at' => now()->subDays(7),
                'expires_at' => now()->addDays(45),
            ]);
        }

        if ($dimas) {
            CustomerVoucher::create([
                'customer_id' => $dimas->id,
                'code' => 'VCR-GOLD25K',
                'name' => 'Voucher Reward Loyal Gold',
                'discount_type' => 'fixed_amount',
                'discount_value' => 25000,
                'minimum_order' => 150000,
                'is_active' => true,
                'starts_at' => now()->subDays(5),
                'expires_at' => now()->addDays(30),
            ]);
        }

        // Public discount coupons
        $publicCoupons = [
            [
                'code' => 'NEWSEASON15',
                'name' => 'Diskon New Arrival 15%',
                'discount_type' => 'percentage',
                'discount_value' => 15,
                'max_discount' => 50000,
                'minimum_order' => 150000,
                'usage_limit' => 300,
            ],
            [
                'code' => 'OOTDHEMAT',
                'name' => 'Potongan OOTD Rp 30.000',
                'discount_type' => 'fixed_amount',
                'discount_value' => 30000,
                'minimum_order' => 200000,
                'usage_limit' => 200,
            ],
            [
                'code' => 'FREESHIP',
                'name' => 'Subsidi Ongkos Kirim Rp 15.000',
                'discount_type' => 'fixed_amount',
                'discount_value' => 15000,
                'minimum_order' => 120000,
                'usage_limit' => 500,
            ],
        ];

        foreach ($publicCoupons as $pc) {
            CustomerVoucher::create([
                'customer_id' => null,
                'code' => $pc['code'],
                'name' => $pc['name'],
                'discount_type' => $pc['discount_type'],
                'discount_value' => $pc['discount_value'],
                'max_discount' => $pc['max_discount'] ?? null,
                'minimum_order' => $pc['minimum_order'],
                'usage_limit' => $pc['usage_limit'],
                'is_active' => true,
                'starts_at' => now()->subDays(7),
                'expires_at' => now()->addDays(60),
            ]);
        }
    }

    /**
     * Seed master fashion suppliers.
     */
    private function seedSuppliers(): Collection
    {
        $suppliers = collect([
            [
                'name' => 'PT Garment Bandung Textiles',
                'phone' => '0227819001',
                'email' => 'sales@garmentbandung.test',
                'address' => 'Kawasan Industri Tekstil No. 12, Bandung',
            ],
            [
                'name' => 'CV Denim Mill Nusantara',
                'phone' => '0285421102',
                'email' => 'order@denimmill.test',
                'address' => 'Jl. Raya Pantura KM 14, Pekalongan',
            ],
            [
                'name' => 'Bengkel Artisan Footwear Cibaduyut',
                'phone' => '0225402230',
                'email' => 'artisan@cibaduyutshoes.test',
                'address' => 'Jl. Cibaduyut Raya No. 45, Bandung',
            ],
            [
                'name' => 'UD Label & Aksesoris Mode',
                'phone' => '0215890040',
                'email' => 'support@labelmode.test',
                'address' => 'Jl. Pangeran Jayakarta No. 70, Jakarta Pusat',
            ],
        ]);

        return $suppliers
            ->map(fn ($supplier) => Supplier::create($supplier))
            ->keyBy('name');
    }

    /**
     * Seed fashion categories with images.
     */
    private function seedCategories(): Collection
    {
        $categories = collect([
            [
                'name' => 'Kaos & T-Shirt',
                'description' => 'Heavyweight combed & oversized boxy t-shirts',
                'image_url' => 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&h=500&fit=crop',
                'color_hex' => '#1F2937',
            ],
            [
                'name' => 'Kemeja & Flannel',
                'description' => 'Oxford button-down & casual short-sleeve shirts',
                'image_url' => 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&h=500&fit=crop',
                'color_hex' => '#2563EB',
            ],
            [
                'name' => 'Hoodie & Sweatshirt',
                'description' => 'French terry boxy hoodies & crewnecks 330gsm',
                'image_url' => 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&h=500&fit=crop',
                'color_hex' => '#4B5563',
            ],
            [
                'name' => 'Celana Chino & Ankle',
                'description' => 'Stretch cotton tapered chinos & cropped trousers',
                'image_url' => 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&h=500&fit=crop',
                'color_hex' => '#D97706',
            ],
            [
                'name' => 'Celana Denim & Jeans',
                'description' => 'Raw selvedge & relaxed straight fit denim',
                'image_url' => 'https://images.unsplash.com/photo-1542272604-780c96856592?w=500&h=500&fit=crop',
                'color_hex' => '#1E3A8A',
            ],
            [
                'name' => 'Jaket & Outerwear',
                'description' => 'Workwear chore coats & denim trucker jackets',
                'image_url' => 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&h=500&fit=crop',
                'color_hex' => '#78350F',
            ],
            [
                'name' => 'Sepatu & Sneakers',
                'description' => 'Vulcanized canvas low sneakers & leather loafers',
                'image_url' => 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&h=500&fit=crop',
                'color_hex' => '#374151',
            ],
            [
                'name' => 'Tas & Aksesoris',
                'description' => 'Canvas tote bags, dad caps, & everyday essentials',
                'image_url' => 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&h=500&fit=crop',
                'color_hex' => '#059669',
            ],
        ]);

        return $categories->map(function ($cat) {
            $slug = Str::slug($cat['name']);
            $image = $this->downloadImage(
                $cat['image_url'],
                'category',
                'cat-'.$slug,
                $cat['name'],
                $cat['color_hex']
            );

            return Category::create([
                'name' => $cat['name'],
                'description' => $cat['description'],
                'image' => $image,
            ]);
        })->keyBy('name');
    }

    /**
     * Seed fashion master products & variant matrices.
     */
    private function seedProducts(Collection $categories): Collection
    {
        $defaultWarehouse = Warehouse::active()->orderBy('sort_order')->orderBy('code')->first();
        $branchWarehouse = Warehouse::where('code', 'CABANG-1')->first();

        $seededCatalog = collect();

        // 1. Heavyweight Boxy T-Shirt 24s (Parent + 12 Variants)
        $tshirtParent = Product::create([
            'category_id' => $categories->get('Kaos & T-Shirt')?->id,
            'barcode' => 'APRL-TSH-001',
            'sku' => 'VEL-TSH-001',
            'title' => 'Heavyweight Boxy T-Shirt 24s',
            'description' => '100% Ring Spun Cotton Combed 24s (195-205 GSM). Cutting boxy oversize dengan rib leher tebal 2.5cm elastis anti melar. Jahitan rantai pundak standar garmen ekspor.',
            'buy_price' => 65000,
            'sell_price' => 139000,
            'weight' => 250,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'color',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&h=800&fit=crop', 'products', 'prod-tshirt-parent', 'Heavyweight Boxy T-Shirt 24s', '#111827'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($tshirtParent->barcode, $tshirtParent);

        $tshirtColors = [
            ['name' => 'Jet Black', 'hex' => '#111827', 'code' => 'BLK', 'img' => 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&h=800&fit=crop'],
            ['name' => 'Cloud White', 'hex' => '#F9FAFB', 'code' => 'WHT', 'img' => 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=800&fit=crop'],
            ['name' => 'Sage Green', 'hex' => '#87A96B', 'code' => 'SGE', 'img' => 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&h=800&fit=crop'],
        ];
        $tshirtSizes = ['S', 'M', 'L', 'XL'];

        foreach ($tshirtColors as $col) {
            $colImage = $this->downloadImage($col['img'], 'products', 'prod-tshirt-'.strtolower($col['code']), $col['name'].' Tee', $col['hex']);

            foreach ($tshirtSizes as $size) {
                $stockQty = match ($size) {
                    'M', 'L' => 45,
                    'S' => 20,
                    'XL' => 12,
                    default => 25
                };
                $barcode = "TSH-OVR-{$col['code']}-{$size}";
                $sku = "VEL-TSH01-{$col['code']}-{$size}";

                $variant = Product::create([
                    'parent_id' => $tshirtParent->id,
                    'category_id' => $tshirtParent->category_id,
                    'barcode' => $barcode,
                    'sku' => $sku,
                    'title' => "Heavyweight Boxy T-Shirt 24s - {$col['name']} {$size}",
                    'description' => $tshirtParent->description,
                    'buy_price' => $tshirtParent->buy_price,
                    'sell_price' => $tshirtParent->sell_price,
                    'weight' => $tshirtParent->weight,
                    'tax_type' => 'inclusive',
                    'tax_rate' => 0,
                    'has_variants' => false,
                    'image' => $colImage,
                    'variant_attributes' => [
                        'color_name' => $col['name'],
                        'color_hex' => $col['hex'],
                        'size' => $size,
                    ],
                ]);

                if ($defaultWarehouse) {
                    $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
                }
                if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                    $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.6)]);
                }

                $seededCatalog->put($barcode, $variant);
            }
        }

        // 2. Relaxed Oxford Button-Down Shirt (Parent + 8 Variants)
        $shirtParent = Product::create([
            'category_id' => $categories->get('Kemeja & Flannel')?->id,
            'barcode' => 'APRL-SHT-002',
            'sku' => 'VEL-SHT-002',
            'title' => 'Relaxed Oxford Button-Down Shirt',
            'description' => 'Bahan Premium Cotton Oxford import dengan tekstur tenun khas. Kerah button-down rapi, kancing resin velour engraved, saku dada kiri dengan pen slot.',
            'buy_price' => 115000,
            'sell_price' => 249000,
            'weight' => 320,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'color',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=800&fit=crop', 'products', 'prod-shirt-parent', 'Relaxed Oxford Button-Down', '#2563EB'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($shirtParent->barcode, $shirtParent);

        $shirtColors = [
            ['name' => 'Cloud White', 'hex' => '#F9FAFB', 'code' => 'WHT', 'img' => 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=800&fit=crop'],
            ['name' => 'Vintage Navy', 'hex' => '#1E3A8A', 'code' => 'NVY', 'img' => 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&h=800&fit=crop'],
        ];
        $shirtSizes = ['S', 'M', 'L', 'XL'];

        foreach ($shirtColors as $col) {
            $colImage = $this->downloadImage($col['img'], 'products', 'prod-shirt-'.strtolower($col['code']), $col['name'].' Shirt', $col['hex']);

            foreach ($shirtSizes as $size) {
                $stockQty = match ($size) {
                    'M', 'L' => 30,
                    default => 15
                };
                $barcode = "SHT-OXF-{$col['code']}-{$size}";
                $sku = "VEL-SHT02-{$col['code']}-{$size}";

                $variant = Product::create([
                    'parent_id' => $shirtParent->id,
                    'category_id' => $shirtParent->category_id,
                    'barcode' => $barcode,
                    'sku' => $sku,
                    'title' => "Relaxed Oxford Button-Down Shirt - {$col['name']} {$size}",
                    'description' => $shirtParent->description,
                    'buy_price' => $shirtParent->buy_price,
                    'sell_price' => $shirtParent->sell_price,
                    'weight' => $shirtParent->weight,
                    'tax_type' => 'inclusive',
                    'tax_rate' => 0,
                    'has_variants' => false,
                    'image' => $colImage,
                    'variant_attributes' => [
                        'color_name' => $col['name'],
                        'color_hex' => $col['hex'],
                        'size' => $size,
                    ],
                ]);

                if ($defaultWarehouse) {
                    $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
                }
                if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                    $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.5)]);
                }

                $seededCatalog->put($barcode, $variant);
            }
        }

        // 3. Essential Pullover Hoodie 330gsm (Parent + 6 Variants)
        $hoodieParent = Product::create([
            'category_id' => $categories->get('Hoodie & Sweatshirt')?->id,
            'barcode' => 'APRL-HD-003',
            'sku' => 'VEL-HD-003',
            'title' => 'Essential Pullover Hoodie 330gsm',
            'description' => 'Heavy French Terry Cotton 330 GSM dengan bagian dalam halus non-fleece (tidak gerah di iklim tropis). Double-layered hood tanpa tali serut untuk siluet minimalis clean.',
            'buy_price' => 145000,
            'sell_price' => 329000,
            'weight' => 680,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'color',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&h=800&fit=crop', 'products', 'prod-hoodie-parent', 'Essential Pullover Hoodie', '#4B5563'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($hoodieParent->barcode, $hoodieParent);

        $hoodieColors = [
            ['name' => 'Charcoal Grey', 'hex' => '#4B5563', 'code' => 'CHR', 'img' => 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&h=800&fit=crop'],
            ['name' => 'Sage Green', 'hex' => '#87A96B', 'code' => 'SGE', 'img' => 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800&h=800&fit=crop'],
        ];
        $hoodieSizes = ['M', 'L', 'XL'];

        foreach ($hoodieColors as $col) {
            $colImage = $this->downloadImage($col['img'], 'products', 'prod-hoodie-'.strtolower($col['code']), $col['name'].' Hoodie', $col['hex']);

            foreach ($hoodieSizes as $size) {
                $stockQty = match ($size) {
                    'L' => 28,
                    'M' => 22,
                    default => 10
                };
                $barcode = "HD-PLV-{$col['code']}-{$size}";
                $sku = "VEL-HD03-{$col['code']}-{$size}";

                $variant = Product::create([
                    'parent_id' => $hoodieParent->id,
                    'category_id' => $hoodieParent->category_id,
                    'barcode' => $barcode,
                    'sku' => $sku,
                    'title' => "Essential Pullover Hoodie 330gsm - {$col['name']} {$size}",
                    'description' => $hoodieParent->description,
                    'buy_price' => $hoodieParent->buy_price,
                    'sell_price' => $hoodieParent->sell_price,
                    'weight' => $hoodieParent->weight,
                    'tax_type' => 'inclusive',
                    'tax_rate' => 0,
                    'has_variants' => false,
                    'image' => $colImage,
                    'variant_attributes' => [
                        'color_name' => $col['name'],
                        'color_hex' => $col['hex'],
                        'size' => $size,
                    ],
                ]);

                if ($defaultWarehouse) {
                    $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
                }
                if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                    $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.5)]);
                }

                $seededCatalog->put($barcode, $variant);
            }
        }

        // 4. Slim Tapered Stretch Chino Pants (Parent + 8 Variants)
        $chinoParent = Product::create([
            'category_id' => $categories->get('Celana Chino & Ankle')?->id,
            'barcode' => 'APRL-PNT-004',
            'sku' => 'VEL-PNT-004',
            'title' => 'Slim Tapered Stretch Chino Pants',
            'description' => 'Cotton Twill 98% + 2% Spandex Elastane untuk kenyamanan gerak maksimal. YKK zipper lock, saku dalam katun motif herringbone, saku belakang jet pocket.',
            'buy_price' => 120000,
            'sell_price' => 269000,
            'weight' => 520,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'color',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop', 'products', 'prod-chino-parent', 'Slim Tapered Chino Pants', '#D97706'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop',
                'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($chinoParent->barcode, $chinoParent);

        $chinoColors = [
            ['name' => 'Earth Sand', 'hex' => '#D4A373', 'code' => 'SND', 'img' => 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800&h=800&fit=crop'],
            ['name' => 'Jet Black', 'hex' => '#111827', 'code' => 'BLK', 'img' => 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=800&fit=crop'],
        ];
        $chinoSizes = ['30', '32', '34', '36'];

        foreach ($chinoColors as $col) {
            $colImage = $this->downloadImage($col['img'], 'products', 'prod-chino-'.strtolower($col['code']), $col['name'].' Chino', $col['hex']);

            foreach ($chinoSizes as $size) {
                $stockQty = match ($size) {
                    '32', '34' => 35,
                    default => 15
                };
                $barcode = "PNT-CHN-{$col['code']}-{$size}";
                $sku = "VEL-PNT04-{$col['code']}-{$size}";

                $variant = Product::create([
                    'parent_id' => $chinoParent->id,
                    'category_id' => $chinoParent->category_id,
                    'barcode' => $barcode,
                    'sku' => $sku,
                    'title' => "Slim Tapered Stretch Chino - {$col['name']} Size {$size}",
                    'description' => $chinoParent->description,
                    'buy_price' => $chinoParent->buy_price,
                    'sell_price' => $chinoParent->sell_price,
                    'weight' => $chinoParent->weight,
                    'tax_type' => 'inclusive',
                    'tax_rate' => 0,
                    'has_variants' => false,
                    'image' => $colImage,
                    'variant_attributes' => [
                        'color_name' => $col['name'],
                        'color_hex' => $col['hex'],
                        'size' => $size,
                    ],
                ]);

                if ($defaultWarehouse) {
                    $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
                }
                if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                    $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.5)]);
                }

                $seededCatalog->put($barcode, $variant);
            }
        }

        // 5. Raw Selvedge Accent 14oz Denim (Parent + 4 Variants)
        $denimParent = Product::create([
            'category_id' => $categories->get('Celana Denim & Jeans')?->id,
            'barcode' => 'APRL-DNM-005',
            'sku' => 'VEL-DNM-005',
            'title' => 'Raw Selvedge Accent 14oz Denim Jeans',
            'description' => '14oz Rigid Right-Hand Twill Deep Indigo Denim dengan aksen selvedge line di outseam. Donut button fly tembaga antik, patch kulit nabati asli. Siap menghasilkan fade personal unik seiring pemakaian.',
            'buy_price' => 185000,
            'sell_price' => 429000,
            'weight' => 750,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'pill',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1542272604-780c96856592?w=800&h=800&fit=crop', 'products', 'prod-denim-parent', 'Raw Selvedge Denim', '#1E3A8A'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($denimParent->barcode, $denimParent);

        $denimSizes = ['30', '32', '34', '36'];
        foreach ($denimSizes as $size) {
            $stockQty = match ($size) {
                '32' => 25,
                '34' => 20,
                default => 12
            };
            $barcode = "DNM-RAW-IND-{$size}";
            $sku = "VEL-DNM05-IND-{$size}";

            $variant = Product::create([
                'parent_id' => $denimParent->id,
                'category_id' => $denimParent->category_id,
                'barcode' => $barcode,
                'sku' => $sku,
                'title' => "Raw Selvedge Accent 14oz Denim - Deep Indigo Size {$size}",
                'description' => $denimParent->description,
                'buy_price' => $denimParent->buy_price,
                'sell_price' => $denimParent->sell_price,
                'weight' => $denimParent->weight,
                'tax_type' => 'inclusive',
                'tax_rate' => 0,
                'has_variants' => false,
                'image' => $denimParent->image,
                'variant_attributes' => [
                    'color_name' => 'Deep Indigo',
                    'color_hex' => '#1E3A8A',
                    'size' => $size,
                ],
            ]);

            if ($defaultWarehouse) {
                $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
            }
            if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.5)]);
            }

            $seededCatalog->put($barcode, $variant);
        }

        // 6. Classic Canvas Low Sneakers (Parent + 5 Variants)
        $shoesParent = Product::create([
            'category_id' => $categories->get('Sepatu & Sneakers')?->id,
            'barcode' => 'APRL-SH-007',
            'sku' => 'VEL-SH-007',
            'title' => 'Classic Canvas Low Sneakers',
            'description' => '12oz Heavy Canvas Upper dengan konstruksi vulkanisir oven ganda. Insole memory foam antibakteri empuk, outsole rubber waffle anti licin.',
            'buy_price' => 160000,
            'sell_price' => 349000,
            'weight' => 950,
            'tax_type' => 'inclusive',
            'tax_rate' => 0,
            'has_variants' => true,
            'variant_display_type' => 'pill',
            'image' => $this->downloadImage('https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&h=800&fit=crop', 'products', 'prod-shoes-parent', 'Classic Canvas Low Sneakers', '#374151'),
            'gallery_images' => [
                'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&h=800&fit=crop',
            ],
        ]);
        $seededCatalog->put($shoesParent->barcode, $shoesParent);

        $shoeSizes = ['40', '41', '42', '43', '44'];
        foreach ($shoeSizes as $size) {
            $stockQty = match ($size) {
                '41', '42' => 24,
                default => 14
            };
            $barcode = "SH-SNK-WHT-{$size}";
            $sku = "VEL-SH07-WHT-{$size}";

            $variant = Product::create([
                'parent_id' => $shoesParent->id,
                'category_id' => $shoesParent->category_id,
                'barcode' => $barcode,
                'sku' => $sku,
                'title' => "Classic Canvas Low Sneakers - Off-White Size {$size}",
                'description' => $shoesParent->description,
                'buy_price' => $shoesParent->buy_price,
                'sell_price' => $shoesParent->sell_price,
                'weight' => $shoesParent->weight,
                'tax_type' => 'inclusive',
                'tax_rate' => 0,
                'has_variants' => false,
                'image' => $shoesParent->image,
                'variant_attributes' => [
                    'color_name' => 'Off-White',
                    'color_hex' => '#F3F4F6',
                    'size' => $size,
                ],
            ]);

            if ($defaultWarehouse) {
                $variant->warehouses()->attach($defaultWarehouse->id, ['stock' => $stockQty]);
            }
            if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                $variant->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($stockQty * 0.5)]);
            }

            $seededCatalog->put($barcode, $variant);
        }

        // 7. Non-Variant Accessories (Simple Products)
        $accessories = [
            [
                'barcode' => 'APRL-ACC-001',
                'sku' => 'VEL-ACC-001',
                'title' => 'Heavy Utility Canvas Tote Bag',
                'description' => 'Canvas 16oz tebal dengan compartment laptop 15 inci empuk, saku botol minum samping, dan resleting YKK utama.',
                'buy_price' => 45000,
                'sell_price' => 99000,
                'stock' => 50,
                'weight' => 350,
                'image_url' => 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=800&fit=crop',
                'color_hex' => '#059669',
            ],
            [
                'barcode' => 'APRL-ACC-002',
                'sku' => 'VEL-ACC-002',
                'title' => 'Washed Cotton Dad Cap',
                'description' => 'Topi 6-panel unconstructed dengan bahan washed cotton lembut, strap belakang kulit dengan buckle kuningan antik.',
                'buy_price' => 35000,
                'sell_price' => 89000,
                'stock' => 60,
                'weight' => 120,
                'image_url' => 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=800&fit=crop',
                'color_hex' => '#78350F',
            ],
            [
                'barcode' => 'APRL-ACC-003',
                'sku' => 'VEL-ACC-003',
                'title' => 'Ribbed Crew Socks - 3 Pack',
                'description' => 'Kaus kaki katun spandeks rajut rib tebal isi 3 pasang (Hitam, Putih, Abu-abu). Arch support elastis anti melorot.',
                'buy_price' => 28000,
                'sell_price' => 69000,
                'stock' => 80,
                'weight' => 150,
                'image_url' => 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800&h=800&fit=crop',
                'color_hex' => '#4B5563',
            ],
        ];

        foreach ($accessories as $acc) {
            $image = $this->downloadImage(
                $acc['image_url'],
                'products',
                'prod-'.Str::slug($acc['title']),
                $acc['title'],
                $acc['color_hex']
            );

            $product = Product::create([
                'category_id' => $categories->get('Tas & Aksesoris')?->id,
                'barcode' => $acc['barcode'],
                'sku' => $acc['sku'],
                'title' => $acc['title'],
                'description' => $acc['description'],
                'buy_price' => $acc['buy_price'],
                'sell_price' => $acc['sell_price'],
                'weight' => $acc['weight'],
                'tax_type' => 'inclusive',
                'tax_rate' => 0,
                'has_variants' => false,
                'image' => $image,
            ]);

            if ($defaultWarehouse) {
                $product->warehouses()->attach($defaultWarehouse->id, ['stock' => $acc['stock']]);
            }
            if ($branchWarehouse && $branchWarehouse->id !== $defaultWarehouse?->id) {
                $product->warehouses()->attach($branchWarehouse->id, ['stock' => (int) round($acc['stock'] * 0.5)]);
            }

            $seededCatalog->put($acc['barcode'], $product);
        }

        return $seededCatalog;
    }

    /**
     * Seed advanced pricing rules (OOTD Bundle & Qty Breaks).
     */
    private function seedPricingRules(Collection $products): void
    {
        if (! Schema::hasTable('pricing_rules')) {
            return;
        }

        $admin = User::where('email', 'admin@mail.com')->first() ?? User::first();
        $tshirtParent = $products->get('APRL-TSH-001');
        $chinoParent = $products->get('APRL-PNT-004');

        if ($tshirtParent && $chinoParent && Schema::hasTable('pricing_rule_bundle_items')) {
            // Bundle Rule: OOTD Weekend Bundle
            $bundleRule = PricingRule::create([
                'name' => 'OOTD Weekend Bundle (Kaos Boxy + Chino Pants)',
                'kind' => 'bundle',
                'target_type' => 'all',
                'customer_scope' => 'all',
                'discount_type' => 'fixed_amount',
                'discount_value' => 39000,
                'is_active' => true,
                'priority' => 1,
                'notes' => 'Hemat Rp 39.000 untuk pembelian 1 Kaos Boxy dan 1 Celana Chino sekaligus.',
                'created_by' => $admin?->id,
                'starts_at' => now()->subDays(10),
                'ends_at' => now()->addDays(60),
            ]);

            PricingRuleBundleItem::create([
                'pricing_rule_id' => $bundleRule->id,
                'product_id' => $tshirtParent->id,
                'quantity' => 1,
                'sort_order' => 0,
            ]);

            PricingRuleBundleItem::create([
                'pricing_rule_id' => $bundleRule->id,
                'product_id' => $chinoParent->id,
                'quantity' => 1,
                'sort_order' => 1,
            ]);
        }

        if ($tshirtParent && Schema::hasTable('pricing_rule_qty_breaks')) {
            // Qty Break: Grosir Kaos Boxy
            $qtyRule = PricingRule::create([
                'name' => 'Grosir Kaos Boxy 24s (Beli 3+ Pcs)',
                'kind' => 'qty_breaks',
                'target_type' => 'product',
                'product_id' => $tshirtParent->id,
                'customer_scope' => 'all',
                'discount_type' => 'fixed_amount',
                'discount_value' => 15000,
                'is_active' => true,
                'priority' => 2,
                'notes' => 'Potongan Rp 15.000 per kaos untuk pembelian minimal 3 pcs.',
                'created_by' => $admin?->id,
                'starts_at' => now()->subDays(10),
                'ends_at' => now()->addDays(90),
            ]);

            PricingRuleQtyBreak::create([
                'pricing_rule_id' => $qtyRule->id,
                'min_qty' => 3,
                'discount_type' => 'fixed_amount',
                'discount_value' => 15000,
                'sort_order' => 0,
            ]);

            PricingRuleQtyBreak::create([
                'pricing_rule_id' => $qtyRule->id,
                'min_qty' => 6,
                'discount_type' => 'fixed_amount',
                'discount_value' => 25000,
                'sort_order' => 1,
            ]);
        }
    }

    /**
     * Seed E-Catalog Promo Banners.
     */
    private function seedPromoBanners(Collection $categories): void
    {
        if (! Schema::hasTable('promo_banners')) {
            return;
        }

        $banners = [
            [
                'title' => 'Spring/Summer 2026: The New Casual',
                'subtitle' => 'Temukan cutting boxy oversize dan material heavyweight cotton 24s berkelas.',
                'link_url' => '/katalog?category='.($categories->get('Kaos & T-Shirt')?->id ?? ''),
                'category_id' => $categories->get('Kaos & T-Shirt')?->id,
                'image_url' => 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&h=600&fit=crop',
                'sort_order' => 1,
                'is_active' => true,
            ],
            [
                'title' => 'Timeless Denim & Essential Chinos',
                'subtitle' => 'Upgrade rotasi bawahan Anda dengan kenyamanan stretch twill dan selvedge accent.',
                'link_url' => '/katalog?category='.($categories->get('Celana Denim & Jeans')?->id ?? ''),
                'category_id' => $categories->get('Celana Denim & Jeans')?->id,
                'image_url' => 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1400&h=600&fit=crop',
                'sort_order' => 2,
                'is_active' => true,
            ],
            [
                'title' => 'Artisan Footwear Collection',
                'subtitle' => 'Sepatu kanvas vulkanisir oven ganda dengan insole memory foam ekstra empuk.',
                'link_url' => '/katalog?category='.($categories->get('Sepatu & Sneakers')?->id ?? ''),
                'category_id' => $categories->get('Sepatu & Sneakers')?->id,
                'image_url' => 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=1400&h=600&fit=crop',
                'sort_order' => 3,
                'is_active' => true,
            ],
        ];

        foreach ($banners as $idx => $b) {
            $image = $this->downloadImage(
                $b['image_url'],
                'banners',
                'banner-hero-'.($idx + 1),
                $b['title'],
                '#111827'
            );

            PromoBanner::create([
                'title' => $b['title'],
                'subtitle' => $b['subtitle'],
                'image' => $image,
                'link_url' => $b['link_url'],
                'category_id' => $b['category_id'],
                'sort_order' => $b['sort_order'],
                'is_active' => $b['is_active'],
            ]);
        }
    }

    /**
     * Seed historical fashion transactions, details, and profits.
     */
    private function seedTransactions(Collection $customers, Collection $products): void
    {
        $cashier = User::where('email', 'kasir@mail.com')->first()
            ?? User::where('email', 'admin@mail.com')->first()
            ?? User::first();

        if (! $cashier) {
            return;
        }

        $defaultWarehouse = Warehouse::active()->orderBy('sort_order')->orderBy('code')->first();

        $blueprints = [
            [
                'customer' => 'Salsa Bella',
                'discount' => 20000,
                'cash' => 500000,
                'days_ago' => 5,
                'items' => [
                    ['barcode' => 'TSH-OVR-BLK-M', 'qty' => 1],
                    ['barcode' => 'PNT-CHN-SND-32', 'qty' => 1],
                    ['barcode' => 'APRL-ACC-001', 'qty' => 1],
                ],
            ],
            [
                'customer' => 'Dimas Ramadhan',
                'discount' => 15000,
                'cash' => 700000,
                'days_ago' => 4,
                'items' => [
                    ['barcode' => 'DNM-RAW-IND-32', 'qty' => 1],
                    ['barcode' => 'TSH-OVR-WHT-L', 'qty' => 1],
                    ['barcode' => 'APRL-ACC-003', 'qty' => 1],
                ],
            ],
            [
                'customer' => 'Clara Natasha',
                'discount' => 0,
                'cash' => 600000,
                'days_ago' => 3,
                'items' => [
                    ['barcode' => 'SHT-OXF-WHT-M', 'qty' => 1],
                    ['barcode' => 'HD-PLV-CHR-M', 'qty' => 1],
                ],
            ],
            [
                'customer' => 'Aldi Pratama',
                'discount' => 0,
                'cash' => 400000,
                'days_ago' => 2,
                'items' => [
                    ['barcode' => 'SH-SNK-WHT-42', 'qty' => 1],
                    ['barcode' => 'APRL-ACC-002', 'qty' => 1],
                ],
            ],
            [
                'customer' => 'Bunga Amelia',
                'discount' => 25000,
                'cash' => 450000,
                'days_ago' => 1,
                'items' => [
                    ['barcode' => 'TSH-OVR-SGE-M', 'qty' => 2],
                    ['barcode' => 'APRL-ACC-001', 'qty' => 1],
                ],
            ],
            [
                'customer' => null, // Walk-in anonymous guest
                'discount' => 0,
                'cash' => 150000,
                'days_ago' => 0,
                'items' => [
                    ['barcode' => 'TSH-OVR-BLK-L', 'qty' => 1],
                ],
            ],
        ];

        DB::transaction(function () use ($blueprints, $customers, $products, $cashier, $defaultWarehouse) {
            foreach ($blueprints as $blueprint) {
                $customer = $blueprint['customer']
                    ? $customers->get($blueprint['customer'])
                    : null;

                $items = collect($blueprint['items'])
                    ->map(function ($item) use ($products) {
                        $product = $products->get($item['barcode']);

                        if (! $product) {
                            return null;
                        }

                        $lineTotal = $product->sell_price * $item['qty'];

                        return [
                            'product' => $product,
                            'qty' => $item['qty'],
                            'line_total' => $lineTotal,
                            'profit' => ($product->sell_price - $product->buy_price) * $item['qty'],
                        ];
                    })
                    ->filter();

                if ($items->isEmpty()) {
                    continue;
                }

                $discount = max(0, $blueprint['discount']);
                $gross = $items->sum('line_total');
                $grandTotal = max(0, $gross - $discount);
                $cashPaid = max($grandTotal, $blueprint['cash']);
                $change = $cashPaid - $grandTotal;
                $timestamp = now()->subDays($blueprint['days_ago'] ?? 0)->setTime(11 + rand(0, 7), rand(0, 59));

                $transaction = Transaction::create([
                    'cashier_id' => $cashier->id,
                    'customer_id' => $customer?->id,
                    'warehouse_id' => $defaultWarehouse?->id,
                    'invoice' => 'TRX-'.$timestamp->format('Ymd').'-'.Str::upper(Str::random(4)),
                    'cash' => $cashPaid,
                    'change' => $change,
                    'discount' => $discount,
                    'grand_total' => $grandTotal,
                    'payment_method' => 'cash',
                    'payment_status' => 'paid',
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ]);

                foreach ($items as $item) {
                    $transaction->details()->create([
                        'product_id' => $item['product']->id,
                        'qty' => $item['qty'],
                        'price' => $item['line_total'],
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);

                    $transaction->profits()->create([
                        'total' => $item['profit'],
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);

                    if ($defaultWarehouse) {
                        ProductWarehouse::where([
                            'product_id' => $item['product']->id,
                            'warehouse_id' => $defaultWarehouse->id,
                        ])->decrement('stock', $item['qty']);
                    }
                }
            }
        });
    }

    /**
     * Seed receivables and their payments.
     */
    private function seedReceivables(Collection $customers): void
    {
        $cashier = User::where('email', 'kasir@mail.com')->first()
            ?? User::where('email', 'admin@mail.com')->first()
            ?? User::first();

        $sourceTransactions = Transaction::with('customer')
            ->whereNotNull('customer_id')
            ->take(3)
            ->get();

        foreach ($sourceTransactions as $index => $transaction) {
            $paid = match ($index) {
                0 => (float) ($transaction->grand_total * 0.5),
                1 => (float) ($transaction->grand_total * 0.8),
                default => 0,
            };

            $status = $paid <= 0
                ? 'unpaid'
                : ($paid >= $transaction->grand_total ? 'paid' : 'partial');

            $receivable = Receivable::create([
                'customer_id' => $transaction->customer_id,
                'transaction_id' => $transaction->id,
                'invoice' => 'RCV-'.$transaction->invoice,
                'total' => $transaction->grand_total,
                'paid' => $paid,
                'due_date' => now()->addDays(($index + 1) * 7)->toDateString(),
                'status' => $status,
                'note' => 'Piutang pembelian busana invoice '.$transaction->invoice,
            ]);

            if ($paid > 0) {
                ReceivablePayment::create([
                    'receivable_id' => $receivable->id,
                    'paid_at' => now()->subDays(2 + $index)->toDateString(),
                    'amount' => $paid,
                    'method' => 'cash',
                    'user_id' => $cashier?->id,
                    'note' => 'Pembayaran awal piutang pesanan busana',
                ]);
            }

            $transaction->update([
                'payment_method' => 'credit',
                'payment_status' => $status === 'paid' ? 'paid' : 'unpaid',
                'cash' => (int) $paid,
                'change' => 0,
            ]);
        }

        $manualReceivables = [
            [
                'customer' => 'Gina Putri',
                'invoice' => 'RCV-BOUTIQUE-001',
                'total' => 850000,
                'paid' => 350000,
                'due_date' => now()->addDays(14)->toDateString(),
                'status' => 'partial',
                'note' => 'Piutang konsinyasi batch pakaian showroom',
            ],
            [
                'customer' => 'Hendra Wijaya',
                'invoice' => 'RCV-BOUTIQUE-002',
                'total' => 1250000,
                'paid' => 0,
                'due_date' => now()->subDays(4)->toDateString(),
                'status' => 'overdue',
                'note' => 'Pesanan khusus seragam jas kantor jatuh tempo',
            ],
        ];

        foreach ($manualReceivables as $item) {
            $customer = $customers->get($item['customer']);

            if (! $customer) {
                continue;
            }

            $receivable = Receivable::create([
                'customer_id' => $customer->id,
                'invoice' => $item['invoice'],
                'total' => $item['total'],
                'paid' => $item['paid'],
                'due_date' => $item['due_date'],
                'status' => $item['status'],
                'note' => $item['note'],
            ]);

            if ($item['paid'] > 0) {
                ReceivablePayment::create([
                    'receivable_id' => $receivable->id,
                    'paid_at' => now()->subDays(1)->toDateString(),
                    'amount' => $item['paid'],
                    'method' => 'bank_transfer',
                    'user_id' => $cashier?->id,
                    'note' => 'Pelunasan bertahap pesanan butik',
                ]);
            }
        }
    }

    /**
     * Seed fashion payables to garment & textile suppliers.
     */
    private function seedPayables(Collection $suppliers): void
    {
        $admin = User::where('email', 'admin@mail.com')->first() ?? User::first();

        $blueprints = [
            [
                'supplier' => 'PT Garment Bandung Textiles',
                'document_number' => 'PYB-TX-001',
                'vendor_invoice_number' => 'INV/GBT/2026/0801',
                'total' => 13500000,
                'paid' => 6000000,
                'due_date' => now()->addDays(20)->toDateString(),
                'status' => 'partial',
                'note' => 'Pengadaan 200 pcs bahan kain kaos combed 24s',
            ],
            [
                'supplier' => 'CV Denim Mill Nusantara',
                'document_number' => 'PYB-TX-002',
                'vendor_invoice_number' => 'INV/DMN/2026/0802',
                'total' => 9200000,
                'paid' => 0,
                'due_date' => now()->addDays(30)->toDateString(),
                'status' => 'unpaid',
                'note' => 'Pengadaan 50 roll denim selvedge accent 14oz',
            ],
            [
                'supplier' => 'Bengkel Artisan Footwear Cibaduyut',
                'document_number' => 'PYB-TX-003',
                'vendor_invoice_number' => 'INV/BAF/2026/0803',
                'total' => 4800000,
                'paid' => 4800000,
                'due_date' => now()->subDays(3)->toDateString(),
                'status' => 'paid',
                'note' => 'Pelunasan batch sepatu vulcanized sneakers',
            ],
            [
                'supplier' => 'UD Label & Aksesoris Mode',
                'document_number' => 'PYB-TX-004',
                'vendor_invoice_number' => 'INV/LAM/2026/0804',
                'total' => 2400000,
                'paid' => 500000,
                'due_date' => now()->subDays(6)->toDateString(),
                'status' => 'overdue',
                'note' => 'Pemesanan woven label dan hangtag barcode',
            ],
        ];

        foreach ($blueprints as $item) {
            $supplier = $suppliers->get($item['supplier']);

            if (! $supplier) {
                continue;
            }

            $payable = Payable::create([
                'supplier_id' => $supplier->id,
                'document_number' => $item['document_number'],
                'vendor_invoice_number' => $item['vendor_invoice_number'] ?? null,
                'total' => $item['total'],
                'paid' => $item['paid'],
                'due_date' => $item['due_date'],
                'status' => $item['status'],
                'note' => $item['note'],
            ]);

            if ($item['paid'] > 0) {
                PayablePayment::create([
                    'payable_id' => $payable->id,
                    'paid_at' => now()->subDays(4)->toDateString(),
                    'amount' => $item['paid'],
                    'method' => 'bank_transfer',
                    'user_id' => $admin?->id,
                    'note' => 'Pembayaran tagihan termin konveksi',
                ]);
            }
        }
    }
}
