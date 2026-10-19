-- =====================================================================
-- NSC Wave 2 Security Migration
-- اجرا بعد از database/nsc_schema.sql (یک‌بار، به ترتیب)
-- ۱) ستون tenant_id برای تفکیک کامل معلومات شرکت‌ها (§2.4)
-- ۲) جدول login_attempts برای محدودیت تلاش ورود (§2.2)
-- ۳) ستون token_version برای ابطال نشست‌ها (§2.2)
-- =====================================================================

-- ۱) تفکیک مستأجر (Tenant Isolation)
ALTER TABLE `company_profiles`      ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_company_profiles_tenant` (`tenant_id`);
ALTER TABLE `fiscal_periods`        ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_fiscal_periods_tenant` (`tenant_id`);
ALTER TABLE `projects`              ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_projects_tenant` (`tenant_id`);
ALTER TABLE `project_budgets`       ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_project_budgets_tenant` (`tenant_id`);
ALTER TABLE `treasury_accounts`     ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_treasury_accounts_tenant` (`tenant_id`);
ALTER TABLE `suppliers`             ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_suppliers_tenant` (`tenant_id`);
ALTER TABLE `subcontractors`        ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_subcontractors_tenant` (`tenant_id`);
ALTER TABLE `clients`               ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_clients_tenant` (`tenant_id`);
ALTER TABLE `apartment_units`       ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_apartment_units_tenant` (`tenant_id`);
ALTER TABLE `payment_vouchers`      ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_payment_vouchers_tenant` (`tenant_id`);
ALTER TABLE `material_procurements` ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_material_procurements_tenant` (`tenant_id`);
ALTER TABLE `labor_payroll`         ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_labor_payroll_tenant` (`tenant_id`);
ALTER TABLE `revenue_entries`       ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_revenue_entries_tenant` (`tenant_id`);
ALTER TABLE `treasury_transactions` ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_treasury_transactions_tenant` (`tenant_id`);
ALTER TABLE `petty_cash_expenses`   ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_petty_cash_expenses_tenant` (`tenant_id`);
ALTER TABLE `assets_machinery`      ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_assets_machinery_tenant` (`tenant_id`);
ALTER TABLE `project_transfers`     ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_project_transfers_tenant` (`tenant_id`);
ALTER TABLE `journal_entries`       ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_journal_entries_tenant` (`tenant_id`);
ALTER TABLE `steel_procurements`    ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_steel_procurements_tenant` (`tenant_id`);
ALTER TABLE `concrete_castings`     ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_concrete_castings_tenant` (`tenant_id`);
ALTER TABLE `project_partners`      ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_project_partners_tenant` (`tenant_id`);
ALTER TABLE `partner_investments`   ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_partner_investments_tenant` (`tenant_id`);
ALTER TABLE `project_documents`     ADD COLUMN `tenant_id` VARCHAR(36) NULL, ADD INDEX `idx_project_documents_tenant` (`tenant_id`);

-- یادداشت: جدول‌های users (با owner_admin_id)، office7_tenant_configs (مدیریت کل)،
-- chart_of_accounts (چارت عمومی)، journal_lines (از طریق سند والد) و
-- system_audit_logs (لاگ سراسری با user_id) عمداً بدون tenant_id مانده‌اند.

-- ۲) محدودیت تلاش ورود (Rate Limiting)
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `identifier` VARCHAR(190) NOT NULL COMMENT 'نام کاربری (حروف کوچک)',
  `ip_address` VARCHAR(45) NULL,
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_attempts_ident_time` (`identifier`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۳) نسخه توکن برای ابطال نشست‌ها (Logout All Sessions)
ALTER TABLE `users` ADD COLUMN `token_version` INT NOT NULL DEFAULT 0;
