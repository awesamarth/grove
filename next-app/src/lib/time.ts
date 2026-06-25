export function timeAgo(happenedAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - happenedAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
