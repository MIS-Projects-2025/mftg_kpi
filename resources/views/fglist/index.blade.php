<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>Finished Goods List — TELFORD Production Operations</title>

    @viteReactRefresh
    @vite('resources/js/fglist-app.jsx')
</head>

<body>
    <div id="fglist-root"></div>
</body>
</html>