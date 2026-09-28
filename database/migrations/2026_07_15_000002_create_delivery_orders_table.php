<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_orders', function (Blueprint $table) {
            $table->id();
            $table->string('do_no')->nullable();
            $table->unsignedBigInteger('transaction_id')->index();
            $table->date('order_date');
            $table->string('po_no')->nullable();
            $table->string('terms')->default('30 DAYS');

            $table->string('bill_to_name');
            $table->text('bill_to_address')->nullable();
            $table->string('attn_bill')->nullable();

            $table->string('ship_to_name');
            $table->text('ship_to_address')->nullable();
            $table->string('attn_ship')->nullable();

            $table->unsignedInteger('total_units')->default(0);
            $table->unsignedInteger('total_boxes')->default(0);

            $table->string('status')->default('draft'); // draft | issued
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_orders');
    }
};
