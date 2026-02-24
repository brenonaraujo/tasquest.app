export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (!path) {
    return "/";
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedPath;
}
