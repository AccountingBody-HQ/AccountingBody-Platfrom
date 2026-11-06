// Neutral values for tests of the admin area. Used only by test files.
import { createAdminSession } from './middleware-logic'

export const TEST_ADMIN_PATH = 'test-admin-area'
export const TEST_ADMIN_SECRET = 'test-admin-password-value'
export const TEST_SESSION_SECRET = '0123456789abcdef'.repeat(4)

export async function signTestSession(
  sessionSecret: string = TEST_SESSION_SECRET,
  adminSecret: string = TEST_ADMIN_SECRET,
): Promise<string> {
  const session = await createAdminSession(sessionSecret, adminSecret)
  if (!session) throw new Error('test session was not issued')
  return session
}
