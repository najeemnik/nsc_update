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
            WHERE (username = :u1 OR email = :u2) 
            LIMIT 1
        ");
        $stmt->execute(['u1' => $username, 'u2' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            jsonResponse(false, null, 'نام کاربری یا رمز عبور اشتباه است.', 401);
        }

        if ((int)$user['is_locked'] === 1) {
            jsonResponse(false, null, 'حساب کاربری شما توسط مدیر ارشد مسدود گردیده است.', 403);
        }

        // محدودیت تلاش ورود: حداکثر ۵ تلاش ناموفق در ۱۵ دقیقه برای هر نام کاربری
        $attemptKey = function_exists('mb_strtolower') ? mb_strtolower($username, 'UTF-8') : strtolower($username);
        $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        try {
            $rlStmt = $db->prepare("SELECT COUNT(*) AS c FROM login_attempts WHERE identifier = :ident AND attempted_at > (NOW() - INTERVAL 15 MINUTE)");
            $rlStmt->execute(['ident' => $attemptKey]);
            $fails = (int)($rlStmt->fetch()['c'] ?? 0);
            if ($fails >= 5) {
                jsonResponse(false, null, 'به دلیل تلاش‌های ناموفق پی‌هم، ورود برای ۱۵ دقیقه قفل شد. لطفاً بعداً تلاش کنید.', 429);
            }
        } catch (Exception $e) { error_log('Rate-limit check failed: ' . $e->getMessage()); }

        // Wave 40: app users carry frontend-style sha256$ hashes (salted with the
        // username); legacy seeds keep bcrypt. Plaintext is never accepted.
        $storedHash = trim((string)($user['password_hash'] ?? '')); // Wave 45: ignore pasted whitespace
        $passwordMatches = false;
        if ($storedHash !== '') {
            if (substr($storedHash, 0, 7) === 'sha256$') {
                $saltRaw = ($user['hash_salt'] ?? '') !== '' ? $user['hash_salt'] : $user['username'];
                $salt = function_exists('mb_strtolower') ? mb_strtolower(trim((string)$saltRaw), 'UTF-8') : strtolower(trim((string)$saltRaw));
                $calc = 'sha256$' . hash('sha256', $salt . '::nsc::' . $password);
                $passwordMatches = hash_equals($storedHash, $calc);
            } else {
                $passwordMatches = password_verify($password, $storedHash);
            }
        }

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
        try {
            $upStmt = $db->prepare("UPDATE users SET last_login_at = :now WHERE id = :id");
            $upStmt->execute(['now' => $now, 'id' => $user['id']]);
        } catch (Exception $e) { error_log('last_login update failed: ' . $e->getMessage()); }

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
                'appProfile' => json_decode($user['app_profile_json'] ?? 'null', true),
                'lastLoginAt' => $now
            ]
        ], 'ورود با موفقیت انجام شد.');
    }

    /**
     * Wave 40: multi-device user sync. The device owner pushes created/updated
     * users here (password arrives ONLY as a frontend sha256$ hash — never
     * plaintext), so the same username/password works on every device.
     * Auth: master/admin, or self (self may only touch name/phone/password).
     */
    if ($action === 'sync_user') {
        $me = authenticateUser(false);
        $meMaster = ((int)$me['is_master'] === 1) || $me['role'] === 'master';
        $mePriv = $meMaster || $me['role'] === 'admin';
        $p = $input['user'] ?? [];
        if (!is_array($p)) $p = [];

        $username = strtolower(trim((string)($p['username'] ?? '')));
        $email = strtolower(trim((string)($p['email'] ?? '')));
        $hash = trim((string)($p['passwordHash'] ?? ''));
        $fid = trim((string)($p['id'] ?? ''));
        if ($username === '' || !preg_match('/^[a-z0-9._-]{3,80}$/i', $username)) {
            jsonResponse(false, null, 'نام کاربری نامعتبر است.', 400);
        }
        if ($hash === '' || substr($hash, 0, 7) !== 'sha256$' || strlen($hash) > 255) {
            jsonResponse(false, null, 'Invalid password hash.', 400);
        }
        if ($email === '') $email = strtolower($username) . '@sync.local';

        // Wave-40 columns may be missing if the migration was skipped — degrade.
        $hasAppProfile = false; $hasHashSalt = false;
        try {
            $cols = $db->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
            $hasAppProfile = in_array('app_profile_json', $cols, true);
            $hasHashSalt = in_array('hash_salt', $cols, true);
        } catch (Exception $e) { /* ignore */ }

        $existing = null;
        if ($fid !== '') {
            $s = $db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
            $s->execute(['id' => $fid]);
            $existing = $s->fetch() ?: null;
        }
        if (!$existing) {
            $s = $db->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
            $s->execute(['u' => $username]);
            $existing = $s->fetch() ?: null;
        }

        $isSelf = $existing && (string)$existing['id'] === (string)$me['id'];
        if ($existing && (int)$existing['is_master'] === 1 && !$isSelf) {
            jsonResponse(false, null, 'حساب‌های مدیر ارشد قابل تغییر نیست.', 403);
        }
        if (!$existing && !empty($p['isMaster'])) {
            jsonResponse(false, null, 'Master accounts are created only via installer bootstrap.', 403);
        }
        if (!$mePriv && !$isSelf) {
            jsonResponse(false, null, 'عدم دسترسی.', 403);
        }
        if ($mePriv && !$meMaster && $existing && !$isSelf) {
            $ownerOf = (string)($existing['owner_admin_id'] ?? '');
            if ($ownerOf !== '' && $ownerOf !== (string)$me['id']) {
                jsonResponse(false, null, 'این کاربر متعلق به شرکت شما نیست.', 403);
            }
        }
        // Email must stay unique across OTHER rows.
        $s = $db->prepare('SELECT id FROM users WHERE email = :e LIMIT 1');
        $s->execute(['e' => $email]);
        $emailRow = $s->fetch();
        if ($emailRow && (!$existing || (string)$emailRow['id'] !== (string)$existing['id'])) {
            jsonResponse(false, null, 'این ایمیل قبلاً ثبت گردیده است.', 409);
        }

        $roleIn = strtolower(trim((string)($p['role'] ?? 'viewer')));
        $role = in_array($roleIn, ['admin', 'accountant', 'viewer'], true) ? $roleIn : 'viewer';
        $planIn = strtolower(trim((string)($p['subscriptionPlan'] ?? 'pro')));
        $plan = $planIn === 'trial' ? 'trial' : ($planIn === 'lifetime' ? 'lifetime' : ($planIn === 'enterprise' ? 'enterprise' : 'pro'));
        $expIn = trim((string)($p['subscriptionExpiresAt'] ?? ''));
        $expires = preg_match('/^\d{4}-\d{2}-\d{2}/', $expIn) ? str_replace('T', ' ', substr($expIn, 0, 19)) : null;
        $ownerId = $meMaster
            ? (trim((string)($p['ownerAdminId'] ?? '')) ?: null)
            : (string)$me['id'];

        if ($existing && !$mePriv && $isSelf) {
            // Self-service: password + basic profile only (no role/lock/grants).
            $s = $db->prepare('UPDATE users SET name = :n, phone = :ph, password_hash = :h WHERE id = :id');
            $s->execute([
                'n' => trim((string)($p['name'] ?? $existing['name'])),
                'ph' => trim((string)($p['phone'] ?? ($existing['phone'] ?? ''))),
                'h' => $hash, 'id' => $existing['id'],
            ]);
            logAudit($db, $me['id'], $me['name'], 'update', 'user_sync', $existing['id'], 'Self profile sync from device');
            jsonResponse(true, ['id' => $existing['id'], 'self' => true], 'همگام‌سازی موفقانه انجام شد.');
        }

        $row = [
            'id' => $existing ? $existing['id'] : ($fid !== '' ? $fid : bin2hex(random_bytes(16))),
            'owner' => $isSelf && $existing ? ($existing['owner_admin_id'] ?? null) : $ownerId,
            'name' => trim((string)($p['name'] ?? ($existing['name'] ?? $username))),
            'username' => $username,
            'email' => $email,
            'hash' => $hash,
            'salt' => trim((string)($p['hashSalt'] ?? $username)),
            'role' => $role,
            'phone' => trim((string)($p['phone'] ?? ($existing['phone'] ?? ''))),
            'company' => trim((string)($p['companyName'] ?? ($existing['company_name'] ?? ''))),
            'address' => (string)($p['companyAddress'] ?? ($existing['company_address'] ?? '')),
            'plan' => $plan,
            'expires' => $expires,
            'locked' => !empty($p['isLockedBySuperAdmin']) || (array_key_exists('active', $p) ? !$p['active'] : ((int)($existing['is_locked'] ?? 0) === 1)) ? 1 : 0,
            'perms' => json_encode($p['permissions'] ?? ($existing ? json_decode($existing['permissions_json'] ?? '{}', true) : new stdClass())),
            'modules' => json_encode($p['customEnabledModules'] ?? ($existing ? json_decode($existing['allowed_modules_json'] ?? '{}', true) : new stdClass())),
            'tabs' => json_encode($p['allowedTabs'] ?? ($existing ? json_decode($existing['allowed_tabs_json'] ?? '[]', true) : [])),
            'profile' => json_encode($p['appProfile'] ?? ($existing && $hasAppProfile ? json_decode($existing['app_profile_json'] ?? 'null', true) : new stdClass())),
        ];

        // Wave 54: a sync push must never demote a master row — stale device
        // copies carry role=viewer. Master rank is managed by bootstrap only.
        if ($existing && (int)$existing['is_master'] === 1) {
            $row['role'] = 'master';
        }
        if ($existing) {
            $sql = 'UPDATE users SET owner_admin_id = :owner, name = :n, username = :u, email = :e,
                    password_hash = :h, role = :r, phone = :ph, company_name = :c, company_address = :a,
                    subscription_plan = :pl, subscription_expires_at = :ex, is_locked = :l,
                    permissions_json = :pm, allowed_modules_json = :mo, allowed_tabs_json = :tb'
                . ($hasHashSalt ? ', hash_salt = :sa' : '')
                . ($hasAppProfile ? ', app_profile_json = :pr' : '')
                . ' WHERE id = :id';
            $s = $db->prepare($sql);
            $args = ['owner' => $row['owner'], 'n' => $row['name'], 'u' => $row['username'],
                'e' => $row['email'], 'h' => $row['hash'], 'r' => $row['role'], 'ph' => $row['phone'],
                'c' => $row['company'], 'a' => $row['address'], 'pl' => $row['plan'], 'ex' => $row['expires'],
                'l' => $row['locked'], 'pm' => $row['perms'], 'mo' => $row['modules'], 'tb' => $row['tabs'],
                'id' => $row['id']];
            if ($hasHashSalt) $args['sa'] = $row['salt'];
            if ($hasAppProfile) $args['pr'] = $row['profile'];
            $s->execute($args);
            logAudit($db, $me['id'], $me['name'], 'update', 'user_sync', $row['id'], 'User synced from device: ' . $username);
        } else {
            $cols = 'id, owner_admin_id, name, username, email, password_hash, role, phone, company_name,
                company_address, subscription_plan, subscription_expires_at, is_locked,
                permissions_json, allowed_modules_json, allowed_tabs_json';
            $vals = ':id, :owner, :n, :u, :e, :h, :r, :ph, :c, :a, :pl, :ex, :l, :pm, :mo, :tb';
            $args = ['id' => $row['id'], 'owner' => $row['owner'], 'n' => $row['name'], 'u' => $row['username'],
                'e' => $row['email'], 'h' => $row['hash'], 'r' => $row['role'], 'ph' => $row['phone'],
                'c' => $row['company'], 'a' => $row['address'], 'pl' => $row['plan'], 'ex' => $row['expires'],
                'l' => $row['locked'], 'pm' => $row['perms'], 'mo' => $row['modules'], 'tb' => $row['tabs']];
            if ($hasHashSalt) { $cols .= ', hash_salt'; $vals .= ', :sa'; $args['sa'] = $row['salt']; }
            if ($hasAppProfile) { $cols .= ', app_profile_json'; $vals .= ', :pr'; $args['pr'] = $row['profile']; }
            $s = $db->prepare("INSERT INTO users ($cols) VALUES ($vals)");
            $s->execute($args);
            logAudit($db, $me['id'], $me['name'], 'create', 'user_sync', $row['id'], 'User pushed from device: ' . $username);
        }
        jsonResponse(true, ['id' => $row['id']], 'همگام‌سازی موفقانه انجام شد.');
    }

    if ($action === 'delete_user') {
        $me = authenticateUser(false);
        $meMaster = ((int)$me['is_master'] === 1) || $me['role'] === 'master';
        $mePriv = $meMaster || $me['role'] === 'admin';
        if (!$mePriv) {
            jsonResponse(false, null, 'عدم دسترسی.', 403);
        }
        $fid = trim((string)($input['id'] ?? ''));
        $username = trim((string)($input['username'] ?? ''));
        $target = null;
        if ($fid !== '') {
            $s = $db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
            $s->execute(['id' => $fid]);
            $target = $s->fetch() ?: null;
        }
        if (!$target && $username !== '') {
            $s = $db->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
            $s->execute(['u' => $username]);
            $target = $s->fetch() ?: null;
        }
        if (!$target) {
            jsonResponse(true, ['deleted' => false], 'کاربر در سرور یافت نشد.');
        }
        if ((int)$target['is_master'] === 1) {
            jsonResponse(false, null, 'حساب‌های مدیر ارشد قابل حذف نیست.', 403);
        }
        if (!$meMaster) {
            $ownerOf = (string)($target['owner_admin_id'] ?? '');
            if ($ownerOf !== '' && $ownerOf !== (string)$me['id']) {
                jsonResponse(false, null, 'این کاربر متعلق به شرکت شما نیست.', 403);
            }
        }
        $s = $db->prepare('DELETE FROM users WHERE id = :id');
        $s->execute(['id' => $target['id']]);
        logAudit($db, $me['id'], $me['name'], 'delete', 'user_sync', $target['id'], 'User deleted from device: ' . $target['username']);
        jsonResponse(true, ['deleted' => true], 'کاربر از سرور حذف شد.');
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
    // Wave 41: capability probe (no auth) — lets the app tell outdated
    // server files apart from a dead connection.
    if (($_GET['action'] ?? '') === 'ping') {
        jsonResponse(true, ['wave' => 40, 'time' => date('c'), 'mbstring' => function_exists('mb_strtolower'), 'php' => PHP_VERSION]);
    }
    // دریافت اطلاعات کاربر لاگین شده فعلی
    $user = authenticateUser(false);
    unset($user['password_hash']);
    $user['permissions'] = json_decode($user['permissions_json'] ?? '{}', true);
    $user['customEnabledModules'] = json_decode($user['allowed_modules_json'] ?? '{}', true);
    $user['allowedTabs'] = json_decode($user['allowed_tabs_json'] ?? '[]', true);
    $user['appProfile'] = json_decode($user['app_profile_json'] ?? 'null', true);
    jsonResponse(true, ['user' => $user]);
}
