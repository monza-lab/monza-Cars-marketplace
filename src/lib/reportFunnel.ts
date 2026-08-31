export const REPORT_GENERATED_DEVICE_KEY = "monzahaus_first_report_generated"
export const REPORT_CTA_EVENT = "monzahaus:report-cta-clicked"
export const REPORT_GENERATED_EVENT = "monzahaus:report-generated"
export const COOKIE_BANNER_VISIBILITY_EVENT = "monzahaus:cookie-banner-visibility"

export function markReportCtaClicked() {
  window.sessionStorage.setItem(REPORT_CTA_EVENT, "true")
  window.dispatchEvent(new Event(REPORT_CTA_EVENT))
}

export function markFirstReportGenerated() {
  window.localStorage.setItem(REPORT_GENERATED_DEVICE_KEY, "true")
  window.dispatchEvent(new Event(REPORT_GENERATED_EVENT))
}
