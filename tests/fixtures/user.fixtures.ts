import type { User } from '../../src/types/user';

export function createUserFixture(overrides?: Partial<User>): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  };
}

export const userFixtures = {
  admin: createUserFixture({
    id: 'admin-user',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  }),
  
  regular: createUserFixture({
    id: 'regular-user',
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user'
  }),
  
  newUser: createUserFixture({
    id: 'new-user',
    email: 'newuser@example.com',
    name: 'New User',
    createdAt: new Date(),
    updatedAt: new Date()
  })
};