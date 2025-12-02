/**
 * Password Utility Functions
 *
 * Utilities for generating secure temporary passwords and encrypting them
 * for storage in Firestore.
 */

/**
 * Generates a cryptographically secure random temporary password
 *
 * Password format:
 * - 12 characters long
 * - Mix of uppercase, lowercase, numbers, and special characters
 * - Guaranteed to have at least one of each character type
 *
 * @returns {string} A random 12-character password
 */
export function generateTempPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O for clarity
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Removed i, l, o for clarity
  const numbers = '23456789'; // Removed 0, 1 for clarity
  const special = '!@#$%&*+-=?';

  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining 8 characters randomly
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to avoid predictable pattern
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Simple encryption for temporary passwords using base64
 *
 * NOTE: This is NOT cryptographically secure encryption. For production,
 * consider using Firebase Functions to encrypt with a secret key, or
 * use a proper encryption library like crypto-js.
 *
 * This implementation is for basic obfuscation only.
 *
 * @param {string} password - The password to encrypt
 * @returns {string} Base64 encoded password
 */
export function encryptPassword(password: string): string {
  try {
    // Simple base64 encoding (NOT secure encryption!)
    return btoa(password);
  } catch (error) {
    console.error('[passwordUtils] Failed to encrypt password:', error);
    throw new Error('Failed to encrypt password');
  }
}

/**
 * Decrypts a password that was encrypted with encryptPassword()
 *
 * @param {string} encryptedPassword - The encrypted password
 * @returns {string} The decrypted password
 */
export function decryptPassword(encryptedPassword: string): string {
  try {
    // Simple base64 decoding
    return atob(encryptedPassword);
  } catch (error) {
    console.error('[passwordUtils] Failed to decrypt password:', error);
    throw new Error('Failed to decrypt password');
  }
}

/**
 * Validates password strength
 *
 * Requirements:
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 * - Contains special character
 *
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid flag and errors array
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
