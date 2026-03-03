import React from "react"
import { getLocale } from "next-intl/server"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Terms of Service | Monza Lab",
    es: "Términos de Servicio | Monza Lab",
    de: "Nutzungsbedingungen | Monza Lab",
    ja: "利用規約 | Monza Lab",
  }
  return { title: titles[locale] || titles.en }
}

function EnContent() {
  return (
    <>
      <p>Last updated: March 1, 2025</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Monza Lab (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
        If you do not agree, please do not use the Platform.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Monza Lab is a collector vehicle marketplace and analysis platform. We provide market data, investment analysis,
        and listing aggregation for informational purposes. We are not a licensed broker, dealer, or financial advisor.
      </p>

      <h2>3. Investment Disclaimer</h2>
      <p>
        <strong>All investment grades, valuations, and market analyses provided on this platform are for informational purposes only
        and do not constitute financial, investment, or legal advice.</strong> Collector vehicle values are inherently volatile
        and past performance does not guarantee future results. Always conduct your own due diligence and consult qualified
        professionals before making purchase decisions.
      </p>

      <h2>4. User Accounts</h2>
      <ul>
        <li>You must provide a valid email address to create an account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You may not use the Platform for any unlawful purpose.</li>
      </ul>

      <h2>5. Intellectual Property</h2>
      <p>
        All content, design, and analysis produced by Monza Lab is protected by copyright. You may not reproduce, distribute,
        or create derivative works without express written permission.
      </p>

      <h2>6. Listing Data</h2>
      <p>
        Vehicle listings and auction data are aggregated from third-party sources. While we strive for accuracy,
        we do not guarantee the completeness or accuracy of listing information. Verify all details independently before transacting.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        Monza Lab is provided &quot;as is&quot; without warranties of any kind. We are not liable for any losses arising
        from your use of the Platform or reliance on information provided herein.
      </p>

      <h2>8. Modifications</h2>
      <p>
        We reserve the right to modify these terms at any time. Continued use of the Platform after changes constitutes acceptance.
      </p>

      <h2>9. Contact</h2>
      <p>For questions about these terms, contact us at <strong>legal@monzalab.com</strong>.</p>
    </>
  )
}

function EsContent() {
  return (
    <>
      <p>Última actualización: 1 de marzo de 2025</p>

      <h2>1. Aceptación de los Términos</h2>
      <p>
        Al acceder o utilizar Monza Lab (&quot;la Plataforma&quot;), aceptas regirte por estos Términos de Servicio.
        Si no estás de acuerdo, por favor no utilices la Plataforma.
      </p>

      <h2>2. Descripción del Servicio</h2>
      <p>
        Monza Lab es una plataforma de marketplace y análisis de vehículos de colección. Proporcionamos datos de mercado,
        análisis de inversión y agregación de listados con fines informativos. No somos un corredor, comerciante o asesor financiero autorizado.
      </p>

      <h2>3. Descargo de Responsabilidad sobre Inversiones</h2>
      <p>
        <strong>Todos los grados de inversión, valoraciones y análisis de mercado proporcionados en esta plataforma son únicamente
        con fines informativos y no constituyen asesoramiento financiero, de inversión o legal.</strong> Los valores de los vehículos
        de colección son inherentemente volátiles y el rendimiento pasado no garantiza resultados futuros. Siempre realiza tu propia
        diligencia debida y consulta a profesionales cualificados antes de tomar decisiones de compra.
      </p>

      <h2>4. Cuentas de Usuario</h2>
      <ul>
        <li>Debes proporcionar una dirección de correo electrónico válida para crear una cuenta.</li>
        <li>Eres responsable de mantener la seguridad de tus credenciales de cuenta.</li>
        <li>No puedes utilizar la Plataforma para ningún propósito ilegal.</li>
      </ul>

      <h2>5. Propiedad Intelectual</h2>
      <p>
        Todo el contenido, diseño y análisis producido por Monza Lab está protegido por derechos de autor. No puedes reproducir,
        distribuir ni crear obras derivadas sin permiso expreso por escrito.
      </p>

      <h2>6. Datos de Listados</h2>
      <p>
        Los listados de vehículos y datos de subastas se agregan de fuentes de terceros. Aunque nos esforzamos por la precisión,
        no garantizamos la integridad o exactitud de la información de los listados. Verifica todos los detalles de forma independiente antes de realizar transacciones.
      </p>

      <h2>7. Limitación de Responsabilidad</h2>
      <p>
        Monza Lab se proporciona &quot;tal cual&quot; sin garantías de ningún tipo. No somos responsables de ninguna pérdida
        derivada del uso de la Plataforma o la confianza en la información proporcionada.
      </p>

      <h2>8. Modificaciones</h2>
      <p>
        Nos reservamos el derecho de modificar estos términos en cualquier momento. El uso continuado de la Plataforma
        después de los cambios constituye aceptación.
      </p>

      <h2>9. Contacto</h2>
      <p>Para preguntas sobre estos términos, contáctanos en <strong>legal@monzalab.com</strong>.</p>
    </>
  )
}

function DeContent() {
  return (
    <>
      <p>Zuletzt aktualisiert: 1. März 2025</p>

      <h2>1. Annahme der Nutzungsbedingungen</h2>
      <p>
        Durch den Zugriff auf oder die Nutzung von Monza Lab (&quot;die Plattform&quot;) erklären Sie sich mit diesen
        Nutzungsbedingungen einverstanden. Wenn Sie nicht einverstanden sind, nutzen Sie die Plattform bitte nicht.
      </p>

      <h2>2. Beschreibung des Dienstes</h2>
      <p>
        Monza Lab ist eine Marktplatz- und Analyseplattform für Sammlerfahrzeuge. Wir stellen Marktdaten, Investitionsanalysen
        und Listing-Aggregation zu Informationszwecken bereit. Wir sind kein lizenzierter Makler, Händler oder Finanzberater.
      </p>

      <h2>3. Haftungsausschluss für Investitionen</h2>
      <p>
        <strong>Alle auf dieser Plattform bereitgestellten Investmentbewertungen, Bewertungen und Marktanalysen dienen
        ausschließlich Informationszwecken und stellen keine Finanz-, Anlage- oder Rechtsberatung dar.</strong> Die Werte
        von Sammlerfahrzeugen sind von Natur aus volatil und vergangene Ergebnisse garantieren keine zukünftigen Ergebnisse.
        Führen Sie stets Ihre eigene Sorgfaltsprüfung durch und konsultieren Sie qualifizierte Fachleute, bevor Sie Kaufentscheidungen treffen.
      </p>

      <h2>4. Benutzerkonten</h2>
      <ul>
        <li>Sie müssen eine gültige E-Mail-Adresse angeben, um ein Konto zu erstellen.</li>
        <li>Sie sind für die Sicherheit Ihrer Kontoanmeldedaten verantwortlich.</li>
        <li>Sie dürfen die Plattform nicht für rechtswidrige Zwecke nutzen.</li>
      </ul>

      <h2>5. Geistiges Eigentum</h2>
      <p>
        Alle von Monza Lab produzierten Inhalte, Designs und Analysen sind urheberrechtlich geschützt. Sie dürfen ohne
        ausdrückliche schriftliche Genehmigung nicht vervielfältigt, verbreitet oder abgeleitete Werke erstellt werden.
      </p>

      <h2>6. Fahrzeugdaten</h2>
      <p>
        Fahrzeugangebote und Auktionsdaten werden aus Drittquellen aggregiert. Obwohl wir um Genauigkeit bemüht sind,
        garantieren wir nicht die Vollständigkeit oder Richtigkeit der Angebotsinformationen. Überprüfen Sie alle Details
        unabhängig, bevor Sie Transaktionen durchführen.
      </p>

      <h2>7. Haftungsbeschränkung</h2>
      <p>
        Monza Lab wird &quot;wie besehen&quot; ohne Gewährleistung jeglicher Art bereitgestellt. Wir haften nicht für
        Verluste, die aus Ihrer Nutzung der Plattform oder dem Vertrauen auf die hierin bereitgestellten Informationen entstehen.
      </p>

      <h2>8. Änderungen</h2>
      <p>
        Wir behalten uns das Recht vor, diese Bedingungen jederzeit zu ändern. Die fortgesetzte Nutzung der Plattform
        nach Änderungen gilt als Zustimmung.
      </p>

      <h2>9. Kontakt</h2>
      <p>Bei Fragen zu diesen Bedingungen kontaktieren Sie uns unter <strong>legal@monzalab.com</strong>.</p>
    </>
  )
}

function JaContent() {
  return (
    <>
      <p>最終更新日：2025年3月1日</p>

      <h2>1. 利用規約の同意</h2>
      <p>
        Monza Lab（以下「本プラットフォーム」）にアクセスまたは利用することにより、お客様は本利用規約に拘束されることに同意するものとします。
        同意されない場合は、本プラットフォームをご利用にならないでください。
      </p>

      <h2>2. サービスの説明</h2>
      <p>
        Monza Labは、コレクター車両のマーケットプレイスおよび分析プラットフォームです。市場データ、投資分析、
        リスティング集約を情報提供目的で提供しています。当社は認可されたブローカー、ディーラー、またはファイナンシャルアドバイザーではありません。
      </p>

      <h2>3. 投資に関する免責事項</h2>
      <p>
        <strong>本プラットフォームで提供されるすべての投資グレード、評価額、市場分析は情報提供のみを目的としており、
        財務、投資、または法的助言を構成するものではありません。</strong>コレクター車両の価値は本質的に変動性があり、
        過去の実績は将来の結果を保証するものではありません。購入決定を行う前に、必ずご自身でデューデリジェンスを行い、
        資格のある専門家にご相談ください。
      </p>

      <h2>4. ユーザーアカウント</h2>
      <ul>
        <li>アカウントを作成するには、有効なメールアドレスを提供する必要があります。</li>
        <li>アカウント認証情報のセキュリティを維持する責任はお客様にあります。</li>
        <li>違法な目的で本プラットフォームを使用することはできません。</li>
      </ul>

      <h2>5. 知的財産権</h2>
      <p>
        Monza Labが制作するすべてのコンテンツ、デザイン、分析は著作権により保護されています。
        書面による明示的な許可なく、複製、配布、または派生物の作成を行うことはできません。
      </p>

      <h2>6. リスティングデータ</h2>
      <p>
        車両リスティングおよびオークションデータは第三者ソースから集約されています。正確性に努めていますが、
        リスティング情報の完全性や正確性を保証するものではありません。取引を行う前に、すべての詳細を独自に確認してください。
      </p>

      <h2>7. 責任の制限</h2>
      <p>
        Monza Labは、いかなる種類の保証もなく「現状のまま」提供されます。本プラットフォームのご利用または
        提供される情報への依存から生じるいかなる損失についても、当社は責任を負いません。
      </p>

      <h2>8. 変更</h2>
      <p>
        当社は、いつでもこれらの規約を変更する権利を留保します。変更後の本プラットフォームの継続使用は、承諾を構成するものとします。
      </p>

      <h2>9. お問い合わせ</h2>
      <p>本規約に関するご質問は <strong>legal@monzalab.com</strong> までご連絡ください。</p>
    </>
  )
}

const CONTENT: Record<string, () => React.JSX.Element> = {
  en: EnContent,
  es: EsContent,
  de: DeContent,
  ja: JaContent,
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const Content = CONTENT[locale] || CONTENT.en
  const backLabels: Record<string, string> = { en: "Back", es: "Volver", de: "Zurück", ja: "戻る" }
  const titles: Record<string, string> = {
    en: "Terms of Service",
    es: "Términos de Servicio",
    de: "Nutzungsbedingungen",
    ja: "利用規約",
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] pt-24 pb-16 px-6">
      <article className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280] hover:text-[#9CA3AF] transition-colors mb-8"
        >
          <ArrowLeft className="size-3" />
          {backLabels[locale] || backLabels.en}
        </Link>

        <h1 className="text-2xl font-bold text-[#FFFCF7] mb-2">{titles[locale] || titles.en}</h1>

        <div className="prose-legal mt-8 space-y-4 text-[13px] leading-relaxed text-[#9CA3AF] [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-[#FFFCF7] [&_h2]:mt-8 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-[#D1D5DB] [&_a]:text-[#F8B4D9] [&_a]:underline">
          <Content />
        </div>
      </article>
    </div>
  )
}
