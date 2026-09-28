<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PackageListController extends Controller
{
    public function search(Request $request)
    {
        $request->validate([

            'partname' => 'required',
        ]);

        $data = DB::connection('qdn_db')
            ->table('package_list')
            ->where('devicename', $request->partname)
            ->first();

        if (! $data) {
            return response()->json([
                'message' => 'Lot / Part not found',
            ], 404);
        }

        return response()->json([
            'device_name' => $data->devicename,
            'package' => $data->lead_count . $data->package_type,
            'charging' => $data->allocation,
        ]);
    }
}
