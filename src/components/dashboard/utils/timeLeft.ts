export type TimeLeftLabels = { ended: string; day: string; hour: string; minute: string }

export function timeLeft(
  endTime: string,
  labels: TimeLeftLabels
) {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}
