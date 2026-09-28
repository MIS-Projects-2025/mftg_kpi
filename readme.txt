C:\xampp\htdocs\FGLIST

resources
│
├── js
│   │
│   ├── app.jsx                 <-- Delivery Order React entry
│   ├── fglist-app.jsx          <-- FG List React entry
│   ├── hourly-app.jsx          <-- NEW Hourly Output React entry
│   ├── scan-app.jsx            <-- NEW Scan React entry
│   │
│   ├── Components
│   │   └── AppShell.jsx
│   │
│   └── Pages
│       ├── FGList.jsx
│       ├── HourlyOutput.jsx
│       └── Scan.jsx
│
└── views
    │
    ├── fglist
    │   └── index.blade.php
    │
    ├── delivery-orders
    │   └── builder.blade.php
    │
    ├── hourly
    │   └── index.blade.php      <-- NEW Blade loader
    │
    └── scan
        └── index.blade.php      <-- NEW Blade loader