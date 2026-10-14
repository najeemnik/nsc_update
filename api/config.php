<?php
/**
 * NSC ERP & Construction Finance System
 * Shahhost Server Configuration (SSD Silver Package)
 * 
 * تمام مقادیر اتصال دیتابیس را طبق اطلاعاتی که در cPanel هاست ساختید تنظیم کنید.
 */

// جلوگیری از نمایش خطاهای حساس سرور برای کاربران (Security Hardening)
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// مشخصات اتصال دیتابیس MySQL هاست Shahhost
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'shahhost_nsc_db');     // نام دیتابیس در cPanel
define('DB_USER', getenv('DB_USER') ?: 'shahhost_nsc_user');   // نام یوزر دیتابیس
define('DB_PASS', getenv('DB_PASS') ?: 'YourStrongPassword2026!'); // رمز دیتابیس
define('DB_CHARSET', 'utf8mb4');

// کلید امضای توکن‌ها: از ENV، وگرنه کلید یکتای خودکار و ماندگار همین نصب
// (در api/.secrets/jwt_secret.key ذخیره می‌شود و هرگز کامیت نکنید)
if (!defined('JWT_SECRET_KEY')) {
    $envSecret = getenv('JWT_SECRET') ?: '';
    if ($envSecret !== '') {
        define('JWT_SECRET_KEY', $envSecret);
    } else {
        $secretDir = __DIR__ . '/.secrets';
        $secretFile = $secretDir . '/jwt_secret.key';
        $secret = '';
        if (is_file($secretFile)) {
            $secret = trim((string)@file_get_contents($secretFile));
        }
        if (strlen($secret) < 32) {
            if (!is_dir($secretDir)) { @mkdir($secretDir, 0700, true); }
            $secret = bin2hex(random_bytes(32));
            @file_put_contents($secretFile, $secret, LOCK_EX);
            @chmod($secretFile, 0600);
        }
        define('JWT_SECRET_KEY', $secret);
    }
}

// تنظیمات پوشه آپلودها (اسناد، بل‌ها، عکس‌ها)
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024); // حداکثر ۱۰ مگابایت برای هر سند
define('ALLOWED_FILE_EXTENSIONS', ['jpg', 'jpeg', 'png', 'pdf', 'webp']);

// تنظیمات امنیتی هدرها و CORS
function sendSecurityHeaders() {
    // جلوگیری از کلیک‌جکینگ، XSS و Sniffing
    header("X-Content-Type-Options: nosniff");
    header("X-Frame-Options: SAMEORIGIN");
    header("X-XSS-Protection: 1; mode=block");
    header("Content-Type: application/json; charset=UTF-8");
    
    // هدرهای CORS — فقط برای آدرس‌های مجاز در ALLOWED_ORIGINS (پیش‌فرض: بسته)
    // درخواست‌های same-origin بدون این هدرها هم کار می‌کنند.
    $allowedOrigins = array_filter(array_map('trim', explode(',', getenv('ALLOWED_ORIGINS') ?: '')));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header("Access-Control-Allow-Origin: " . $origin);
        header("Access-Control-Allow-Credentials: true");
        header("Vary: Origin");
    }
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Office7-Gate-Key");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}
