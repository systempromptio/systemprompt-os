#!/usr/bin/env python3

import subprocess
import re
from collections import defaultdict

def get_test_failures():
    try:
        result = subprocess.run(['npm', 'test'], 
                              capture_output=True, text=True, cwd='/var/www/html/systemprompt-os')
        output = result.stderr
        
        failed_files = []
        current_file = None
        
        for line in output.split('\n'):
            # Extract test file paths from failed test lines
            if 'FAIL  ' in line and '.spec.ts' in line:
                # Extract file path after FAIL marker
                match = re.search(r'FAIL\s+([^\s]+\.spec\.ts)', line)
                if match:
                    file_path = match.group(1)
                    failed_files.append(file_path)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_failed_files = []
        for f in failed_files:
            if f not in seen:
                seen.add(f)
                unique_failed_files.append(f)
        
        return unique_failed_files[:60]
    
    except Exception as e:
        print(f"Error: {e}")
        return []

def get_coverage_issues():
    # Extract files with 0% coverage from the previous coverage report
    low_coverage_files = [
        "src/server/external/auth/providers/generic-oauth2.ts",
        "src/server/external/rest/oauth2/authorization-server.ts", 
        "src/server/external/rest/oauth2/token.ts",
        "src/server/external/rest/oauth2/authorize.ts",
        "src/server/external/rest/oauth2/register.ts",
        "src/server/external/rest/oauth2/userinfo.ts",
        "src/server/external/rest/oauth2/well-known.ts",
        "src/server/external/rest/oauth2/protected-resource.ts",
        "src/server/external/templates/config/admin-config.ts",
        "src/server/external/templates/auth/callback.ts",
        "src/server/external/templates/config/initial-setup.ts",
        "src/server/external/types/auth.ts",
        "src/server/external/types/routes.types.ts",
        "src/server/external/auth/providers/auth-module-adapter.ts",
        "src/server/external/auth/providers/interface.ts",
        "src/server/external/auth/providers/registry.ts",
        "src/server/external/auth/jwt.ts",
        "src/server/external/middleware/auth.ts",
        "src/server/external/rest/api/terminal.ts",
        "src/server/external/rest/api/users.ts",
        "src/server/external/rest/auth.ts",
        "src/server/external/rest/callback.ts",
        "src/server/external/rest/config.ts",
        "src/server/external/rest/dashboard.ts",
        "src/server/external/rest/health.ts",
        "src/server/external/rest/splash.ts",
        "src/server/external/templates/auth.ts",
        "src/server/external/templates/config/layout.ts",
        "src/server/external/templates/config/status.ts",
        "src/server/external/templates/splash.ts",
        "src/server/mcp/local/daemon.ts",
        "src/server/mcp/local/index.ts",
        "src/server/mcp/local/server.ts",
        "src/server/mcp/loader.ts",
        "src/server/mcp/registry.ts",
        "src/server/mcp/remote/core-server.ts",
        "src/server/mcp/remote/index.ts",
        "src/server/mcp/remote/types.ts",
        "src/utils/console-logger.ts",
        "src/modules/core/modules/services/module-scanner.service.ts",
        "src/modules/core/auth/cli/db.ts",
        "src/modules/core/auth/cli/generatekey.ts",
        "src/modules/core/auth/cli/providers.ts",
        "src/modules/core/auth/cli/role.ts",
        "src/modules/core/auth/cli/token.command.ts",
        "src/modules/core/auth/cli/tunnel.ts",
        "src/modules/core/auth/constants/index.ts",
        "src/modules/core/auth/database/models/index.ts",
        "src/modules/core/auth/database/repository.ts",
        "src/modules/core/auth/index.ts",
        "src/modules/core/auth/providers/core/github.ts",
        "src/modules/core/auth/providers/core/google.ts",
        "src/modules/core/auth/providers/core/oauth2.ts",
        "src/modules/core/auth/providers/registry.ts",
        "src/modules/core/auth/services/audit.service.ts",
        "src/modules/core/auth/services/auth-code-service.ts",
        "src/modules/core/auth/services/auth.service.ts",
        "src/modules/core/auth/services/mfa.service.ts",
        "src/modules/core/auth/services/oauth2-config.service.ts",
        "src/modules/core/auth/services/token.service.ts",
        "src/modules/core/auth/services/tunnel-service.ts",
        "src/modules/core/auth/services/user-service.ts"
    ]
    
    return low_coverage_files[:60]

if __name__ == "__main__":
    print("=== FAILED TEST FILES ===")
    failed_files = get_test_failures()
    for i, file in enumerate(failed_files[:60], 1):
        print(f"{i}. {file}")
    
    print(f"\n=== LOW COVERAGE FILES ===")
    coverage_files = get_coverage_issues()
    for i, file in enumerate(coverage_files[:60], 1):
        print(f"{i}. {file}")