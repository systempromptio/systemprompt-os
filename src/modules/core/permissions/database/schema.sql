-- Permissions module database schema

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT OR IGNORE INTO roles (name, description, is_system) VALUES
    ('admin', 'Full system administrator', TRUE),
    ('user', 'Standard user', TRUE),
    ('guest', 'Guest user with limited access', TRUE);

-- Indexes for roles
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON roles(is_system);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    scope TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, action, scope)
);

-- Indexes for permissions
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);

-- Role permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id INTEGER NOT NULL,
    conditions TEXT, -- JSON conditions
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User permissions table (for direct grants)
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id TEXT NOT NULL,
    permission_id INTEGER NOT NULL,
    conditions TEXT, -- JSON conditions
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by TEXT,
    expires_at DATETIME,
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires_at ON user_permissions(expires_at);

-- Permission cache table (for performance)
CREATE TABLE IF NOT EXISTS permission_cache (
    cache_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    scope TEXT,
    is_allowed BOOLEAN NOT NULL,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for permission_cache
CREATE INDEX IF NOT EXISTS idx_permission_cache_user_id ON permission_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_cache_expires_at ON permission_cache(expires_at);

-- Audit log for permission changes
CREATE TABLE IF NOT EXISTS permission_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'role')),
    target_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('grant', 'revoke', 'create_role', 'delete_role', 'assign_role', 'unassign_role')),
    resource TEXT,
    permission_action TEXT,
    details TEXT, -- JSON details
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for audit
CREATE INDEX IF NOT EXISTS idx_permission_audit_user_id ON permission_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_target ON permission_audit(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_timestamp ON permission_audit(timestamp);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_roles_updated_at 
AFTER UPDATE ON roles
BEGIN
    UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to clean cache on permission changes
CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_role_permission 
AFTER INSERT ON role_permissions
BEGIN
    DELETE FROM permission_cache 
    WHERE user_id IN (
        SELECT user_id FROM user_roles WHERE role_id = NEW.role_id
    );
END;

CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_user_permission 
AFTER INSERT ON user_permissions
BEGIN
    DELETE FROM permission_cache WHERE user_id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS invalidate_cache_on_role_assignment 
AFTER INSERT ON user_roles
BEGIN
    DELETE FROM permission_cache WHERE user_id = NEW.user_id;
END;