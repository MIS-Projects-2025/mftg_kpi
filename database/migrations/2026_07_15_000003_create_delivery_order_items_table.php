<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fglist_data_source_id')->nullable()->constrained()->nullOnDelete();

            // snapshot of the lot data at the time the DO was created,
            // so the DO stays accurate even if the source row changes later
            $table->string('rto_non_rto', 20);
            $table->string('destination', 50);
            $table->string('focus_group', 30);
            $table->string('lotno', 50);
            $table->unsignedInteger('quantity');
            $table->string('partname', 100);
            $table->string('datecode', 50)->nullable();
            $table->unsignedInteger('lead')->nullable();
            $table->string('package', 50)->nullable();
            $table->unsignedInteger('total_box')->default(1);
            $table->string('lot_type', 10)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_order_items');
    }
};
