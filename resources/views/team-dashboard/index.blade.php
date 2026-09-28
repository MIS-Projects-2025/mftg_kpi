<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Team Dashboard — TELFORD</title>
    @viteReactRefresh
    @vite(['resources/js/team-dashboard-app.jsx'])
</head>
<body><div id="team-dashboard-root"></div></body>
</html>