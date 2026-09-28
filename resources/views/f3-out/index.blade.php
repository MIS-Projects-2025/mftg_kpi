<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>F3 Out</title>
    @viteReactRefresh
    @vite(['resources/js/f3-out-app.jsx'])
</head>
<body>
    <div id="f3-out-root"></div>
</body>
</html>