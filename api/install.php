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
    jsonResponse(true, ['initialized' => true], 'Installation sealed.');
}

jsonResponse(true, ['verified' => true], 'Installer key verified.');
