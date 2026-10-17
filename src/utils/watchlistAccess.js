import { PermissionFlagsBits } from 'discord.js';

const WATCHLIST_ACCESS_ROLE_IDS = new Set([
  '1507805275309080628',
  '1508160151788720348',
  '1507804900728508527',
  '1507805150905897011'
]);

export function hasWatchlistAccess(member) {
  return Boolean(
    member && (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.roles.cache.some((role) => WATCHLIST_ACCESS_ROLE_IDS.has(role.id))
    )
  );
}