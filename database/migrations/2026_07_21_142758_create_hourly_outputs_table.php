<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('hourly_outputs', function (Blueprint $table) {
            $table->id();

            $table->string('lot_no');
            $table->string('partname');

            $table->string('device_name')->nullable();
            $table->string('package')->nullable();
            $table->string('charging')->nullable();

            $table->integer('good_qty')->default(0);
            $table->integer('reject_qty')->default(0);

            $table->string('operator_name')->nullable();
            $table->string('shift')->nullable();
            $table->string('hour', 10)->nullable()->after('shift');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hourly_outputs');
    }
};
