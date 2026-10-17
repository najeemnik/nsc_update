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
</div></body></html>
