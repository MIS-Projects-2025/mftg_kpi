<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fglist_data_sources', function (Blueprint $table) {
            $table->unique(['transaction_id', 'lotno']);
        });
    }

    public function down(): void
    {
        Schema::table('fglist_data_sources', function (Blueprint $table) {
            $table->dropUnique(['transaction_id', 'lotno']);
        });
    }
};
