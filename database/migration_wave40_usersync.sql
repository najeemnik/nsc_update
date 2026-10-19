-- =====================================================================
-- Wave 40: multi-device user sync — import ONCE via phpMyAdmin (SQL tab).
-- If a column already exists, MySQL reports an error for that line only;
-- that is harmless (the column is already there, nothing is lost).
-- =====================================================================

-- Original username salt for frontend-style sha256$ password hashes.
-- (Changing a username keeps the old salt, so all devices keep working.)
ALTER TABLE `users` ADD COLUMN `hash_salt` VARCHAR(80) NULL
  COMMENT 'Wave40: original username salt for sha256$ password hash' AFTER `password_hash`;

-- Full frontend user profile (project grants, access expiry, themes,
-- button layouts, bill designs) so every device restores the same user.
ALTER TABLE `users` ADD COLUMN `app_profile_json` LONGTEXT NULL
  COMMENT 'Wave40: extended frontend user profile (JSON)' AFTER `allowed_tabs_json`;
