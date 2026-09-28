<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Telford Out — TELFORD Production Operations</title>
    @viteReactRefresh
    @vite(['resources/js/telford-out-app.jsx'])
</head>
<body>
    <div id="telford-out-root"></div>
</body>
</html>