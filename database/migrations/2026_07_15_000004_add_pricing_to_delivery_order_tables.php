<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The document is still called "Delivery Order" — this migration only
     * adds the pricing columns needed to format it like an invoice
     * (unit price / amount per line, subtotal, VAT, total amount due).
     */
    public function up(): void
    {
        Schema::table('delivery_order_items', function (Blueprint $table) {
            $table->decimal('unit_price', 14, 4)->default(0)->after('quantity');
            $table->decimal('amount', 16, 2)->default(0)->after('unit_price');
        });

        Schema::table('delivery_orders', function (Blueprint $table) {
            $table->string('currency', 3)->default('PHP')->after('status');
            $table->decimal('subtotal', 16, 2)->default(0)->after('currency');
            $table->decimal('vat_rate', 5, 4)->default(0.12)->after('subtotal');
            $table->decimal('vat_amount', 16, 2)->default(0)->after('vat_rate');
            $table->decimal('total_amount', 16, 2)->default(0)->after('vat_amount');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_order_items', function (Blueprint $table) {
            $table->dropColumn(['unit_price', 'amount']);
        });

        Schema::table('delivery_orders', function (Blueprint $table) {
            $table->dropColumn(['currency', 'subtotal', 'vat_rate', 'vat_amount', 'total_amount']);
        });
    }
};
