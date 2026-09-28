<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loadingplan', function (Blueprint $table) {
            $table->id();
            $table->string('Plant', 50)->nullable();
            $table->string('Part_Name', 100)->nullable();
            $table->string('Lead_Count', 20)->nullable();
            $table->string('Package_Name', 100)->nullable();
            $table->string('Lot_Id', 100)->nullable()->index();
            $table->string('Station', 100)->nullable()->index();
            $table->string('Qty', 30)->nullable();
            $table->string('Lot_Type', 50)->nullable();
            $table->string('Prod_Area', 20)->nullable();
            $table->string('Lot_Status', 50)->nullable();
            $table->string('Date_Loaded', 50)->nullable();
            $table->string('Start_Time', 50)->nullable();
            $table->string('Part_Type', 50)->nullable();
            $table->string('Part_Class', 50)->nullable();
            $table->string('Date_Code', 50)->nullable();
            $table->string('Focus_Group', 50)->nullable()->index();
            $table->string('Process_Group', 50)->nullable();
            $table->string('Bulk', 20)->nullable();
            $table->string('Reqd_Time', 50)->nullable();
            $table->string('Lot_Entry_Time', 50)->nullable();
            $table->string('Stage', 50)->nullable();
            $table->string('Stage_Start_Time', 50)->nullable();
            $table->string('CCD', 50)->nullable();
            $table->string('Stage_Run_Days', 30)->nullable();
            $table->string('Lot_Entry_Time_Days', 30)->nullable();
            $table->string('Tray', 50)->nullable();
            $table->string('Backend_Leadtime', 30)->nullable();
            $table->string('OSL_Days', 30)->nullable();
            $table->string('BE_Group', 50)->nullable();
            $table->string('Strategy_Code', 50)->nullable();
            $table->string('CR3', 50)->nullable();
            $table->string('BE_Starttime', 50)->nullable();
            $table->string('BE_OSL_Days', 30)->nullable();
            $table->string('Body_Size', 50)->nullable();
            $table->string('Auto_Part', 20)->nullable();
            $table->string('Ramp_Time', 50)->nullable();
            $table->string('End_Customer', 100)->nullable();
            $table->string('Bake', 20)->nullable();
            $table->string('Bake_Count', 20)->nullable();
            $table->string('Test_Lot_Id', 100)->nullable();
            $table->string('Stock_Position', 50)->nullable();
            $table->string('Assy_Site', 50)->nullable();
            $table->string('Bake_Time_Temp', 50)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loadingplan');
    }
};
