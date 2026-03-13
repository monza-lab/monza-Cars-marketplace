import React from "react"
import { getLocale } from "next-intl/server"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Privacy Policy | Monza Lab",
    es: "Política de Privacidad | Monza Lab",
    de: "Datenschutzerklärung | Monza Lab",
    ja: "プライバシーポリシー | Monza Lab",
  }
  return { title: titles[locale] || titles.en }
}

const LAST_UPDATED = "March 1, 2025"

function EnContent() {
  return (
    <>
      <p>Last updated: {LAST_UPDATED}</p>

      <h2>1. Information We Collect</h2>
      <p>
        Monza Lab (&quot;we&quot;, &quot;us&quot;) collects the following information when you use our platform:
      </p>
      <ul>
        <li><strong>Account information</strong>: email address provided during registration via our authentication provider (Supabase Auth).</li>
        <li><strong>Usage preferences</strong>: brand and model preferences selected during onboarding, stored locally on your device.</li>
        <li><strong>Analytics data</strong>: anonymized usage metrics collected via Vercel Analytics to improve service quality.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide and personalize our collector vehicle marketplace services.</li>
        <li>To generate investment reports and market analysis.</li>
        <li>To improve platform performance and user experience.</li>
        <li>To communicate service updates when necessary.</li>
      </ul>

      <h2>3. Data Storage and Security</h2>
      <p>
        Your account data is stored securely through Supabase infrastructure with encryption at rest and in transit.
        Onboarding preferences are stored exclusively in your browser&apos;s local storage and are never transmitted to our servers.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>We use the following third-party services:</p>
      <ul>
        <li><strong>Supabase</strong>: Authentication and database services.</li>
        <li><strong>Vercel</strong>: Hosting, analytics, and performance monitoring.</li>
      </ul>

      <h2>5. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request deletion of your account and associated data.</li>
        <li>Opt out of analytics tracking via your browser settings.</li>
      </ul>

      <h2>6. California Residents (CCPA)</h2>
      <p>
        If you are a California resident, you have the right to know what personal information we collect, request its deletion,
        and opt out of any sale of personal information. We do not sell personal information.
      </p>

      <h2>7. Contact</h2>
      <p>For privacy inquiries, contact us at <strong>privacy@monzalab.com</strong>.</p>
    </>
  )
}

function EsContent() {
  return (
    <>
      <p>Última actualización: 1 de marzo de 2025</p>

      <h2>1. Información que Recopilamos</h2>
      <p>
        Monza Lab (&quot;nosotros&quot;) recopila la siguiente información cuando utilizas nuestra plataforma:
      </p>
      <ul>
        <li><strong>Información de cuenta</strong>: dirección de correo electrónico proporcionada durante el registro a través de nuestro proveedor de autenticación (Supabase Auth).</li>
        <li><strong>Preferencias de uso</strong>: preferencias de marca y modelo seleccionadas durante la incorporación, almacenadas localmente en tu dispositivo.</li>
        <li><strong>Datos analíticos</strong>: métricas de uso anonimizadas recopiladas a través de Vercel Analytics para mejorar la calidad del servicio.</li>
      </ul>

      <h2>2. Cómo Usamos tu Información</h2>
      <ul>
        <li>Para proporcionar y personalizar nuestros servicios de marketplace de vehículos de colección.</li>
        <li>Para generar informes de inversión y análisis de mercado.</li>
        <li>Para mejorar el rendimiento de la plataforma y la experiencia del usuario.</li>
        <li>Para comunicar actualizaciones del servicio cuando sea necesario.</li>
      </ul>

      <h2>3. Almacenamiento y Seguridad</h2>
      <p>
        Los datos de tu cuenta se almacenan de forma segura a través de la infraestructura de Supabase con cifrado en reposo y en tránsito.
        Las preferencias de incorporación se almacenan exclusivamente en el almacenamiento local de tu navegador y nunca se transmiten a nuestros servidores.
      </p>

      <h2>4. Servicios de Terceros</h2>
      <p>Utilizamos los siguientes servicios de terceros:</p>
      <ul>
        <li><strong>Supabase</strong>: Servicios de autenticación y base de datos.</li>
        <li><strong>Vercel</strong>: Alojamiento, analítica y monitoreo de rendimiento.</li>
      </ul>

      <h2>5. Tus Derechos (RGPD)</h2>
      <p>De acuerdo con el Reglamento General de Protección de Datos (RGPD), tienes derecho a:</p>
      <ul>
        <li>Acceder a los datos personales que tenemos sobre ti.</li>
        <li>Solicitar la rectificación o eliminación de tus datos.</li>
        <li>Oponerte al tratamiento de tus datos personales.</li>
        <li>Solicitar la portabilidad de tus datos.</li>
        <li>Retirar tu consentimiento en cualquier momento.</li>
      </ul>

      <h2>6. Contacto</h2>
      <p>Para consultas sobre privacidad, contáctanos en <strong>privacy@monzalab.com</strong>.</p>
    </>
  )
}

