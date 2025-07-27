import { describe, it, expect, beforeEach, vi } from 'vitest';
import { command } from '@/modules/core/users/cli/create';
import { UsersService } from '@/modules/core/users/services/users.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

vi.mock('@/modules/core/users/services/users.service');
vi.mock('@/modules/core/cli/services/cli-output.service');
vi.mock('@/modules/core/logger/services/logger.service');

describe('Users Create CLI Command', () => {
  let mockUsersService: any;
  let mockCliOutput: any;
  let mockLogger: any;
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUsersService = {
      createUser: vi.fn()
    };
    mockCliOutput = {
      section: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      keyValue: vi.fn()
    };
    mockLogger = {
      error: vi.fn()
    };

    vi.mocked(UsersService.getInstance).mockReturnValue(mockUsersService);
    vi.mocked(CliOutputService.getInstance).mockReturnValue(mockCliOutput);
    vi.mocked(LoggerService.getInstance).mockReturnValue(mockLogger);
    
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should create a user successfully', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      loginAttempts: 0,
      lastLoginAt: null,
      lockedUntil: null
    };

    mockUsersService.createUser.mockResolvedValue(mockUser);

    const context = {
      args: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'testpass123',
        role: 'user'
      }
    };

    try {
      await command.execute(context);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(mockUsersService.createUser).toHaveBeenCalledWith({
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpass123',
      role: 'user'
    });

    expect(mockCliOutput.success).toHaveBeenCalledWith('User created successfully');
    expect(mockCliOutput.keyValue).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it('should output JSON format when requested', async () => {
    const mockUser = {
      id: '123',
      username: 'testuser',
      email: 'test@example.com',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      loginAttempts: 0,
      lastLoginAt: null,
      lockedUntil: null
    };

    mockUsersService.createUser.mockResolvedValue(mockUser);
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const context = {
      args: {
        username: 'testuser',
        email: 'test@example.com',
        format: 'json'
      }
    };

    try {
      await command.execute(context);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockUser, null, 2));
    consoleSpy.mockRestore();
  });

  it('should fail when username or email is missing', async () => {
    const context = {
      args: {
        username: 'testuser'
        // email is missing
      }
    };

    try {
      await command.execute(context);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(mockCliOutput.error).toHaveBeenCalledWith('Username and email are required');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle creation errors', async () => {
    mockUsersService.createUser.mockRejectedValue(new Error('Database error'));

    const context = {
      args: {
        username: 'testuser',
        email: 'test@example.com'
      }
    };

    try {
      await command.execute(context);
    } catch (error: any) {
      expect(error.message).toBe('process.exit called');
    }

    expect(mockCliOutput.error).toHaveBeenCalledWith('Error creating user');
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});