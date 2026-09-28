<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telford_out', function (Blueprint $table) {
            $table->id();
            $table->string('Part_Name', 100)->nullable();
            $table->string('Lot_Id', 50)->nullable();
            $table->date('Out_Date')->nullable();
            $table->integer('Qty')->nullable();
            $table->integer('Residual')->nullable();
            $table->string('Test_Part', 100)->nullable();
            $table->string('Test_Lot_Id', 50)->nullable();
            $table->string('Focus_Group', 50)->nullable();
            $table->string('Package', 50)->nullable();
            $table->string('Process_Site', 50)->nullable();
            $table->string('Test_Site', 50)->nullable();
            $table->integer('Tray')->nullable();
            $table->integer('Bulk')->nullable();
            $table->date('Date_Loaded')->nullable();
            $table->string('Process_Group', 50)->nullable();
            $table->string('Ramp_Time', 50)->nullable();
            $table->timestamps();

            // unique key on Part_Name + Lot_Id
            $table->unique(['Part_Name', 'Lot_Id'], 'uq_part_lot');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telford_out');
    }
};
