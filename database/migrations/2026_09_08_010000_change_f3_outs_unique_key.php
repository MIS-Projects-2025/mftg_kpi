<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('f3_outs', function (Blueprint $table) {
            $table->dropUnique('f3_outs_lot_outdate_unique');
            $table->unique('Lot_Id', 'f3_outs_lot_unique');
        });
    }

    public function down(): void
    {
        Schema::table('f3_outs', function (Blueprint $table) {
            $table->dropUnique('f3_outs_lot_unique');
            $table->unique(['Lot_Id', 'Out_Date'], 'f3_outs_lot_outdate_unique');
        });
    }
};
