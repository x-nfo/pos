<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $fields = [
        'midtrans_client_key',
        'xendit_public_key',
    ];

    public function up(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->text('midtrans_client_key')->nullable()->change();
            $table->text('xendit_public_key')->nullable()->change();
        });

        DB::table('payment_settings')
            ->select(['id', ...$this->fields])
            ->orderBy('id')
            ->get()
            ->each(function ($setting) {
                $updates = [];

                foreach ($this->fields as $field) {
                    $value = $setting->{$field};

                    if (blank($value) || $this->isEncrypted($value)) {
                        continue;
                    }

                    $updates[$field] = Crypt::encryptString($value);
                }

                if ($updates !== []) {
                    DB::table('payment_settings')->where('id', $setting->id)->update($updates);
                }
            });
    }

    public function down(): void
    {
        DB::table('payment_settings')
            ->select(['id', ...$this->fields])
            ->orderBy('id')
            ->get()
            ->each(function ($setting) {
                $updates = [];

                foreach ($this->fields as $field) {
                    $value = $setting->{$field};

                    if (blank($value) || ! $this->isEncrypted($value)) {
                        continue;
                    }

                    $updates[$field] = Crypt::decryptString($value);
                }

                if ($updates !== []) {
                    DB::table('payment_settings')->where('id', $setting->id)->update($updates);
                }
            });

        Schema::table('payment_settings', function (Blueprint $table) {
            $table->string('midtrans_client_key')->nullable()->change();
            $table->string('xendit_public_key')->nullable()->change();
        });
    }

    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
};
