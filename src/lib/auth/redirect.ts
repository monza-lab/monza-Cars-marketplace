export function currentAuthReturnPath(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`
}

export function buildAuthRedirectUrl({
  origin,
  callbackPath,
  returnPath,
}: {
  origin: string
  callbackPath: "/auth/callback" | "/auth/confirm"
  returnPath: string
}): string {
  const url = new URL(callbackPath, origin)
  url.searchParams.set("next", returnPath || "/")
  return url.toString()
}
