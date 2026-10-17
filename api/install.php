<?php
/**
 * NSC Installer-Key Gate (go-live).
 * The public domain must NOT hand a fresh Office7 to every random visitor:
 * the first-run setup screen requires this installer key, verified here
 * against api/.secrets/install.key (never committed to git, never web-readable).
 *
 * POST ?action=verify    { "key": "..." }  -> { success: true|false }
 *
 * Wave 38 central lock: exactly ONE office is ever initialized on a domain.
 * GET  ?action=status                     -> { initialized: true|false }
 * POST ?action=complete  { "key": "..." } -> creates installed.lock
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php'; // jsonResponse() (no DB connection is opened here)

sendSecurityHeaders();

$action = $_GET['action'] ?? '';

if ($action === 'status') {
    // Public, read-only: tells the app whether setup already happened.
    $lockFile = __DIR__ . '/.secrets/installed.lock';
    jsonResponse(true, ['initialized' => is_file($lockFile)], 'Install status.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed.', 405);
}

if ($action !== 'verify' && $action !== 'complete') {
    jsonResponse(false, null, 'Unknown action.', 404);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true) ?: [];
$attempt = trim((string)($input['key'] ?? ''));

if ($attempt === '') {
    jsonResponse(false, null, 'Installer key is required.', 400);
}

$keyFile = __DIR__ . '/.secrets/install.key';
$expected = '';
if (is_file($keyFile)) {
    $expected = trim((string)@file_get_contents($keyFile));
}

if ($expected === '' || !hash_equals($expected, $attempt)) {
    // Generic message: do not reveal whether the key file exists.
    jsonResponse(false, null, 'Invalid installer key.', 403);
}

if ($action === 'complete') {
    // Seal the domain: no second office can ever be initialized here.
    $lockFile = __DIR__ . '/.secrets/installed.lock';
    if (!is_file($lockFile)) {
        @file_put_contents($lockFile, json_encode([
            'locked_at' => gmdate('c'),
            'id' => bin2hex(random_bytes(8)),
        ]));
        @chmod($lockFile, 0600);
    }
    // Wave 40: optional installer-gated master bootstrap — creates the server
    // copy of the master owner so multi-device login + user sync get a token.
    // The password arrives ONLY as a frontend sha256$ hash, never plaintext.
    // Safe to repeat (re-seal simply refreshes the master row).
    $masterSynced = false;
    $m = $input['master'] ?? null;
    if (is_array($m)) {
        $mUser = trim((string)($m['username'] ?? ''));
        $mHash = (string)($m['passwordHash'] ?? '');
        $mEmail = trim((string)($m['email'] ?? ''));
        $mName = trim((string)($m['name'] ?? '')) ?: $mUser;
        $mValid = !($mUser === '' || !preg_match('/^[a-z0-9._-]{3,80}$/i', $mUser)
            || $mHash === '' || substr($mHash, 0, 7) !== 'sha256$' || strlen($mHash) > 255);
        if ($mEmail === '') $mEmail = strtolower($mUser) . '@sync.local';
        if (!$mValid) {
            error_log('Master bootstrap skipped: invalid payload.');
        } else try {
            $db = Database::getConnection();
            $hasAppProfile = false; $hasHashSalt = false;
            try {
                $cols = $db->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
                $hasAppProfile = in_array('app_profile_json', $cols, true);
                $hasHashSalt = in_array('hash_salt', $cols, true);
            } catch (Exception $e) { /* ignore */ }
            $s = $db->prepare('SELECT * FROM users WHERE username = :u LIMIT 1');
            $s->execute(['u' => $mUser]);
            $row = $s->fetch() ?: null;
            if ($row && (int)$row['is_master'] !== 1) {
                throw new Exception('Master username is taken by a non-master account.');
            }
            $mId = trim((string)($m['id'] ?? '')) ?: ($row['id'] ?? bin2hex(random_bytes(16)));
            $mCompany = trim((string)($m['companyName'] ?? ($row['company_name'] ?? '')));
            $mSalt = trim((string)($m['hashSalt'] ?? $mUser));
            $mProfile = json_encode([
                'companyName' => $mCompany,
                'bootstrappedAt' => gmdate('c'),
            ]);
            if ($row) {
                $sql = 'UPDATE users SET password_hash = :h, email = :e, name = :n,
                        company_name = :c, is_locked = 0, is_master = 1, role = :r'
                    . ($hasHashSalt ? ', hash_salt = :sa' : '')
                    . ($hasAppProfile ? ', app_profile_json = :pr' : '')
                    . ' WHERE id = :id';
                $s = $db->prepare($sql);
                $args = ['h' => $mHash, 'e' => $mEmail, 'n' => $mName, 'c' => $mCompany,
                    'r' => 'master', 'id' => $row['id']];
                if ($hasHashSalt) $args['sa'] = $mSalt;
                if ($hasAppProfile) $args['pr'] = $mProfile;
                $s->execute($args);
            } else {
                $cols = 'id, name, username, email, password_hash, role, company_name,
                    subscription_plan, is_locked, is_master';
                $vals = ':id, :n, :u, :e, :h, :r, :c, :pl, 0, 1';
                $args = ['id' => $mId, 'n' => $mName, 'u' => $mUser, 'e' => $mEmail,
                    'h' => $mHash, 'r' => 'master', 'c' => $mCompany, 'pl' => 'lifetime'];
                if ($hasHashSalt) { $cols .= ', hash_salt'; $vals .= ', :sa'; $args['sa'] = $mSalt; }
                if ($hasAppProfile) { $cols .= ', app_profile_json'; $vals .= ', :pr'; $args['pr'] = $mProfile; }
                $s = $db->prepare("INSERT INTO users ($cols) VALUES ($vals)");
                $s->execute($args);
            }
            $masterSynced = true;
        } catch (Exception $e) {
            error_log('Master bootstrap failed: ' . $e->getMessage());
        }
    }
    jsonResponse(true, ['initialized' => true, 'masterSynced' => $masterSynced], 'Installation sealed.');
}

jsonResponse(true, ['verified' => true], 'Installer key verified.');
