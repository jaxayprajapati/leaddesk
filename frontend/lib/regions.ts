// Countries LeadDesk agencies pick from at sign-up: each sets the currency, phone calling code and a starting timezone.
// Anything else can be typed in Settings (any ISO currency, any IANA timezone).
export type RegionDefaults = { code: string; name: string; currency: string; calling: string; tz: string }

export const COUNTRIES: RegionDefaults[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", calling: "971", tz: "Asia/Dubai" },
  { code: "AU", name: "Australia", currency: "AUD", calling: "61", tz: "Australia/Sydney" },
  { code: "BR", name: "Brazil", currency: "BRL", calling: "55", tz: "America/Sao_Paulo" },
  { code: "CA", name: "Canada", currency: "CAD", calling: "1", tz: "America/Toronto" },
  { code: "DE", name: "Germany", currency: "EUR", calling: "49", tz: "Europe/Berlin" },
  { code: "EG", name: "Egypt", currency: "EGP", calling: "20", tz: "Africa/Cairo" },
  { code: "ES", name: "Spain", currency: "EUR", calling: "34", tz: "Europe/Madrid" },
  { code: "FR", name: "France", currency: "EUR", calling: "33", tz: "Europe/Paris" },
  { code: "GB", name: "United Kingdom", currency: "GBP", calling: "44", tz: "Europe/London" },
  { code: "HK", name: "Hong Kong", currency: "HKD", calling: "852", tz: "Asia/Hong_Kong" },
  { code: "ID", name: "Indonesia", currency: "IDR", calling: "62", tz: "Asia/Jakarta" },
  { code: "IE", name: "Ireland", currency: "EUR", calling: "353", tz: "Europe/Dublin" },
  { code: "IN", name: "India", currency: "INR", calling: "91", tz: "Asia/Kolkata" },
  { code: "IT", name: "Italy", currency: "EUR", calling: "39", tz: "Europe/Rome" },
  { code: "JP", name: "Japan", currency: "JPY", calling: "81", tz: "Asia/Tokyo" },
  { code: "KE", name: "Kenya", currency: "KES", calling: "254", tz: "Africa/Nairobi" },
  { code: "MX", name: "Mexico", currency: "MXN", calling: "52", tz: "America/Mexico_City" },
  { code: "MY", name: "Malaysia", currency: "MYR", calling: "60", tz: "Asia/Kuala_Lumpur" },
  { code: "NG", name: "Nigeria", currency: "NGN", calling: "234", tz: "Africa/Lagos" },
  { code: "NL", name: "Netherlands", currency: "EUR", calling: "31", tz: "Europe/Amsterdam" },
  { code: "NZ", name: "New Zealand", currency: "NZD", calling: "64", tz: "Pacific/Auckland" },
  { code: "PH", name: "Philippines", currency: "PHP", calling: "63", tz: "Asia/Manila" },
  { code: "PK", name: "Pakistan", currency: "PKR", calling: "92", tz: "Asia/Karachi" },
  { code: "PT", name: "Portugal", currency: "EUR", calling: "351", tz: "Europe/Lisbon" },
  { code: "QA", name: "Qatar", currency: "QAR", calling: "974", tz: "Asia/Qatar" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", calling: "966", tz: "Asia/Riyadh" },
  { code: "SG", name: "Singapore", currency: "SGD", calling: "65", tz: "Asia/Singapore" },
  { code: "TH", name: "Thailand", currency: "THB", calling: "66", tz: "Asia/Bangkok" },
  { code: "TR", name: "Türkiye", currency: "TRY", calling: "90", tz: "Europe/Istanbul" },
  { code: "US", name: "United States", currency: "USD", calling: "1", tz: "America/New_York" },
  { code: "ZA", name: "South Africa", currency: "ZAR", calling: "27", tz: "Africa/Johannesburg" },
]

export const byCode = (code: string) => COUNTRIES.find((c) => c.code === code)

/** The browser's own country and timezone, as a starting guess for sign-up. */
// Older names some browsers still report for a timezone.
const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
}

export function guessRegion(): { country: string; tz: string } {
  const raw = Intl.DateTimeFormat().resolvedOptions().timeZone
  const tz = ALIASES[raw] ?? raw
  const fromTz = COUNTRIES.find((c) => c.tz === tz)?.code
  const fromLang = navigator.language.split("-")[1]?.toUpperCase()
  return { country: fromTz ?? (fromLang && byCode(fromLang) ? fromLang : "US"), tz }
}

export function timezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    return COUNTRIES.map((c) => c.tz)
  }
}
