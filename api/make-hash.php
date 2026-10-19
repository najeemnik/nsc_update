<?php
/**
 * NSC password hash helper (Wave 45) — STANDALONE, no database needed.
 *
 * Use it to (1) generate a correct hash to paste into phpMyAdmin, or
 * (2) verify whether the hash already in phpMyAdmin matches a password.
 * Uses the EXACT same logic as api/auth.php login.
 *
 * SECURITY: delete this file from the server after use.
 * PHP 7.0+ compatible (no PHP 8-only functions).
 */

header('Content-Type: text/html; charset=utf-8');

function nsc_frontend_hash($password, $username) {
    $salt = strtolower(trim((string)$username));
    return 'sha256$' . hash('sha256', $salt . '::nsc::' . trim((string)$password));
}

function nsc_verify($password, $storedHash, $username) {
    $pw = trim((string)$password);
    $stored = trim((string)$storedHash);
    if ($pw === '' || $stored === '') return false;
    if (substr($stored, 0, 7) === 'sha256$') {
        $calc = nsc_frontend_hash($pw, $username);
        return function_exists('hash_equals') ? hash_equals($stored, $calc) : ($stored === $calc);
    }
    return password_verify($pw, $stored); // bcrypt seeds ($2y$...)
}

$mode = $_POST['mode'] ?? '';
$out = '';
if ($mode === 'generate') {
    $pw = trim((string)($_POST['password'] ?? ''));
    $un = strtolower(trim((string)($_POST['username'] ?? '')));
    if ($pw === '' || $un === '') {
        $out = '<p class="err">Password and username are required / رمز و نام کاربری لازم است.</p>';
    } else {
        $bcrypt = password_hash($pw, PASSWORD_BCRYPT);
        $front = nsc_frontend_hash($pw, $un);
        $out = '<div class="res"><p><b>1) bcrypt (paste into phpMyAdmin `password_hash` — works for any login):</b></p>'
            . '<code>' . htmlspecialchars($bcrypt, ENT_QUOTES, 'UTF-8') . '</code>'
            . '<p><b>2) frontend style (same password, needs this exact username):</b></p>'
            . '<code>' . htmlspecialchars($front, ENT_QUOTES, 'UTF-8') . '</code>'
            . '<p class="hint">Either one works — pick one row value and paste it into the <b>password_hash</b> column of that user in phpMyAdmin. Then log in with the PLAIN password in the app.</p></div>';
    }
} elseif ($mode === 'verify') {
    $pw = (string)($_POST['password'] ?? '');
    $un = (string)($_POST['username'] ?? '');
    $stored = (string)($_POST['stored'] ?? '');
    $match = nsc_verify($pw, $stored, $un);
    $out = $match
        ? '<p class="ok">MATCH — this password IS correct for that hash. If app login still fails, the problem is the server/API link, not the password.</p>'
        : '<p class="err">MISMATCH — this password does NOT match that hash (or the username salt is wrong). Generate a fresh hash above and paste it into phpMyAdmin.</p>';
} elseif ($mode === 'dbtest') {
    // Wave 46: read-only database check — answers "is the app even reading
    // the database you edited?" without showing any secret.
    try {
        if (!file_exists(__DIR__ . '/config.php')) throw new Exception('config.php not found next to make-hash.php');
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/db.php';
        $db = Database::getConnection();
        $dbmsg = '<p class="ok">DB CONNECTED — config.php credentials work.</p>';
        try {
            $c = $db->query('SELECT COUNT(*) AS c FROM users')->fetch();
            $dbmsg .= '<p>users table rows: <b>' . (int)($c['c'] ?? 0) . '</b></p>';
        } catch (Throwable $e) { $dbmsg .= '<p class="err">users table read failed: ' . htmlspecialchars($e->getMessage()) . '</p>'; }
        try {
            $st = $db->query("SELECT username, is_locked, LEFT(password_hash, 7) AS alg, CHAR_LENGTH(password_hash) AS hlen FROM users WHERE username IN ('office7','admin')");
            $list = $st->fetchAll();
            if (!$list) { $dbmsg .= '<p class="err">office7/admin rows NOT FOUND in THIS database — you may be editing a different database in phpMyAdmin!</p>'; }
            foreach ($list as $r) {
                $dbmsg .= '<p>user <b>' . htmlspecialchars($r['username']) . '</b> — locked=' . (int)$r['is_locked']
                    . ' — hash starts with <b>' . htmlspecialchars($r['alg']) . '</b> (length ' . (int)$r['hlen'] . ')</p>';
            }
        } catch (Throwable $e) { $dbmsg .= '<p class="err">seed lookup failed: ' . htmlspecialchars($e->getMessage()) . '</p>'; }
        try {
            $a = $db->query('SELECT COUNT(*) AS c FROM login_attempts WHERE attempted_at > (NOW() - INTERVAL 15 MINUTE)')->fetch();
            $dbmsg .= '<p>recent login_attempts (15 min): <b>' . (int)($a['c'] ?? 0) . '</b> (5+ on one name = that name is locked)</p>';
        } catch (Throwable $e) { $dbmsg .= '<p class="hint">login_attempts table missing (old database?)</p>'; }
    } catch (Throwable $e) {
        $dbmsg = '<p class="err">DB FAILED: ' . htmlspecialchars($e->getMessage()) . ' — check api/config.php credentials and database name.</p>';
    }
    $out = $dbmsg;
} elseif ($mode === 'usercreate') {
    // Wave 54: server-side account creation/repair — bypasses device push.
    // Same sandwich the app uses (verified byte-equal to the app SHA-256).
    $cuUser = strtolower(trim((string)($_POST['cusername'] ?? '')));
    $cuPass = trim((string)($_POST['cpassword'] ?? ''));
    $cuName = trim((string)($_POST['cname'] ?? ''));
    $cuRole = strtolower(trim((string)($_POST['crole'] ?? 'admin')));
    $cuEmail = strtolower(trim((string)($_POST['cemail'] ?? '')));
    if (!preg_match('/^[a-z0-9._-]{3,80}$/', $cuUser)) {
        $out = '<p class="err">Invalid username (3-80: a-z 0-9 . _ -).</p>';
    } elseif ($cuPass === '') {
        $out = '<p class="err">Password required.</p>';
    } elseif (!in_array($cuRole, ['admin', 'accountant', 'viewer'], true)) {
        $out = '<p class="err">Invalid role.</p>';
    } else try {
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/db.php';
        $db = Database::getConnection();
        if ($cuEmail === '') $cuEmail = $cuUser . '@sync.local';
        if ($cuName === '') $cuName = $cuUser;
        $cuHash = 'sha256$' . hash('sha256', $cuUser . '::nsc::' . $cuPass);
        $ccols = $db->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
        $cHasSalt = in_array('hash_salt', $ccols, true);
        $s = $db->prepare('SELECT * FROM users WHERE username = :cu LIMIT 1');
        $s->execute(['cu' => $cuUser]);
        $ex = $s->fetch() ?: null;
        if ($ex) {
            if ((int)$ex['is_master'] === 1) {
                $csql = 'UPDATE users SET password_hash = :h, is_locked = 0' . ($cHasSalt ? ', hash_salt = :sa' : '') . ' WHERE id = :id';
                $cparams = ['h' => $cuHash, 'id' => $ex['id']];
            } else {
                $csql = 'UPDATE users SET name = :n, email = :e, password_hash = :h, role = :r, is_locked = 0' . ($cHasSalt ? ', hash_salt = :sa' : '') . ' WHERE id = :id';
                $cparams = ['n' => $cuName, 'e' => $cuEmail, 'h' => $cuHash, 'r' => $cuRole, 'id' => $ex['id']];
            }
            if ($cHasSalt) $cparams['sa'] = $cuUser;
            $db->prepare($csql)->execute($cparams);
            $out = '<p class="ok">UPDATED <b>' . htmlspecialchars($cuUser) . '</b> (unlocked, password reset). Log in on ANY device with the password you typed.</p>';
        } else {
            $e = $db->prepare('SELECT id FROM users WHERE email = :e LIMIT 1');
            $e->execute(['e' => $cuEmail]);
            if ($e->fetch()) {
                $out = '<p class="err">Email already used by another account — pick another email.</p>';
            } else {
                $icols = 'id, name, username, email, password_hash, role, subscription_plan, is_locked' . ($cHasSalt ? ', hash_salt' : '');
                $ivals = ':id, :n, :u, :e, :h, :r, :pl, 0' . ($cHasSalt ? ', :sa' : '');
                $iparams = ['id' => bin2hex(random_bytes(16)), 'n' => $cuName, 'u' => $cuUser, 'e' => $cuEmail, 'h' => $cuHash, 'r' => $cuRole, 'pl' => 'pro'];
                if ($cHasSalt) $iparams['sa'] = $cuUser;
                $db->prepare("INSERT INTO users ($icols) VALUES ($ivals)")->execute($iparams);
                $out = '<p class="ok">CREATED <b>' . htmlspecialchars($cuUser) . '</b> (' . htmlspecialchars($cuRole) . '). Log in on ANY device with the password you typed — then reload the roster above to confirm.</p>';
            }
        }
    } catch (Throwable $e) {
        $out = '<p class="err">FAILED: ' . htmlspecialchars($e->getMessage()) . '</p>';
    }
} elseif ($mode === 'roster') {
    // Wave 53: zero-typing server truth — who is actually in the database?
    // Shows usernames/roles/locks/hash-TYPES only (never hashes or secrets).
    try {
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/db.php';
        $db = Database::getConnection();
        $rows = $db->query("SELECT username, name, email, role, is_locked, is_master, password_hash, created_at FROM users ORDER BY created_at ASC")->fetchAll();
        $html = '<p class="ok">Users on this server: <b>' . count($rows) . '</b></p>';
        $html .= '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;direction:ltr">';
        $html .= '<tr><th>#</th><th>username</th><th>name</th><th>role</th><th>master</th><th>locked</th><th>hash</th><th>created</th></tr>';
        $n = 0;
        foreach ($rows as $r) {
            $n++;
            $h = trim((string)($r['password_hash'] ?? ''));
            $ht = ($h === '') ? 'EMPTY!' : ((substr($h, 0, 7) === 'sha256$') ? 'sha256$…' : ((substr($h, 0, 4) === '$2y$') ? 'bcrypt…' : 'OTHER!'));
            $html .= '<tr><td>' . $n . '</td><td><b>' . htmlspecialchars($r['username']) . '</b></td>'
                . '<td>' . htmlspecialchars($r['name'] ?? '') . '</td>'
                . '<td>' . htmlspecialchars($r['role'] ?? '') . '</td>'
                . '<td>' . ((int)$r['is_master'] === 1 ? 'YES' : 'no') . '</td>'
                . '<td>' . ((int)$r['is_locked'] === 1 ? '<b>LOCKED</b>' : 'no') . '</td>'
                . '<td>' . $ht . '</td>'
                . '<td>' . htmlspecialchars($r['created_at'] ?? '') . '</td></tr>';
        }
        $html .= '</table>';
        // Wave 56: recent push/auth attempts — shows WHY pushes never land.
        try {
            $log = $db->query("SELECT created_at, user_name, action, module, record_id, details FROM system_audit_logs WHERE module IN ('user_sync', 'auth') AND action IN ('create', 'update', 'sync_rejected', 'auth_rejected', 'login') ORDER BY created_at DESC LIMIT 15")->fetchAll();
            $html .= '<h3>Recent push/auth attempts / تلاش‌های اخیر (' . count($log) . ')</h3>';
            if (count($log) === 0) {
                $html .= '<p class="hint">No push or login attempts recorded yet — press «Sync all users» in the app, then reload this page.</p>';
            } else {
                $html .= '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px;direction:ltr">';
                $html .= '<tr><th>time</th><th>who</th><th>action</th><th>target</th><th>details</th></tr>';
                foreach ($log as $e) {
                    $html .= '<tr><td>' . htmlspecialchars($e['created_at'] ?? '') . '</td><td>' . htmlspecialchars($e['user_name'] ?? '') . '</td><td><b>' . htmlspecialchars($e['action'] ?? '') . '</b></td><td>' . htmlspecialchars($e['record_id'] ?? '') . '</td><td>' . htmlspecialchars($e['details'] ?? '') . '</td></tr>';
                }
                $html .= '</table>';
            }
        } catch (Throwable $e2) { $html .= '<p class="hint">Activity log unavailable.</p>'; }
        $html .= '<p class="hint">If your owner is NOT in this list → it never reached the server: open the app on the laptop (v1.0.13+ pushes it automatically in seconds), or create it directly in part 6 below, then reload this page. If it IS here but login fails → run part 4 (simulator) with its username + password.</p>';
        $out = $html;
    } catch (Throwable $e) {
        $out = '<p class="err">FAILED: ' . htmlspecialchars($e->getMessage()) . '</p>';
    }
} elseif ($mode === 'logintest') {
    // Wave 48: server-side login simulator — runs the EXACT steps of
    // api/auth.php login (read-only, writes nothing) and reports each one.
    $inUser = trim((string)($_POST['username'] ?? ''));
    $inPass = trim((string)($_POST['password'] ?? ''));
    if ($inUser === '') {
        $out = '<p class="err">Username required.</p>';
    } else try {
        require_once __DIR__ . '/config.php';
        require_once __DIR__ . '/db.php';
        $db = Database::getConnection();
        $steps = '<p class="ok">1) DB connected.</p>';
        $s = $db->prepare('SELECT * FROM users WHERE (username = :u1 OR email = :u2) LIMIT 1');
        $s->execute(['u1' => $inUser, 'u2' => $inUser]);
        $u = $s->fetch() ?: null;
        if (!$u) {
            $steps .= '<p class="err">2) User NOT FOUND in this database (tried: ' . htmlspecialchars($inUser) . '). The app reads a different database than you think!</p>';
            $out = $steps;
        } else {
            $steps .= '<p class="ok">2) User FOUND: username=' . htmlspecialchars($u['username']) . ' locked=' . (int)$u['is_locked'] . ' master=' . (int)$u['is_master'] . '</p>';
            if ((int)$u['is_locked'] === 1) {
                $steps .= '<p class="err">3) Account is LOCKED (403). Set is_locked=0 in phpMyAdmin.</p>';
                $out = $steps;
            } else {
                $stored = trim((string)($u['password_hash'] ?? ''));
                $steps .= '<p>3) Stored hash: prefix=<b>' . htmlspecialchars(substr($stored, 0, 7)) . '</b> length=' . strlen($stored) . '</p>';
                $ok = false;
                if ($stored !== '' && substr($stored, 0, 7) === 'sha256$') {
                    $saltRaw = ($u['hash_salt'] ?? '') !== '' ? $u['hash_salt'] : $u['username'];
                    $salt = function_exists('mb_strtolower') ? mb_strtolower(trim((string)$saltRaw), 'UTF-8') : strtolower(trim((string)$saltRaw));
                    $calc = 'sha256$' . hash('sha256', $salt . '::nsc::' . $inPass);
                    $ok = function_exists('hash_equals') ? hash_equals($stored, $calc) : ($stored === $calc);
                    $steps .= '<p>4) sha256 branch (salt=' . htmlspecialchars($salt) . '): <b>' . ($ok ? 'MATCH' : 'MISMATCH') . '</b></p>';
                } elseif ($stored !== '') {
                    $ok = password_verify($inPass, $stored);
                    $steps .= '<p>4) bcrypt branch: password_verify = <b>' . ($ok ? 'TRUE' : 'FALSE') . '</b></p>';
                } else {
                    $steps .= '<p class="err">4) Stored hash is EMPTY.</p>';
                }
                $fails = 0;
                try {
                    $a = $db->prepare('SELECT COUNT(*) AS c FROM login_attempts WHERE identifier = :i AND attempted_at > (NOW() - INTERVAL 15 MINUTE)');
                    $a->execute(['i' => strtolower($inUser)]);
                    $fails = (int)($a->fetch()['c'] ?? 0);
                    $steps .= '<p>5) Recent fails for this name: <b>' . $fails . '</b>' . ($fails >= 5 ? ' (RATE-LOCKED 15 min)' : '') . '</p>';
                } catch (Throwable $e) { $steps .= '<p class="hint">5) attempts check skipped.</p>'; }
                if ($ok && $fails < 5) {
                    $steps .= '<p class="ok">RESULT: LOGIN WOULD SUCCEED. If the app still says &quot;not found&quot;, the break is HTTP transport or the app build — send this whole result.</p>';
                } elseif ($ok) {
                    $steps .= '<p class="err">RESULT: password CORRECT but RATE-LOCKED. Empty the login_attempts table in phpMyAdmin and try once.</p>';
                } else {
                    $steps .= '<p class="err">RESULT: WRONG PASSWORD for this hash. Generate a fresh hash in part 1, paste into phpMyAdmin, log in with that plain password.</p>';
                }
                $out = $steps;
            }
        }
    } catch (Throwable $e) {
        $out = '<p class="err">FAILED: ' . htmlspecialchars($e->getMessage()) . '</p>';
    }
}
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NSC Hash Helper</title>
<style>
body{font-family:Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:20px}
.box{max-width:640px;margin:0 auto;background:#1e293b;border-radius:16px;padding:22px}
h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px;color:#fbbf24}
p{font-size:13px;line-height:1.9}
label{display:block;font-size:12px;margin:8px 0 3px;color:#94a3b8}
input[type=text],input[type=password],textarea{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid #475569;background:#0f172a;color:#fff;font-size:13px}
textarea{direction:ltr;text-align:left}
button{margin-top:10px;background:#f59e0b;color:#000;border:0;border-radius:10px;padding:10px 22px;font-weight:bold;cursor:pointer;font-size:14px}
code{display:block;direction:ltr;text-align:left;background:#0f172a;border:1px solid #475569;border-radius:10px;padding:10px;font-size:12px;word-break:break-all;margin:6px 0}
.ok{background:#064e3b;border:1px solid #10b981;border-radius:10px;padding:10px;font-weight:bold}
.err{background:#7f1d1d;border:1px solid #ef4444;border-radius:10px;padding:10px;font-weight:bold}
.hint{color:#94a3b8}.res{margin-top:12px}.warn{color:#f87171;font-weight:bold}
hr{border:0;border-top:1px solid #334155;margin:18px 0}
</style></head>
<body><div class="box">
<h1>NSC Hash Helper / ابزار هش رمز</h1>
<p class="warn">Delete this file from the server after use / بعد از استفاده این فایل را از سرور پاک کنید.</p>
<p>Server PHP: <b><?php echo PHP_VERSION; ?></b></p>
<?php echo $out; ?>
<h2>1) Generate / ساخت هش تازه</h2>
<form method="post">
<input type="hidden" name="mode" value="generate">
<label>Username (exact, lowercase) / نام کاربری</label>
<input type="text" name="username" dir="ltr" placeholder="e.g. office7" required>
<label>Plain password / رمز ساده</label>
<input type="text" name="password" dir="ltr" required>
<button type="submit">Generate / بساز</button>
</form>
<hr>
<h2>2) Verify / بررسی هش موجود در دیتابیس</h2>
<form method="post">
<input type="hidden" name="mode" value="verify">
<label>Username (exact, lowercase) / نام کاربری</label>
<input type="text" name="username" dir="ltr" placeholder="e.g. office7" required>
<label>Plain password you type in the app / رمزی که در اپ می‌زنی</label>
<input type="text" name="password" dir="ltr" required>
<label>Stored hash from phpMyAdmin (copy the whole password_hash cell) / هش داخل phpMyAdmin</label>
<textarea name="stored" rows="3" required></textarea>
<button type="submit">Verify / بررسی</button>
</form>
<hr>
<h2>3) Database test / تست دیتابیس</h2>
<form method="post">
<input type="hidden" name="mode" value="dbtest">
<p class="hint">Reads config.php and checks the users table (read-only, no passwords shown) / فقط خواندن، بدون نمایش رمز.</p>
<button type="submit">Test DB / تست</button>
</form>
<hr>
<h2>4) Login simulator / شبیه‌ساز ورود</h2>
<form method="post">
<input type="hidden" name="mode" value="logintest">
<p class="hint">Runs the exact login steps on the server (read-only) / دقیقاً قدم‌های ورود را روی سرور اجرا می‌کند.</p>
<label>Username / نام کاربری</label>
<input type="text" name="username" dir="ltr" placeholder="e.g. office7" required>
<label>Plain password / رمز ساده</label>
<input type="text" name="password" dir="ltr" required>
<button type="submit">Simulate login / شبیه‌سازی</button>
</form>
<hr>
<h2>5) Server roster / کی‌ها در سرور اند؟</h2>
<form method="post">
<input type="hidden" name="mode" value="roster">
<p class="hint">One click, no typing — lists every account on the server / فقط یک کلیک.</p>
<button type="submit">Show roster / نمایش</button>
</form>
<hr>
<h2>6) Create / repair account on the server / ساخت مستقیم</h2>
<form method="post">
<input type="hidden" name="mode" value="usercreate">
<p class="hint">Creates the account (or resets its password) directly on the server — use when device push fails.</p>
<label>Username / نام کاربری (a-z 0-9 . _ -)</label>
<input type="text" name="cusername" dir="ltr" required>
<label>Plain password / رمز ساده</label>
<input type="text" name="cpassword" dir="ltr" required>
<label>Role / نقش</label>
<select name="crole" dir="ltr"><option value="admin">admin (owner/مالک)</option><option value="accountant">accountant</option><option value="viewer">viewer</option></select>
<label>Name (optional) / نام</label>
<input type="text" name="cname" dir="ltr">
<label>Email (optional) / ایمیل</label>
<input type="text" name="cemail" dir="ltr">
<button type="submit">Create / repair / بساز</button>
</form>
</div></body></html>