function DeContent() {
  return (
    <>
      <p>Zuletzt aktualisiert: 1. März 2025</p>

      <h2>1. Erhobene Daten</h2>
      <p>
        Monza Lab (&quot;wir&quot;, &quot;uns&quot;) erhebt folgende Daten bei der Nutzung unserer Plattform:
      </p>
      <ul>
        <li><strong>Kontoinformationen</strong>: E-Mail-Adresse, die bei der Registrierung über unseren Authentifizierungsanbieter (Supabase Auth) angegeben wird.</li>
        <li><strong>Nutzungspräferenzen</strong>: Marken- und Modellpräferenzen, die während des Onboardings ausgewählt und lokal auf Ihrem Gerät gespeichert werden.</li>
        <li><strong>Analysedaten</strong>: Anonymisierte Nutzungsmetriken, die über Vercel Analytics zur Verbesserung der Servicequalität erfasst werden.</li>
      </ul>

      <h2>2. Verwendung Ihrer Daten</h2>
      <ul>
        <li>Bereitstellung und Personalisierung unserer Sammlerfahrzeug-Marktplatz-Dienste.</li>
        <li>Erstellung von Investitionsberichten und Marktanalysen.</li>
        <li>Verbesserung der Plattformleistung und Benutzererfahrung.</li>
        <li>Kommunikation von Service-Updates bei Bedarf.</li>
      </ul>

      <h2>3. Datenspeicherung und Sicherheit</h2>
      <p>
        Ihre Kontodaten werden sicher über die Supabase-Infrastruktur mit Verschlüsselung im Ruhezustand und bei der Übertragung gespeichert.
        Onboarding-Präferenzen werden ausschließlich im lokalen Speicher Ihres Browsers gespeichert und niemals an unsere Server übertragen.
      </p>

      <h2>4. Drittanbieter-Dienste</h2>
      <p>Wir nutzen folgende Drittanbieter-Dienste:</p>
      <ul>
        <li><strong>Supabase</strong>: Authentifizierungs- und Datenbankdienste.</li>
        <li><strong>Vercel</strong>: Hosting, Analytik und Leistungsüberwachung.</li>
      </ul>

      <h2>5. Ihre Rechte (DSGVO)</h2>
      <p>Gemäß der Datenschutz-Grundverordnung (DSGVO) haben Sie das Recht auf:</p>
      <ul>
        <li>Auskunft über die von uns gespeicherten personenbezogenen Daten.</li>
        <li>Berichtigung oder Löschung Ihrer Daten.</li>
        <li>Einschränkung der Verarbeitung Ihrer personenbezogenen Daten.</li>
        <li>Datenübertragbarkeit.</li>
        <li>Widerspruch gegen die Verarbeitung.</li>
        <li>Widerruf Ihrer Einwilligung jederzeit.</li>
        <li>Beschwerde bei einer Aufsichtsbehörde.</li>
      </ul>

      <h2>6. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung: Monza Lab.<br />
        Kontakt für Datenschutzanfragen: <strong>privacy@monzalab.com</strong>
      </p>
    </>
  )
}

function JaContent() {
  return (
    <>
      <p>最終更新日：2025年3月1日</p>

      <h2>1. 収集する情報</h2>
      <p>
        Monza Lab（以下「当社」）は、プラットフォームのご利用時に以下の情報を収集します：
      </p>
      <ul>
        <li><strong>アカウント情報</strong>：認証プロバイダー（Supabase Auth）を通じた登録時に提供されるメールアドレス。</li>
        <li><strong>利用設定</strong>：オンボーディング時に選択されたブランドおよびモデルの設定。お使いのデバイスにローカル保存されます。</li>
        <li><strong>分析データ</strong>：サービス品質向上のためVercel Analyticsを通じて収集される匿名化された利用指標。</li>
      </ul>

      <h2>2. 情報の利用目的</h2>
      <ul>
        <li>コレクター車両マーケットプレイスサービスの提供およびパーソナライズ。</li>
        <li>投資レポートおよび市場分析の生成。</li>
        <li>プラットフォームのパフォーマンスおよびユーザー体験の向上。</li>
        <li>必要に応じたサービス更新の通知。</li>
      </ul>

      <h2>3. データの保存とセキュリティ</h2>
      <p>
        お客様のアカウントデータは、Subaseインフラストラクチャを通じて、保存時および転送時の暗号化により安全に保存されます。
        オンボーディング設定はブラウザのローカルストレージにのみ保存され、当社のサーバーに送信されることはありません。
      </p>

      <h2>4. 第三者サービス</h2>
      <p>以下の第三者サービスを利用しています：</p>
      <ul>
        <li><strong>Supabase</strong>：認証およびデータベースサービス。</li>
        <li><strong>Vercel</strong>：ホスティング、分析、パフォーマンス監視。</li>
      </ul>

      <h2>5. お客様の権利（個人情報保護法）</h2>
      <p>個人情報の保護に関する法律（APPI）に基づき、お客様は以下の権利を有します：</p>
      <ul>
        <li>当社が保有する個人データの開示を請求する権利。</li>
        <li>個人データの訂正または削除を請求する権利。</li>
        <li>個人データの利用停止を請求する権利。</li>
      </ul>

      <h2>6. お問い合わせ</h2>
      <p>プライバシーに関するお問い合わせは <strong>privacy@monzalab.com</strong> までご連絡ください。</p>
    </>
  )
}

const CONTENT: Record<string, () => React.JSX.Element> = {
  en: EnContent,
  es: EsContent,
  de: DeContent,
  ja: JaContent,
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const Content = CONTENT[locale] || CONTENT.en
  const backLabels: Record<string, string> = { en: "Back", es: "Volver", de: "Zurück", ja: "戻る" }
  const titles: Record<string, string> = {
    en: "Privacy Policy",
    es: "Política de Privacidad",
    de: "Datenschutzerklärung",
    ja: "プライバシーポリシー",
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <article className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors mb-8"
        >
          <ArrowLeft className="size-3" />
          {backLabels[locale] || backLabels.en}
        </Link>

        <h1 className="text-2xl font-display font-light text-foreground mb-2">{titles[locale] || titles.en}</h1>

        <div className="prose-legal mt-8 space-y-4 text-[13px] leading-relaxed text-muted-foreground [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-muted-foreground [&_a]:text-primary [&_a]:underline">
          <Content />
        </div>
      </article>
    </div>
  )
}
