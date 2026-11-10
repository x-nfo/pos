<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\SizeChart;
use Illuminate\Database\Seeder;

class SizeChartSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Standar Atasan / Kaos / Kemeja
        $topsChart = SizeChart::updateOrCreate(
            ['code' => 'TSHIRT-REG-STD'],
            [
                'name' => 'Standar Kaos / Atasan Pria & Wanita (Regular Fit)',
                'apparel_type' => 'tops',
                'default_unit' => 'cm',
                'columns' => [
                    ['key' => 'ld', 'label' => 'Lingkar Dada (LD)'],
                    ['key' => 'pb', 'label' => 'Panjang (PB)'],
                    ['key' => 'lb', 'label' => 'Lebar Bahu'],
                ],
                'measurements' => [
                    ['size' => 'S', 'ld' => 96, 'pb' => 68, 'lb' => 42],
                    ['size' => 'M', 'ld' => 100, 'pb' => 70, 'lb' => 44],
                    ['size' => 'L', 'ld' => 104, 'pb' => 72, 'lb' => 46],
                    ['size' => 'XL', 'ld' => 108, 'pb' => 74, 'lb' => 48],
                    ['size' => 'XXL', 'ld' => 114, 'pb' => 76, 'lb' => 50],
                ],
                'fit_rules' => [
                    ['size' => 'S', 'min_height' => 150, 'max_height' => 165, 'min_weight' => 45, 'max_weight' => 55],
                    ['size' => 'M', 'min_height' => 160, 'max_height' => 172, 'min_weight' => 55, 'max_weight' => 65],
                    ['size' => 'L', 'min_height' => 168, 'max_height' => 178, 'min_weight' => 65, 'max_weight' => 75],
                    ['size' => 'XL', 'min_height' => 172, 'max_height' => 183, 'min_weight' => 75, 'max_weight' => 85],
                    ['size' => 'XXL', 'min_height' => 175, 'max_height' => 192, 'min_weight' => 85, 'max_weight' => 98],
                ],
                'how_to_measure_notes' => 'Toleransi jahitan konveksi massal ±1 - 2 cm. Ukur lingkar dada mendatar tepat di bawah ketiak.',
                'is_active' => true,
            ]
        );

        // 2. Standar Celana / Bawahan
        $bottomsChart = SizeChart::updateOrCreate(
            ['code' => 'PANTS-STD'],
            [
                'name' => 'Standar Celana / Bawahan (Chino & Denim)',
                'apparel_type' => 'bottoms',
                'default_unit' => 'cm',
                'columns' => [
                    ['key' => 'lp', 'label' => 'Lingkar Pinggang (LP)'],
                    ['key' => 'paha', 'label' => 'Lingkar Paha'],
                    ['key' => 'pj', 'label' => 'Panjang Celana'],
                ],
                'measurements' => [
                    ['size' => '28 (S)', 'lp' => 74, 'paha' => 56, 'pj' => 100],
                    ['size' => '30 (M)', 'lp' => 78, 'paha' => 58, 'pj' => 100],
                    ['size' => '32 (L)', 'lp' => 82, 'paha' => 60, 'pj' => 102],
                    ['size' => '34 (XL)', 'lp' => 86, 'paha' => 62, 'pj' => 102],
                    ['size' => '36 (XXL)', 'lp' => 92, 'paha' => 66, 'pj' => 104],
                ],
                'fit_rules' => [
                    ['size' => '28 (S)', 'min_height' => 150, 'max_height' => 168, 'min_weight' => 45, 'max_weight' => 52],
                    ['size' => '30 (M)', 'min_height' => 155, 'max_height' => 172, 'min_weight' => 53, 'max_weight' => 60],
                    ['size' => '32 (L)', 'min_height' => 165, 'max_height' => 178, 'min_weight' => 61, 'max_weight' => 70],
                    ['size' => '34 (XL)', 'min_height' => 170, 'max_height' => 182, 'min_weight' => 71, 'max_weight' => 80],
                    ['size' => '36 (XXL)', 'min_height' => 172, 'max_height' => 188, 'min_weight' => 81, 'max_weight' => 90],
                ],
                'how_to_measure_notes' => 'Ukur lingkar pinggang pas tepat di atas tulang pinggul. Bila ragu antara dua ukuran, pilih 1 ukuran lebih besar.',
                'is_active' => true,
            ]
        );

        // 3. Standar Sepatu EU
        $shoesChart = SizeChart::updateOrCreate(
            ['code' => 'SHOES-EU-STD'],
            [
                'name' => 'Standar Sepatu / Footwear EU',
                'apparel_type' => 'footwear',
                'default_unit' => 'cm',
                'columns' => [
                    ['key' => 'insole', 'label' => 'Panjang Insole'],
                    ['key' => 'foot', 'label' => 'Panjang Kaki Direkomendasikan'],
                ],
                'measurements' => [
                    ['size' => '39', 'insole' => 24.5, 'foot' => 24.0],
                    ['size' => '40', 'insole' => 25.0, 'foot' => 24.5],
                    ['size' => '41', 'insole' => 26.0, 'foot' => 25.5],
                    ['size' => '42', 'insole' => 26.5, 'foot' => 26.0],
                    ['size' => '43', 'insole' => 27.5, 'foot' => 27.0],
                    ['size' => '44', 'insole' => 28.0, 'foot' => 27.5],
                ],
                'fit_rules' => [],
                'how_to_measure_notes' => 'Letakkan tumit merapat ke dinding di atas selembar kertas, tandai ujung jari terpanjang, lalu ukur jaraknya dengan penggaris.',
                'is_active' => true,
            ]
        );

        // Hubungkan ke Kategori Fashion yang mungkin sudah ada
        Category::where('name', 'like', '%kaos%')
            ->orWhere('name', 'like', '%baju%')
            ->orWhere('name', 'like', '%pakaian%')
            ->orWhere('name', 'like', '%atasan%')
            ->whereNull('size_chart_id')
            ->update(['size_chart_id' => $topsChart->id]);

        Category::where('name', 'like', '%celana%')
            ->orWhere('name', 'like', '%bawahan%')
            ->orWhere('name', 'like', '%jeans%')
            ->whereNull('size_chart_id')
            ->update(['size_chart_id' => $bottomsChart->id]);

        Category::where('name', 'like', '%sepatu%')
            ->orWhere('name', 'like', '%footwear%')
            ->orWhere('name', 'like', '%sandal%')
            ->whereNull('size_chart_id')
            ->update(['size_chart_id' => $shoesChart->id]);
    }
}
