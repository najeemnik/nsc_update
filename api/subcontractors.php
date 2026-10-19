<?php
/**
 * NSC Subcontractors & Trade Contracts API
 * Manages Subcontractors, Certified Work, Paid Amounts, Retention & Balances
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

sendSecurityHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = Database::getConnection();
$user = authenticateUser(false);
$tenantId = currentTenantId($user);

if ($method === 'GET') {
    $projectId = $_GET['projectId'] ?? null;
    $sql = "SELECT s.*, p.name as project_name 
            FROM subcontractors s 
            LEFT JOIN projects p ON s.project_id = p.id";
    $params = ['tid' => $tenantId];
    $sql .= " WHERE s.tenant_id = :tid";
    if ($projectId) {
        $ownStmt = $db->prepare("SELECT id FROM projects WHERE id = :pid AND tenant_id = :tid LIMIT 1");
        $ownStmt->execute(['pid' => $projectId, 'tid' => $tenantId]);
        if (!$ownStmt->fetch()) { jsonResponse(false, null, 'پروژه یافت نشد یا دسترسی ندارید.', 404); }
        $sql .= " AND s.project_id = :pid";
        $params['pid'] = $projectId;
    }
    $sql .= " ORDER BY s.created_at DESC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(true, ['subcontractors' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true) ?: [];

    $id = $input['id'] ?? generateUuid();
    $name = trim($input['name'] ?? $input['contractorName'] ?? '');
    $trade = trim($input['specialty'] ?? $input['tradeSpecialty'] ?? 'قراردادی عمومی');
    $phone = trim($input['phone'] ?? '');
    $projectId = $input['projectId'] ?? null;
    $contractValue = (float)($input['contractValue'] ?? 0);
    $certifiedAmount = (float)($input['certifiedAmount'] ?? 0);
    $paidAmount = (float)($input['paidAmount'] ?? 0);
    $retentionAmount = (float)($input['retentionAmount'] ?? 0);
    $remaining = max(0, $certifiedAmount - $paidAmount);
    $status = $input['status'] ?? 'active';

    if (empty($name)) {
        jsonResponse(false, null, 'نام قراردادی الزامی است.', 400);
    }

    // امنیت: پروژه (در صورت انتخاب) و رکورد موجود باید متعلق به همین شرکت باشند
    if (!empty($projectId)) {
        $ownStmt = $db->prepare("SELECT id FROM projects WHERE id = :pid AND tenant_id = :tid LIMIT 1");
        $ownStmt->execute(['pid' => $projectId, 'tid' => $tenantId]);
        if (!$ownStmt->fetch()) { jsonResponse(false, null, 'پروژه یافت نشد یا دسترسی ندارید.', 404); }
    }
    $chkStmt = $db->prepare("SELECT tenant_id FROM subcontractors WHERE id = :id LIMIT 1");
    $chkStmt->execute(['id' => $id]);
    $existing = $chkStmt->fetch();
    if ($existing && (string)$existing['tenant_id'] !== (string)$tenantId) {
        jsonResponse(false, null, 'پیمانکار یافت نشد یا دسترسی ندارید.', 404);
    }

    $stmt = $db->prepare("
        INSERT INTO subcontractors (
            id, tenant_id, contractor_name, trade_specialty, phone, project_id,
            contract_value, certified_work_amount, paid_amount,
            retention_amount, remaining_balance, status
        ) VALUES (
            :id, :tid, :name, :trade, :phone, :pid,
            :cval, :cert, :paid,
            :ret, :rem, :status
        ) ON DUPLICATE KEY UPDATE 
            contractor_name = VALUES(contractor_name),
            trade_specialty = VALUES(trade_specialty),
            phone = VALUES(phone),
            contract_value = VALUES(contract_value),
            certified_work_amount = VALUES(certified_work_amount),
            paid_amount = VALUES(paid_amount),
            retention_amount = VALUES(retention_amount),
            remaining_balance = VALUES(remaining_balance),
            status = VALUES(status)
    ");

    $stmt->execute([
        'id' => $id,
        'tid' => $tenantId,
        'name' => $name,
        'trade' => $trade,
        'phone' => $phone,
        'pid' => $projectId,
        'cval' => $contractValue,
        'cert' => $certifiedAmount,
        'paid' => $paidAmount,
        'ret' => $retentionAmount,
        'rem' => $remaining,
        'status' => $status
    ]);

    logAudit($db, $user['id'], $user['name'], 'update', 'contractors', $id, "ثبت/ویرایش مقاطعه‌کار: $name");
    jsonResponse(true, ['id' => $id], 'اطلاعات پیمانکار با موفقیت ثبت شد.');
}
