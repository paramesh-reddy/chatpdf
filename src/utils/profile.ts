/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ApiService from '../api.ts';

export function getProfileDisplayName(): string {
  const stored = ApiService.getDisplayName();
  if (stored) return stored;

  const email = ApiService.getEmail() || '';
  const local = email.split('@')[0] || 'User';
  if (local.length <= 2) return 'User';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
