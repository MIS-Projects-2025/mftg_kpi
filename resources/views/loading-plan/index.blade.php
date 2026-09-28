<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Loading Plan — TELFORD</title>
    @viteReactRefresh
    @vite(['resources/js/loading-plan-app.jsx'])
</head>
<body><div id="loading-plan-root"></div></body>
</html>