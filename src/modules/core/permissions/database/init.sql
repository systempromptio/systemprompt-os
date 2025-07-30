-- Initialize default roles and permissions
-- This should only run after the permissions schema has been created

-- Initialize default roles
INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES
  ('role_admin', 'admin', 'System administrator with full access', 1),
  ('role_user', 'user', 'Regular user with basic access', 1);

-- Initialize default permissions
INSERT OR IGNORE INTO permissions (id, name, resource, action, description) VALUES
  -- Admin permissions
  ('perm_admin_all', 'admin.all', '*', '*', 'Full system access'),
  
  -- User management permissions
  ('perm_users_read', 'users.read', 'users', 'read', 'View user information'),
  ('perm_users_write', 'users.write', 'users', 'write', 'Create and update users'),
  ('perm_users_delete', 'users.delete', 'users', 'delete', 'Delete users'),
  
  -- Container permissions
  ('perm_containers_read', 'containers.read', 'containers', 'read', 'View containers'),
  ('perm_containers_write', 'containers.write', 'containers', 'write', 'Create and update containers'),
  ('perm_containers_delete', 'containers.delete', 'containers', 'delete', 'Delete containers'),
  ('perm_containers_own', 'containers.own', 'containers', 'own', 'Manage own containers only'),
  
  -- MCP permissions
  ('perm_mcp_access', 'mcp.access', 'mcp', 'access', 'Access MCP endpoints'),
  ('perm_mcp_admin', 'mcp.admin', 'mcp', 'admin', 'Admin MCP operations'),
  
  -- Profile permissions
  ('perm_profile_read', 'profile.read', 'profile', 'read', 'View own profile'),
  ('perm_profile_write', 'profile.write', 'profile', 'write', 'Update own profile');

-- Assign permissions to roles
-- Admin gets all permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_admin', 'perm_admin_all');

-- Regular user permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('role_user', 'perm_profile_read'),
  ('role_user', 'perm_profile_write'),
  ('role_user', 'perm_containers_read'),
  ('role_user', 'perm_containers_own'),
  ('role_user', 'perm_mcp_access');