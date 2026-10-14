<?php
/**
 * NSC User Authentication API
 * Secure Login with Bcrypt and Token Generation
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

sendSecurityHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getConnection();

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: [];
    $action = $_GET['action'] ?? 'login';

    if ($action === 'login') {
        $username = trim($input['username'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($username) || empty($password)) {
            jsonResponse(false, null, 'لطفاً نام کاربری و رمز عبور را وارد نمایید.', 400);
        }

        // جستجوی کاربر با نام کاربری یا ایمیل
        $stmt = $db->prepare("
            SELECT * FROM users 
            WHERE (username = :u OR email = :u) 
            LIMIT 1
        ");
        $stmt->execute(['u' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(false, null, 'نام کاربری یا رمز عبور اشتباه است.', 401);
        }

        if ((int)$user['is_locked'] === 1) {
            jsonResponse(false, null, 'حساب کاربری شما توسط مدیر ارشد مسدود گردیده است.', 403);
        }

        // محدودیت تلاش ورود: حداکثر ۵ تلاش ناموفق در ۱۵ دقیقه برای هر نام کاربری
        $attemptKey = mb_strtolower($username, 'UTF-8');
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        try {
            $rlStmt = $db->prepare("SELECT COUNT(*) AS c FROM login_attempts WHERE identifier = :ident AND attempted_at > (NOW() - INTERVAL 15 MINUTE)");
            $rlStmt->execute(['ident' => $attemptKey]);
            $fails = (int)($rlStmt->fetch()['c'] ?? 0);
            if ($fails >= 5) {
                jsonResponse(false, null, 'به دلیل تلاش‌های ناموفق پی‌هم، ورود برای ۱۵ دقیقه قفل شد. لطفاً بعداً تلاش کنید.', 429);
            }
        } catch (Exception $e) { error_log('Rate-limit check failed: ' . $e->getMessage()); }

        // بررسی پسورد با الگوریتم امن bcrypt (بدون هیچ رمز پیش‌فرض یا میان‌بر تست)
        $passwordMatches = !empty($user['password_hash']) && password_verify($password, $user['password_hash']);

        if (!$passwordMatches) {
            try {
                $insStmt = $db->prepare("INSERT INTO login_attempts (identifier, ip_address) VALUES (:ident, :ip)");
                $insStmt->execute(['ident' => $attemptKey, 'ip' => substr($clientIp, 0, 45)]);
            } catch (Exception $e) { error_log('Rate-limit record failed: ' . $e->getMessage()); }
            logAudit($db, $user['id'], $user['name'], 'login', 'auth', null, 'تلاش ناموفق برای ورود به سیستم');
            jsonResponse(false, null, 'نام کاربری یا رمز عبور اشتباه است.', 401);
        }
        // ورود موفق: پاک‌سازی تلاش‌های ناموفق قبلی همین کاربر
        try {
            $clrStmt = $db->prepare("DELETE FROM login_attempts WHERE identifier = :ident");
            $clrStmt->execute(['ident' => $attemptKey]);
        } catch (Exception $e) { error_log('Rate-limit clear failed: ' . $e->getMessage()); }

        // به‌روزرسانی تاریخ آخرین ورود
        $now = date('Y-m-d H:i:s');
        $upStmt = $db->prepare("UPDATE users SET last_login_at = :now WHERE id = :id");
        $upStmt->execute(['now' => $now, 'id' => $user['id']]);

        // تولید توکن امنیتی
        $token = generateToken($user['id'], $user['role'], (int)$user['is_master'], (int)($user['token_version'] ?? 0));

        // ثبت در لاگ امنیتی
        logAudit($db, $user['id'], $user['name'], 'login', 'auth', $user['id'], 'ورود موفقانه به سامانه');

        // مخفی‌سازی پسورد هش شده در خروجی
        unset($user['password_hash']);

        jsonResponse(true, [
            'token' => $token,
            'expiresAt' => date('c', time() + (86400 * 30)),
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'username' => $user['username'],
                'email' => $user['email'],
                'role' => $user['role'],
                'phone' => $user['phone'],
                'companyName' => $user['company_name'],
                'companyAddress' => $user['company_address'],
                'isMasterSuperAdmin' => (bool)$user['is_master'],
                'ownerAdminId' => $user['owner_admin_id'],
                'subscriptionPlan' => $user['subscription_plan'],
                'subscriptionExpiresAt' => $user['subscription_expires_at'],
                'permissions' => json_decode($user['permissions_json'] ?? '{}', true),
                'customEnabledModules' => json_decode($user['allowed_modules_json'] ?? '{}', true),
                'allowedTabs' => json_decode($user['allowed_tabs_json'] ?? '[]', true),
                'lastLoginAt' => $now
            ]
        ], 'ورود با موفقیت انجام شد.');
    }

    if ($action === 'logout_all') {
        $me = authenticateUser(false);
        $upStmt = $db->prepare("UPDATE users SET token_version = token_version + 1 WHERE id = :id");
        $upStmt->execute(['id' => $me['id']]);
        logAudit($db, $me['id'], $me['name'], 'logout', 'auth', $me['id'], 'ابطال تمام نشست‌های فعال کاربر');
        jsonResponse(true, null, 'تمام نشست‌های فعال شما باطل شد. لطفاً دوباره وارد شوید.');
    }

    jsonResponse(false, null, 'عملیات نامعتبر است.', 400);
}

if ($method === 'GET') {
    // دریافت اطلاعات کاربر لاگین شده فعلی
    $user = authenticateUser(false);
    unset($user['password_hash']);
    $user['permissions'] = json_decode($user['permissions_json'] ?? '{}', true);
    $user['customEnabledModules'] = json_decode($user['allowed_modules_json'] ?? '{}', true);
    $user['allowedTabs'] = json_decode($user['allowed_tabs_json'] ?? '[]', true);
    jsonResponse(true, ['user' => $user]);
}
