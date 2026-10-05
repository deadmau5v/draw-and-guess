export { extraAvatars, resolveAvatar, DEFAULT_AVATAR } from '../../shared/avatars';
import { resolveAvatar } from '../../shared/avatars';
export function readPlayerAvatar(): string {
  try { return resolveAvatar(localStorage.getItem('turtle:avatar')); }
  catch { return resolveAvatar(null); }
}
