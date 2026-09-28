# 📘 Project Setup Guide

A quickstart guide to install and run the application locally.

---

## 📦 Install Dependencies

### 1. Composer

```bash
composer install
```

### 2. NPM

```bash
npm install
```

---

## ⚙️ Environment Setup

Copy the example environment file and set the required variables (duplicate and rename or by terminal):

```bash
cp .env.example .env
```

Then generate the application key:

```bash
php artisan key:generate
```

---

## 🗃️ Database Migration

Run migrations with seeding to create required tables and seed system data:

```bash
php artisan migrate --seed
```

This will:

- Create the `system_status` table
- Seed the system status (online/maintenance)
- Set up HRIS configuration

---

## ✅ Done

You’re now ready to start the application!

```bash
composer run dev
```

---
