<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('f3_outs', function (Blueprint $table) {
            $table->id();

            /* ── Common columns — same shape as telford_out ──────────
               These are what the Team Dashboard will read from later,
               so F3 output can be queried the same way as Telford's. */
            $table->string('Part_Name')->nullable();
            $table->string('Lot_Id')->nullable();
            $table->dateTime('Out_Date')->nullable();
            $table->integer('Qty')->nullable();
            $table->string('Package')->nullable();
            $table->dateTime('Date_Loaded')->nullable();

            /* ── Raw COMETS export columns — kept for reference/audit ── */
            $table->integer('year')->nullable();
            $table->integer('quarter')->nullable();
            $table->integer('workweek')->nullable();
            $table->string('crd')->nullable();
            $table->string('tester_type')->nullable();
            $table->string('tester_config')->nullable();
            $table->string('test_group')->nullable();
            $table->string('primary_tester')->nullable();
            $table->string('last_used_tester_id')->nullable();
            $table->string('handler_id')->nullable();
            $table->string('package_type')->nullable();
            $table->string('lot_type')->nullable();
            $table->string('die_type')->nullable();
            $table->string('opcode')->nullable();
            $table->string('oper_type')->nullable();
            $table->string('division')->nullable();
            $table->string('building')->nullable();
            $table->string('tester_category')->nullable();
            $table->string('test_system')->nullable(); // source column: SYSTEM
            $table->string('process')->nullable();

            $table->timestamps();

            // Dedupe key: a lot can be moved out more than once (each Sheet2
            // row is a discrete COMETS move-out event), so Lot_Id alone (or
            // Lot_Id+Part_Name, as telford_out uses) isn't safe here — a
            // second legitimate output for the same lot would overwrite the
            // first. Lot_Id+Out_Date uniquely identifies one move-out event.
            $table->unique(['Lot_Id', 'Out_Date'], 'f3_outs_lot_outdate_unique');
            $table->index('Out_Date');
            $table->index('Part_Name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('f3_outs');
    }
};
