import { z } from 'zod';

/**
 * The one password strength rule, shared by every endpoint that sets a
 * password — POST /api/users and PATCH /api/auth/password today. Two copies of
 * this would drift, and the weaker copy would be the one that mattered.
 *
 * NIST SP 800-63B §5.1.1.2: length is the control that matters, and composition
 * rules ("one uppercase, one digit, one symbol") are explicitly advised against
 * — they push people towards Password1! and predictable substitutions while
 * ruling out long passphrases that are genuinely stronger. So: a minimum
 * length, a blocklist of known-common choices, and nothing else.
 */

const MIN_LENGTH = 8;

/**
 * bcrypt hashes at most 72 **bytes** and silently ignores everything past that,
 * which would make two different long passwords interchangeable at login. The
 * limit is rejected rather than truncated, and it is counted in bytes rather
 * than characters because a multi-byte character can cross the boundary a
 * .max(72) on length would not see.
 */
const MAX_BYTES = 72;

/**
 * Deliberately short: the common-password blocklist NIST asks for is meant to
 * be a real corpus of breached passwords, which belongs in a dataset rather
 * than a source file. This is the placeholder — the handful that show up at the
 * top of every breach list, enough to stop the laziest choices.
 *
 * Everything here is at least MIN_LENGTH characters; shorter classics like
 * "qwerty" and "secret" are already excluded by the length rule, so listing
 * them would only suggest the list is doing work it is not.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  '12341234',
  'qwerty123',
  'qwertyuiop',
  'letmein1',
  'iloveyou',
  'trustno1',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome1',
  'changeme',
  'admin123',
  'abc12345',
  'starwars',
]);

export const passwordSchema = z
  .string({ error: 'Enter a password.' })
  // No .trim(). Leading and trailing spaces are legitimate password characters,
  // and silently stripping them stores something different from what was typed
  // — which then fails at login for reasons nobody can see.
  .min(MIN_LENGTH, `Use at least ${MIN_LENGTH} characters.`)
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= MAX_BYTES,
    `Use ${MAX_BYTES} bytes or fewer.`,
  )
  .refine(
    // Case-insensitive: Password123 is the same guess as password123.
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    'That password is too common. Choose something less guessable.',
  );
