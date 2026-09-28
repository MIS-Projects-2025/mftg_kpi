<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Delivery Order Builder</title>

    @viteReactRefresh
    @vite('resources/js/app.jsx')
</head>
<body style="background:#e8e9ec; padding:24px;">
    <div id="delivery-order-root"></div>
</body>
</html>
