<?php
/**
 * NSC Installer-Key Gate (go-live).
 * The public domain must NOT hand a fresh Office7 to every random visitor:
 * the first-run setup screen requires this installer key, verified here
 * against api/.secrets/install.key (never committed to git, never web-readable).
 *
 * POST ?action=verify  { "key": "..." }  -> { success: true|false }
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php'; // jsonResponse() (no DB connection is opened here)

sendSecurityHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed.', 405);
}

$action = $_GET['action'] ?? '';
if ($action !== 'verify') {
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

jsonResponse(true, ['verified' => true], 'Installer key verified.');
