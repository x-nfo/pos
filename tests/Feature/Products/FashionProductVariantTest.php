<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FashionProductVariantTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_fashion_master_product_and_variants(): void
    {
        $category = Category::create([
            'name' => 'Kaos & T-Shirt',
            'image' => 'categories/tshirt.png',
            'description' => 'Kategori Pakaian Kaos',
        ]);

        // 1. Create Master Product (Artikel)
        $masterProduct = Product::create([
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt',
            'image' => 'products/oversized-tshirt.png',
            'barcode' => 'ART-OVS-001',
            'sku' => 'ART-OVS-001',
            'description' => 'Kaos Katun 24s dengan potongan oversized',
            'buy_price' => 50000,
            'sell_price' => 125000,
            'tax_rate' => 0,
            'has_variants' => true,
        ]);

        $this->assertTrue($masterProduct->isParent());
        $this->assertFalse($masterProduct->isVariant());
        $this->assertCount(0, $masterProduct->variants);

        // 2. Create Variant A: Hitam - M
        $variantBlackM = Product::create([
            'parent_id' => $masterProduct->id,
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt - Hitam M',
            'image' => 'products/oversized-black.png',
            'barcode' => 'OVS-BLK-M',
            'sku' => 'OVS-BLK-M',
            'description' => 'Varian Hitam M',
            'buy_price' => 50000,
            'sell_price' => 125000,
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Hitam',
                'color_hex' => '#000000',
                'size' => 'M',
            ],
        ]);

        // 3. Create Variant B: Sage Green - XL
        $variantSageXL = Product::create([
            'parent_id' => $masterProduct->id,
            'category_id' => $category->id,
            'title' => 'Oversized Heavyweight T-Shirt - Sage Green XL',
            'image' => 'products/oversized-sage.png',
            'barcode' => 'OVS-SGE-XL',
            'sku' => 'OVS-SGE-XL',
            'description' => 'Varian Sage Green XL',
            'buy_price' => 50000,
            'sell_price' => 135000, // Harga khusus ukuran besar
            'tax_rate' => 0,
            'has_variants' => false,
            'variant_attributes' => [
                'color_name' => 'Sage Green',
                'color_hex' => '#84a98c',
                'size' => 'XL',
            ],
        ]);

        // Assertions
        $this->assertTrue($variantBlackM->isVariant());
        $this->assertSame('Hitam - M', $variantBlackM->variant_label);
        $this->assertSame('Sage Green - XL', $variantSageXL->variant_label);
        $this->assertSame($masterProduct->id, $variantBlackM->parent->id);

        $freshMaster = $masterProduct->fresh();
        $this->assertCount(2, $freshMaster->variants);
        $this->assertSame('OVS-BLK-M', $freshMaster->variants->first()->barcode);
    }
}
