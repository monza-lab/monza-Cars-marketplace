import React from "react"
import { getLocale } from "next-intl/server"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Cookie Policy | MonzaHaus",
    es: "Política de Cookies | MonzaHaus",
    de: "Cookie-Richtlinie | MonzaHaus",
    ja: "Cookieポリシー | MonzaHaus",
  }
  return { title: titles[locale] || titles.en }
}

const EFFECTIVE_DATE = "May 10, 2026"

interface CookieRow {
  name: string
  vendor: string
  purpose: string
  duration: string
  category: "essential" | "analytics" | "advertising"
}

const COOKIES: CookieRow[] = [
  // Essential — set without consent (strictly necessary)
  { name: "sb-access-token, sb-refresh-token", vendor: "Supabase Auth", purpose: "Authenticate your session and keep you signed in.", duration: "Session / 1 year", category: "essential" },
  { name: "monzahaus_cookie_consent", vendor: "MonzaHaus", purpose: "Remembers your cookie preferences so we don't ask again.", duration: "12 months", category: "essential" },
  { name: "monzahaus_user, monzahaus_plan", vendor: "MonzaHaus", purpose: "Stores local preferences (currency, view mode, recent searches).", duration: "Persistent (localStorage)", category: "essential" },
  // Analytics — only when user accepts
  { name: "_vercel_analytics", vendor: "Vercel Analytics", purpose: "Counts page views and route visits in aggregate; no user-level tracking.", duration: "Session", category: "analytics" },
  { name: "vitals", vendor: "Vercel Speed Insights", purpose: "Measures Core Web Vitals (page-load metrics).", duration: "Session", category: "analytics" },
  { name: "_ga, _ga_*, _gid", vendor: "Google Analytics 4", purpose: "Aggregate audience analytics with IP anonymization enabled.", duration: "Up to 2 years", category: "analytics" },
  // Advertising — only when user accepts
  { name: "_fbp", vendor: "Meta (Facebook) Pixel", purpose: "Identifies a browser for ad attribution and conversion measurement.", duration: "3 months", category: "advertising" },
  { name: "_fbc", vendor: "Meta (Facebook) Pixel", purpose: "Stores the click-id when you arrive from a Meta ad, for attribution.", duration: "7 days", category: "advertising" },
]

const CATEGORY_LABELS: Record<CookieRow["category"], { label: string; color: string }> = {
  essential: { label: "Essential", color: "text-foreground" },
  analytics: { label: "Analytics", color: "text-positive" },
  advertising: { label: "Advertising", color: "text-warning" },
}

function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
    <div className="not-prose mt-4 mb-8 overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 font-semibold tracking-[0.18em] text-[10px] uppercase text-muted-foreground">Cookie / storage</th>
            <th className="text-left py-2 pr-4 font-semibold tracking-[0.18em] text-[10px] uppercase text-muted-foreground">Vendor</th>
            <th className="text-left py-2 pr-4 font-semibold tracking-[0.18em] text-[10px] uppercase text-muted-foreground">Purpose</th>
            <th className="text-left py-2 pr-4 font-semibold tracking-[0.18em] text-[10px] uppercase text-muted-foreground">Duration</th>
            <th className="text-left py-2 font-semibold tracking-[0.18em] text-[10px] uppercase text-muted-foreground">Category</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 align-top">
              <td className="py-3 pr-4 font-mono text-[11px] text-foreground/85">{row.name}</td>
              <td className="py-3 pr-4 text-foreground/80">{row.vendor}</td>
              <td className="py-3 pr-4 text-foreground/80">{row.purpose}</td>
              <td className="py-3 pr-4 text-foreground/70">{row.duration}</td>
              <td className={`py-3 ${CATEGORY_LABELS[row.category].color}`}>{CATEGORY_LABELS[row.category].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Last updated: {EFFECTIVE_DATE}</p>

      <p>
        This Cookie Policy explains how Monza Lab LLC (&ldquo;we&rdquo;) uses cookies and similar technologies on monzahaus.com. It complements our{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>, which describes how we handle personal data more broadly.
      </p>

      <h2>What is a cookie?</h2>
      <p>
        A cookie is a small text file that a website places on your device to remember information across sessions. We also use related
        technologies — pixels, web beacons, and browser local storage — which we collectively call &ldquo;cookies&rdquo; in this Policy.
      </p>

      <h2>Categories we use</h2>
      <ul>
        <li>
          <strong>Essential</strong> — required for the site to function (sign-in, your cookie choices, your interface preferences). These cannot
          be disabled, and we set them without your consent because the site cannot operate without them.
        </li>
        <li>
          <strong>Analytics</strong> — help us understand how the product is used, in aggregate, so we can improve it (Vercel Analytics, Vercel
          Speed Insights, Google Analytics with IP anonymization). Loaded only when you accept.
        </li>
        <li>
          <strong>Advertising</strong> — measure the effectiveness of campaigns and attribute conversions (Meta Pixel and the Conversions API).
          Loaded only when you accept. Under the California CPRA this counts as &ldquo;sharing&rdquo;; you can opt out at any time.
        </li>
      </ul>

      <h2>Detailed inventory</h2>
      <p>The following list is exhaustive. If we add a tool, this page is updated and your stored choice is reset so you can re-decide.</p>
      <CookieTable rows={COOKIES} />

      <h2>Your choices</h2>
      <p>
        On your first visit a banner asks you to <em>Accept</em> or <em>Reject</em> non-essential cookies. Both options are equally prominent and
        nothing is pre-checked. No analytics or advertising cookie loads before you accept.
      </p>
      <p>
        You can change your mind at any time using the <Link href="/legal/cookies">Cookie preferences</Link> link in our footer, or by clearing
        cookies for monzahaus.com in your browser. We also automatically honor the Global Privacy Control (GPC) signal: if your browser sends GPC,
        we treat your visit as an opt-out of advertising cookies regardless of the banner state.
      </p>

      <h2>Browser settings</h2>
      <p>
        Most browsers let you block or delete cookies. Disabling essential cookies will break sign-in and other features. Useful links: Chrome,
        Safari, Firefox, Edge, and Brave each document cookie settings under their privacy or security menus.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this Policy? Write to <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> or see our{" "}
        <Link href="/legal/privacy">Privacy Policy</Link> for the full data practices document.
      </p>
    </>
  )
}

function EsContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Última actualización: {EFFECTIVE_DATE}</p>
      <p>
        Esta Política de Cookies explica cómo Monza Lab LLC (&ldquo;nosotros&rdquo;) utiliza cookies y tecnologías similares en monzahaus.com.
        Complementa nuestra <Link href="/legal/privacy">Política de Privacidad</Link>.
      </p>
      <h2>Qué es una cookie</h2>
      <p>Una cookie es un pequeño archivo de texto que un sitio web coloca en tu dispositivo para recordar información entre sesiones. También utilizamos píxeles, web beacons y almacenamiento local del navegador, colectivamente referidos como &ldquo;cookies&rdquo;.</p>
      <h2>Categorías</h2>
      <ul>
        <li><strong>Esenciales</strong>: necesarias para que el sitio funcione (sesión, tus elecciones de cookies, preferencias). No pueden desactivarse.</li>
        <li><strong>Analíticas</strong>: nos ayudan a entender el uso del producto en agregado (Vercel Analytics, Vercel Speed Insights, Google Analytics con IP anonimizada). Se cargan solo si aceptas.</li>
        <li><strong>Publicidad</strong>: medición de campañas (Meta Pixel y Conversions API). Se cargan solo si aceptas. Bajo CPRA esto cuenta como &ldquo;compartir&rdquo;; puedes optar por no participar en cualquier momento.</li>
      </ul>
      <h2>Inventario detallado</h2>
      <p>La siguiente lista es exhaustiva. Si agregamos una herramienta, esta página se actualiza y tu elección guardada se reinicia.</p>
      <CookieTable rows={COOKIES} />
      <h2>Tus opciones</h2>
      <p>
        En tu primera visita, un banner te pide <em>Aceptar</em> o <em>Rechazar</em> las cookies no esenciales. Ambas opciones tienen igual
        prominencia y nada está pre-seleccionado. Ninguna cookie analítica o publicitaria se carga antes de tu aceptación.
      </p>
      <p>
        Puedes cambiar tu decisión en cualquier momento mediante el enlace <Link href="/legal/cookies">Preferencias de cookies</Link> en el footer.
        Honoramos automáticamente la señal Global Privacy Control (GPC).
      </p>
      <h2>Contacto</h2>
      <p>
        Preguntas: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> ·{" "}
        <Link href="/legal/privacy">Política de Privacidad</Link>.
      </p>
    </>
  )
}

function DeContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Zuletzt aktualisiert: {EFFECTIVE_DATE}</p>
      <p>
        Diese Cookie-Richtlinie erläutert, wie Monza Lab LLC (&bdquo;wir&ldquo;) Cookies und ähnliche Technologien auf monzahaus.com einsetzt. Sie
        ergänzt unsere <Link href="/legal/privacy">Datenschutzerklärung</Link>.
      </p>
      <h2>Was ist ein Cookie</h2>
      <p>Ein Cookie ist eine kleine Textdatei, die eine Website auf Ihrem Gerät speichert, um Informationen über Sitzungen hinweg zu merken. Wir verwenden außerdem Pixel, Web Beacons und Browser-LocalStorage, die wir gemeinsam als &bdquo;Cookies&ldquo; bezeichnen.</p>
      <h2>Kategorien</h2>
      <ul>
        <li><strong>Notwendig</strong>: zum Betrieb der Website erforderlich (Anmeldung, Cookie-Wahl, Präferenzen). Können nicht deaktiviert werden.</li>
        <li><strong>Analytics</strong>: aggregierte Nutzungsanalyse (Vercel Analytics, Vercel Speed Insights, Google Analytics mit IP-Anonymisierung). Nur nach Einwilligung.</li>
        <li><strong>Werbung</strong>: Kampagnenmessung (Meta Pixel und Conversions API). Nur nach Einwilligung.</li>
      </ul>
      <h2>Detailliertes Inventar</h2>
      <CookieTable rows={COOKIES} />
      <h2>Ihre Wahl</h2>
      <p>
        Bei Ihrem ersten Besuch fragt ein Banner nach <em>Akzeptieren</em> oder <em>Ablehnen</em> nicht-notwendiger Cookies. Beide Optionen sind
        gleich prominent dargestellt und nichts ist vorausgewählt. Sie können Ihre Wahl jederzeit über den Link{" "}
        <Link href="/legal/cookies">Cookie-Einstellungen</Link> im Footer ändern. Wir berücksichtigen automatisch das Global-Privacy-Control-Signal
        (GPC).
      </p>
      <h2>Kontakt</h2>
      <p>
        Fragen: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> ·{" "}
        <Link href="/legal/privacy">Datenschutzerklärung</Link>.
      </p>
    </>
  )
}

function JaContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">最終更新日: {EFFECTIVE_DATE}</p>
      <p>
        本Cookieポリシーは、Monza Lab LLC（以下「当社」）がmonzahaus.comでCookieおよび類似技術をどのように使用するかを説明します。
        当社の <Link href="/legal/privacy">プライバシーポリシー</Link> を補完するものです。
      </p>
      <h2>Cookieとは</h2>
      <p>Cookieは、ウェブサイトがセッションを跨いで情報を記憶するためにお客様のデバイスに保存する小さなテキストファイルです。本ポリシーではピクセル、ウェブビーコン、ブラウザのlocalStorage等の関連技術も総称して「Cookie」と呼びます。</p>
      <h2>カテゴリ</h2>
      <ul>
        <li><strong>必須</strong>: サイトの動作に必要（サインイン、Cookie設定、表示設定等）。無効化できません。</li>
        <li><strong>分析</strong>: プロダクトの集計利用状況の理解（Vercel Analytics、Vercel Speed Insights、IP匿名化付きGoogle Analytics）。同意時のみ読み込み。</li>
        <li><strong>広告</strong>: キャンペーン測定（Meta PixelおよびConversions API）。同意時のみ読み込み。</li>
      </ul>
      <h2>詳細リスト</h2>
      <CookieTable rows={COOKIES} />
      <h2>選択について</h2>
      <p>
        初回訪問時にバナーで非必須Cookieの<em>「同意する」</em>または<em>「拒否する」</em>を選択いただきます。両オプションは同等のプロミネンスで表示され、事前選択はありません。
        いつでもフッターの <Link href="/legal/cookies">Cookie設定</Link> から変更できます。Global Privacy Control（GPC）シグナルも自動で尊重します。
      </p>
      <h2>お問い合わせ</h2>
      <p>
        ご質問: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> ·{" "}
        <Link href="/legal/privacy">プライバシーポリシー</Link>.
      </p>
    </>
  )
}

const CONTENT: Record<string, () => React.JSX.Element> = {
  en: EnContent,
  es: EsContent,
  de: DeContent,
  ja: JaContent,
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const Content = CONTENT[locale] || CONTENT.en
  const backLabels: Record<string, string> = { en: "Back", es: "Volver", de: "Zurück", ja: "戻る" }
  const titles: Record<string, string> = {
    en: "Cookie Policy",
    es: "Política de Cookies",
    de: "Cookie-Richtlinie",
    ja: "Cookieポリシー",
  }

  return (
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-16 px-6">
      <article className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3" />
          {backLabels[locale] || backLabels.en}
        </Link>

        <h1 className="font-display text-[28px] md:text-[36px] font-medium text-foreground mb-2">
          {titles[locale] || titles.en}
        </h1>

        <div className="prose-legal mt-8 space-y-4 text-[13px] leading-relaxed text-foreground/80 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_em]:text-foreground [&_em]:not-italic [&_em]:font-medium">
          <Content />
        </div>
      </article>
    </div>
  )
}
