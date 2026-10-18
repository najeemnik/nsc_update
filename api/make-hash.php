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
        $s = $db->prepare('SELECT * FROM users WHERE (username = :u OR email = :u) LIMIT 1');
        $s->execute(['u' => $inUser]);
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
</div></body></html>
