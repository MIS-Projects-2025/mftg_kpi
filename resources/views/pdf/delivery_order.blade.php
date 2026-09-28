<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $deliveryOrder->do_no }}</title>
    <style>
        @page { margin: 28px 32px; }
        body {
            font-family: "DejaVu Sans", sans-serif;
            font-size: 12px;
            color: #1a1f26;
        }
        .header {
            display: table;
            width: 100%;
            margin-bottom: 18px;
        }
        .header .company {
            display: table-cell;
            vertical-align: top;
            width: 60%;
        }
        .header .doc-title {
            display: table-cell;
            vertical-align: top;
            width: 40%;
            text-align: right;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin: 0 0 4px 0;
        }
        .company-address {
            color: #4a5261;
            line-height: 1.4;
        }
        .doc-title h1 {
            font-size: 20px;
            margin: 0 0 4px 0;
            letter-spacing: 0.06em;
        }
        .doc-title .do-no {
            font-size: 13px;
            font-weight: bold;
        }
        .meta {
            display: table;
            width: 100%;
            margin: 16px 0;
            border-top: 1px solid #d7dbe0;
            border-bottom: 1px solid #d7dbe0;
            padding: 10px 0;
        }
        .meta .col {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 12px;
        }
        .meta .label {
            color: #4a5261;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .meta .value {
            font-weight: bold;
            margin-bottom: 8px;
        }
        table.items {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
        }
        table.items th {
            background: #1a1f26;
            color: #fff;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 8px 6px;
            text-align: left;
        }
        table.items td {
            padding: 7px 6px;
            border-bottom: 1px solid #e2e5e9;
        }
        table.items tr:nth-child(even) td {
            background: #f6f7f8;
        }
        table.items td.num,
        table.items th.num {
            text-align: right;
        }
        .totals {
            width: 100%;
            margin-top: 6px;
            border-top: 2px solid #1a1f26;
            padding-top: 6px;
            text-align: right;
            font-weight: bold;
        }
        .remarks {
            margin-top: 18px;
        }
        .remarks .label {
            color: #4a5261;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            margin-bottom: 4px;
        }
        .signatures {
            display: table;
            width: 100%;
            margin-top: 50px;
        }
        .signatures .box {
            display: table-cell;
            width: 33.33%;
            text-align: center;
        }
        .signatures .line {
            border-top: 1px solid #1a1f26;
            margin: 40px 16px 6px 16px;
        }
        .signatures .role {
            font-size: 10px;
            color: #4a5261;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .footer-note {
            margin-top: 24px;
            font-size: 9px;
            color: #8a92a1;
            text-align: center;
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="company">
            <p class="company-name">{{ config('app.company_name', 'Your Company Name') }}</p>
            <p class="company-address">
                {{ config('app.company_address', 'Company address line 1, City, Country') }}<br>
                {{ config('app.company_phone', 'Tel: +00 0000 0000') }}
            </p>
        </div>
        <div class="doc-title">
            <h1>DELIVERY ORDER</h1>
            <div class="do-no">{{ $deliveryOrder->do_no }}</div>
        </div>
    </div>

    <div class="meta">
        <div class="col">
            <div class="label">Deliver To</div>
            <div class="value">{{ $deliveryOrder->customer_name }}</div>
            @if($deliveryOrder->customer_address)
                <div>{{ $deliveryOrder->customer_address }}</div>
            @endif
        </div>
        <div class="col">
            <div class="label">Delivery Date</div>
            <div class="value">{{ $deliveryOrder->delivery_date->format('d M Y') }}</div>

            @if($deliveryOrder->vehicle_no || $deliveryOrder->driver_name)
                <div class="label">Vehicle / Driver</div>
                <div class="value">
                    {{ $deliveryOrder->vehicle_no ?? '—' }} / {{ $deliveryOrder->driver_name ?? '—' }}
                </div>
            @endif
        </div>
    </div>

    <table class="items">
        <thead>
            <tr>
                <th style="width: 6%">No.</th>
                <th style="width: 22%">Lot No</th>
                <th style="width: 22%">Device No</th>
                <th style="width: 22%">Packaging</th>
                <th style="width: 13%" class="num">Qty</th>
                <th style="width: 15%">Remarks</th>
            </tr>
        </thead>
        <tbody>
            @foreach($deliveryOrder->items as $index => $item)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $item->lot_no }}</td>
                    <td>{{ $item->device_no }}</td>
                    <td>{{ $item->packaging }}</td>
                    <td class="num">{{ number_format($item->qty) }}</td>
                    <td>{{ $item->remarks }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        Total Qty: {{ number_format($deliveryOrder->items->sum('qty')) }}
    </div>

    @if($deliveryOrder->remarks)
        <div class="remarks">
            <div class="label">Remarks</div>
            <div>{{ $deliveryOrder->remarks }}</div>
        </div>
    @endif

    <div class="signatures">
        <div class="box">
            <div class="line"></div>
            <div class="role">Prepared By{{ $deliveryOrder->preparer ? ' — ' . $deliveryOrder->preparer->name : '' }}</div>
        </div>
        <div class="box">
            <div class="line"></div>
            <div class="role">Checked By</div>
        </div>
        <div class="box">
            <div class="line"></div>
            <div class="role">Received By</div>
        </div>
    </div>

    <div class="footer-note">
        Printed {{ now()->format('d M Y, H:i') }} &middot; {{ $deliveryOrder->do_no }}
    </div>

</body>
</html>
