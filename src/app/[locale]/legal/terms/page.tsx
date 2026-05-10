import React from "react"
import { getLocale } from "next-intl/server"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

// Terms of Service v1.0 — drafted to align with the master Privacy
// Policy v1.0 of Monza Lab LLC (Wyoming) and the implementation guide
// in /LLC-USA/03-Compliance-Policies. This document is a sound
// template; it should still be reviewed by a US-licensed attorney
// before high-traffic launch.

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Terms of Service | MonzaHaus",
    es: "Términos de Servicio | MonzaHaus",
    de: "Nutzungsbedingungen | MonzaHaus",
    ja: "利用規約 | MonzaHaus",
  }
  return { title: titles[locale] || titles.en }
}

const EFFECTIVE_DATE = "May 10, 2026"

function EnContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of <strong>monzahaus.com</strong> and the related products,
        features, and APIs (the &ldquo;Service&rdquo;) provided by Monza Lab LLC, a Wyoming single-member limited liability company (&ldquo;Monza
        Lab,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
      </p>
      <p>By using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>

      <h2>1. Who We Are</h2>
      <p>
        Monza Lab LLC, EIN 30-1486916, principal place of business 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, United States. Contact:{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>

      <h2>2. Description of the Service</h2>
      <p>
        MonzaHaus is a collector-car intelligence platform focused on Porsche. The Service aggregates public listings, generates AI-assisted reports
        and market analysis, and lets you interact with an AI Advisor. The Service is informational. We are not a broker, dealer, auctioneer,
        financial advisor, insurance provider, or escrow agent. We do not facilitate transactions; you transact directly with third-party platforms
        (e.g. Bring a Trailer, Cars &amp; Bids, Collecting Cars, AutoScout24, Elferspot) and accept their terms separately.
      </p>

      <h2>3. Eligibility &amp; Accounts</h2>
      <ul>
        <li>You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account.</li>
        <li>You agree to provide accurate information and to keep it current.</li>
        <li>You are responsible for the security of your credentials and for all activity under your account.</li>
        <li>You may close your account at any time by contacting us.</li>
      </ul>

      <h2>4. Free Tier and Pistons</h2>
      <p>
        The Service offers a free tier with a monthly allowance of in-product credits called &ldquo;Pistons.&rdquo; Pistons are not money, are
        non-redeemable for cash, are non-transferable, and have no value outside the Service. Free Pistons reset on the 1st of each calendar month
        and do not roll over. We may change the free allowance with reasonable notice.
      </p>

      <h2>5. Paid Plans &amp; Top-ups</h2>
      <p>
        Paid subscription plans are billed in advance on a recurring basis (monthly or annual) until cancelled. One-time top-ups add a fixed number
        of Pistons that do not expire while your account remains active. Pricing is shown in U.S. dollars on{" "}
        <Link href="/pricing">the pricing page</Link>. Payments are processed by Stripe; we do not store your full payment-card numbers.
      </p>
      <p>
        <strong>Auto-renewal.</strong> Subscriptions renew automatically at the then-current price unless you cancel before the end of the current
        billing period. You can cancel at any time from your account settings or by writing to us. Cancellation stops future renewals; access
        continues through the end of the paid period.
      </p>

      <h2>6. Refunds</h2>
      <p>
        We offer a 30-day money-back guarantee on first-time paid plans and top-ups. To request a refund within 30 days of a charge, email{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>. Outside the 30-day window, charges are non-refundable except where required by
        law (including any mandatory consumer-protection rights you have in your country).
      </p>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer, scrape at scale, or rebroadcast the Service or its data without our written permission.</li>
        <li>Resell access, share credentials, or use the Service to compete with us.</li>
        <li>Submit false or misleading prompts to manipulate AI output, or use AI output in a way that misrepresents its source.</li>
        <li>Use the Service in violation of any law, including export controls and anti-money-laundering rules.</li>
        <li>Attempt to access non-public areas of the Service or interfere with its security.</li>
      </ul>
      <p>We may suspend or close accounts that breach these rules.</p>

      <h2>8. AI Advisor &amp; Generated Content</h2>
      <p>
        The Service uses third-party AI providers (currently Anthropic and Google) to generate analysis. AI output may be incomplete, outdated, or
        wrong. <strong>It is not financial, legal, tax, or investment advice.</strong> You are solely responsible for any decision you make based on
        it. We make no guarantee of any specific result and disclaim liability for losses arising from reliance on AI output. Inputs you submit may
        be processed by the AI providers under contractual terms that prohibit training their public models on your content.
      </p>

      <h2>9. Listings &amp; Third-Party Data</h2>
      <p>
        Listing details are aggregated from third-party platforms and public sources, and may be inaccurate, incomplete, or out-of-date. We do not
        verify listings independently. Always confirm details (VIN, condition, provenance, price, availability) directly with the seller before
        making any commitment.
      </p>

      <h2>10. Intellectual Property</h2>
      <p>
        The Service, including its design, code, branding, indices, methodology, written analysis, and reports, is owned by Monza Lab LLC and is
        protected by copyright, trademark, and other laws. We grant you a personal, non-exclusive, non-transferable, revocable license to use the
        Service for your own collector-car decision-making. You retain ownership of content you submit; you grant us a license to host, display, and
        process that content as necessary to operate the Service.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest extent permitted by law, we disclaim all
        warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant
        that the Service will be uninterrupted, error-free, or secure, or that any defect will be corrected.
      </p>

      <h2>12. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, neither Monza Lab nor its affiliates, officers, employees, agents, or licensors will be liable for
        any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, or business
        interruption, arising out of or related to the Service. Our total aggregate liability for direct damages will not exceed the greater of
        (a) the amount you paid us in the twelve (12) months immediately preceding the event giving rise to the claim, or (b) USD $100. Some
        jurisdictions do not allow these limits; in those places these limits apply only to the extent permitted by law.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to defend and indemnify Monza Lab from claims arising out of (i) your breach of these Terms, (ii) your misuse of the Service, or
        (iii) your violation of any law or third-party right.
      </p>

      <h2>14. Governing Law and Dispute Resolution</h2>
      <p>
        <strong>Governing law.</strong> These Terms are governed by the laws of the State of Wyoming, USA, without regard to its conflict-of-law
        rules. The U.N. Convention on Contracts for the International Sale of Goods does not apply.
      </p>
      <p>
        <strong>Informal resolution.</strong> Before filing a claim, you agree to contact us at{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> and try to resolve the dispute informally for at least thirty (30) days.
      </p>
      <p>
        <strong>Arbitration; class-action waiver.</strong> Any dispute that cannot be resolved informally will be settled by binding arbitration
        administered by JAMS in Cheyenne, Wyoming, under its Streamlined Arbitration Rules &amp; Procedures, except that either party may bring an
        individual action in small-claims court. <strong>You and we each waive any right to participate in a class, collective, or representative
        action.</strong> If this class-action waiver is held unenforceable, the remainder of this section will be unenforceable as to that claim,
        which will then proceed in court.
      </p>
      <p>
        <strong>Right to opt out of arbitration.</strong> You may opt out of arbitration within 30 days of first accepting these Terms by emailing{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> with subject line &ldquo;Arbitration opt-out.&rdquo;
      </p>
      <p>
        <strong>Mandatory consumer rights.</strong> Nothing in this section limits any non-waivable consumer-protection rights you have under the
        laws of your home country, including the right of EU/UK consumers to bring a claim in their member state and to lodge complaints with their
        local data-protection or consumer authority.
      </p>

      <h2>15. Termination</h2>
      <p>
        Either party may terminate the agreement at any time. We may suspend or terminate access if you breach these Terms or if continued operation
        is impractical. Sections that by their nature should survive termination (IP, disclaimers, liability limits, governing law, indemnification)
        will survive.
      </p>

      <h2>16. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be communicated through the Service or by email. Your continued use after
        changes take effect constitutes acceptance. The effective date above will reflect the most recent revision.
      </p>

      <h2>17. Contact</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        150 SE 2nd Ave, Ste 1403-6691<br />
        Miami, FL 33131, United States<br />
        Email: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>
      </address>
      <p className="text-[11px] text-muted-foreground/70 mt-8">© 2026 Monza Lab LLC. All rights reserved.</p>
    </>
  )
}

function EsContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Fecha de entrada en vigor: {EFFECTIVE_DATE}</p>
      <p>
        Estos Términos de Servicio (&ldquo;Términos&rdquo;) rigen tu acceso y uso de <strong>monzahaus.com</strong> y los productos, funciones y APIs
        relacionados (el &ldquo;Servicio&rdquo;), proporcionados por Monza Lab LLC, una sociedad de responsabilidad limitada de un solo miembro de
        Wyoming. Al usar el Servicio aceptas estos Términos.
      </p>

      <h2>1. Quiénes Somos</h2>
      <p>
        Monza Lab LLC, EIN 30-1486916, sede principal: 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, EE. UU. Contacto:{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>

      <h2>2. Descripción del Servicio</h2>
      <p>
        MonzaHaus es una plataforma de inteligencia para coleccionistas Porsche: agrega listings públicos, genera reportes y análisis con asistencia
        de IA, y permite interactuar con un AI Advisor. Es informativo. No somos broker, dealer, casa de subastas, asesor financiero, asegurador ni
        agente de custodia. Tú transaccionas directamente con plataformas terceras (Bring a Trailer, Cars &amp; Bids, etc.) y aceptas sus términos
        por separado.
      </p>

      <h2>3. Elegibilidad y Cuentas</h2>
      <ul>
        <li>Debes tener al menos 18 años, o la mayoría de edad en tu jurisdicción.</li>
        <li>Debes proporcionar información precisa y mantenerla actualizada.</li>
        <li>Eres responsable de la seguridad de tus credenciales y de toda actividad en tu cuenta.</li>
      </ul>

      <h2>4. Tier Gratuito y Pistons</h2>
      <p>
        El Servicio ofrece un tier gratuito con una asignación mensual de créditos in-product llamados &ldquo;Pistons.&rdquo; Los Pistons no son
        dinero, no son canjeables por dinero, no son transferibles, y no tienen valor fuera del Servicio. Los Pistons gratis se reinician el 1.º de
        cada mes y no acumulan.
      </p>

      <h2>5. Planes Pagos y Top-ups</h2>
      <p>
        Las suscripciones pagas se cobran por adelantado de forma recurrente (mensual o anual) hasta su cancelación. Los top-ups one-time agregan
        Pistons que no expiran mientras tu cuenta esté activa. Precios en USD en <Link href="/pricing">la página de precios</Link>. Los pagos se
        procesan vía Stripe; no almacenamos números completos de tarjeta.
      </p>
      <p>
        <strong>Renovación automática.</strong> Las suscripciones se renuevan automáticamente al precio vigente salvo que canceles antes del fin del
        periodo. Puedes cancelar desde tu cuenta o escribiéndonos. La cancelación detiene futuras renovaciones; el acceso continúa hasta el final del
        periodo pagado.
      </p>

      <h2>6. Reembolsos</h2>
      <p>
        Ofrecemos garantía de devolución de 30 días en primeros planes pagos y top-ups. Para solicitar reembolso dentro de 30 días, escribe a{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>. Fuera de ese plazo no hay reembolso, salvo cuando lo exija la ley (incluidos los
        derechos no renunciables de protección al consumidor en tu país).
      </p>

      <h2>7. Uso Aceptable</h2>
      <ul>
        <li>No realizar reverse-engineering, scraping a escala, ni rebroadcast del Servicio sin permiso escrito.</li>
        <li>No revender acceso, compartir credenciales o usar el Servicio para competir con nosotros.</li>
        <li>No enviar prompts engañosos para manipular la salida de IA, ni representar erróneamente su fuente.</li>
        <li>No usar el Servicio en violación de la ley.</li>
        <li>No acceder a áreas no públicas ni interferir con la seguridad.</li>
      </ul>

      <h2>8. AI Advisor y Contenido Generado</h2>
      <p>
        El Servicio usa proveedores de IA (Anthropic, Google) para generar análisis. La salida puede estar incompleta, desactualizada o ser
        incorrecta. <strong>No constituye asesoramiento financiero, legal, fiscal ni de inversión.</strong> Eres el único responsable por las
        decisiones tomadas en base a ella. Tus inputs pueden ser procesados por estos proveedores bajo términos contractuales que prohíben entrenar
        sus modelos públicos con tu contenido.
      </p>

      <h2>9. Listings y Datos de Terceros</h2>
      <p>
        Los detalles de listings se agregan desde plataformas terceras y fuentes públicas, y pueden estar inexactos, incompletos o desactualizados.
        No los verificamos de forma independiente. Confirma siempre los detalles (VIN, condición, procedencia, precio, disponibilidad) directamente
        con el vendedor.
      </p>

      <h2>10. Propiedad Intelectual</h2>
      <p>
        El Servicio, incluyendo diseño, código, marca, índices, metodología y reportes, es propiedad de Monza Lab LLC. Te otorgamos una licencia
        personal, no exclusiva, no transferible y revocable para usar el Servicio para tus decisiones de coleccionismo automotor. Conservas la
        propiedad del contenido que envías; nos otorgas licencia para alojarlo y procesarlo según sea necesario.
      </p>

      <h2>11. Descargo de Garantías</h2>
      <p>
        El Servicio se ofrece &ldquo;tal cual&rdquo; y &ldquo;según disponibilidad.&rdquo; Hasta donde lo permita la ley, descartamos todas las
        garantías, expresas o implícitas. No garantizamos que el Servicio sea ininterrumpido, libre de errores ni seguro.
      </p>

      <h2>12. Limitación de Responsabilidad</h2>
      <p>
        Hasta donde lo permita la ley, ni Monza Lab ni sus afiliados serán responsables por daños indirectos, incidentales, especiales,
        consecuentes, ejemplares ni punitivos, ni por lucro cesante, pérdida de ingresos, datos o interrupción del negocio. Nuestra responsabilidad
        agregada total por daños directos no excederá lo mayor de: (a) lo que nos pagaste en los doce (12) meses anteriores al evento, o (b) USD
        $100.
      </p>

      <h2>13. Indemnización</h2>
      <p>
        Te comprometes a defender e indemnizar a Monza Lab por reclamos derivados de (i) tu incumplimiento de estos Términos, (ii) tu mal uso del
        Servicio, o (iii) tu violación de cualquier ley o derecho de tercero.
      </p>

      <h2>14. Ley Aplicable y Resolución de Disputas</h2>
      <p>
        <strong>Ley aplicable.</strong> Estos Términos se rigen por las leyes del Estado de Wyoming, EE. UU., sin considerar normas de conflicto.
      </p>
      <p>
        <strong>Resolución informal.</strong> Antes de presentar una reclamación, contáctanos en{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> e intenta resolver la disputa de forma informal por al menos treinta (30) días.
      </p>
      <p>
        <strong>Arbitraje; renuncia a acciones colectivas.</strong> Cualquier disputa no resuelta informalmente se resolverá mediante arbitraje
        vinculante administrado por JAMS en Cheyenne, Wyoming, salvo acciones individuales en cortes de pequeñas reclamaciones. Renuncias a participar
        en acciones colectivas o representativas.
      </p>
      <p>
        <strong>Opt-out de arbitraje.</strong> Puedes optar por no someterte a arbitraje dentro de 30 días tras aceptar estos Términos enviando un
        email a <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> con asunto &ldquo;Arbitration opt-out.&rdquo;
      </p>
      <p>
        <strong>Derechos de consumidor inalienables.</strong> Nada en esta sección limita derechos no renunciables que tengas bajo la ley de tu país,
        incluido el derecho de consumidores EU/UK a accionar en su estado miembro y presentar reclamaciones ante autoridades locales.
      </p>

      <h2>15. Terminación</h2>
      <p>
        Cualquiera de las partes puede terminar el acuerdo. Las disposiciones que por su naturaleza deban sobrevivir (PI, descargo, límites de
        responsabilidad, ley aplicable, indemnización) sobrevivirán.
      </p>

      <h2>16. Cambios a Estos Términos</h2>
      <p>
        Podemos actualizar estos Términos. Los cambios materiales se comunicarán por el Servicio o email. Tu uso continuado constituye aceptación.
      </p>

      <h2>17. Contacto</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        150 SE 2nd Ave, Ste 1403-6691<br />
        Miami, FL 33131, EE. UU.<br />
        Email: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>
      </address>
      <p className="text-[11px] text-muted-foreground/70 mt-8">© 2026 Monza Lab LLC. Todos los derechos reservados.</p>
    </>
  )
}

function DeContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">Wirksamkeitsdatum: {EFFECTIVE_DATE}</p>
      <p>
        Diese Nutzungsbedingungen (&bdquo;Bedingungen&ldquo;) regeln Ihren Zugriff auf <strong>monzahaus.com</strong> und die zugehörigen Produkte
        (der &bdquo;Dienst&ldquo;), bereitgestellt von Monza Lab LLC, einer Single-Member-LLC aus Wyoming, USA. Mit der Nutzung des Dienstes stimmen
        Sie diesen Bedingungen zu.
      </p>

      <h2>1. Wer wir sind</h2>
      <p>
        Monza Lab LLC, EIN 30-1486916, Hauptsitz: 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, USA. Kontakt:{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>

      <h2>2. Beschreibung des Dienstes</h2>
      <p>
        MonzaHaus ist eine Sammler-Auto-Intelligenzplattform für Porsche. Der Dienst ist informativ. Wir sind weder Makler, Händler, Auktionator,
        Anlageberater noch Treuhänder.
      </p>

      <h2>3. Zugangsberechtigung &amp; Konten</h2>
      <ul>
        <li>Mindestalter 18 Jahre oder das Volljährigkeitsalter Ihres Wohnsitzes.</li>
        <li>Sie sind für die Sicherheit Ihrer Anmeldedaten verantwortlich.</li>
      </ul>

      <h2>4. Free-Tier &amp; Pistons</h2>
      <p>
        &bdquo;Pistons&ldquo; sind In-Product-Credits, kein Geld, nicht in Bargeld einlösbar, nicht übertragbar und außerhalb des Dienstes wertlos.
        Kostenlose Pistons werden am 1. jedes Monats zurückgesetzt.
      </p>

      <h2>5. Bezahlpläne &amp; Top-ups</h2>
      <p>
        Abonnements werden im Voraus monatlich oder jährlich abgerechnet, bis sie gekündigt werden. Top-ups verfallen nicht, solange Ihr Konto aktiv
        ist. Zahlungen werden von Stripe verarbeitet. Abonnements verlängern sich automatisch.
      </p>

      <h2>6. Erstattungen</h2>
      <p>
        30-Tage-Geld-zurück-Garantie für erstmalige Bezahlpläne und Top-ups. EU-Verbraucher behalten ihr 14-tägiges Widerrufsrecht gemäß
        Verbraucherrechte-Richtlinie.
      </p>

      <h2>7. Akzeptable Nutzung</h2>
      <ul>
        <li>Kein Reverse-Engineering, kein massives Scraping, keine Wiederveröffentlichung ohne schriftliche Erlaubnis.</li>
        <li>Kein Wiederverkauf des Zugangs.</li>
        <li>Keine Manipulation von KI-Ausgaben.</li>
      </ul>

      <h2>8. KI-Advisor &amp; generierte Inhalte</h2>
      <p>
        Der Dienst nutzt KI-Anbieter (Anthropic, Google). Ausgaben können unvollständig oder fehlerhaft sein. <strong>Keine Anlage-, Rechts-, Steuer-
        oder Finanzberatung.</strong>
      </p>

      <h2>9. Inserate &amp; Drittanbieterdaten</h2>
      <p>Inserate werden von Drittanbietern aggregiert und sind nicht eigenständig verifiziert. Verifizieren Sie Details direkt beim Verkäufer.</p>

      <h2>10. Geistiges Eigentum</h2>
      <p>
        Der Dienst ist Eigentum von Monza Lab LLC. Wir gewähren Ihnen eine persönliche, nicht ausschließliche, nicht übertragbare, widerrufliche
        Lizenz zur Nutzung.
      </p>

      <h2>11. Haftungsausschluss</h2>
      <p>
        Der Dienst wird &bdquo;wie er ist&ldquo; bereitgestellt. Wir schließen Gewährleistungen im gesetzlich zulässigen Umfang aus. Zwingende
        Verbraucherrechte bleiben unberührt.
      </p>

      <h2>12. Haftungsbeschränkung</h2>
      <p>
        Soweit gesetzlich zulässig, haften wir nicht für mittelbare Schäden, entgangenen Gewinn, Datenverlust oder Geschäftsunterbrechung. Die
        Höchstgrenze direkter Schäden beträgt das Höhere von (a) den in den letzten 12 Monaten gezahlten Beträgen oder (b) USD 100. Zwingende
        gesetzliche Haftung bleibt unberührt.
      </p>

      <h2>13. Anwendbares Recht und Streitbeilegung</h2>
      <p>
        Diese Bedingungen unterliegen dem Recht des US-Bundesstaates Wyoming. Streitigkeiten werden vorrangig informell gelöst, danach durch
        bindendes JAMS-Schiedsverfahren in Cheyenne, Wyoming, mit Verzicht auf Sammelklagen — vorbehaltlich Ihrer zwingenden EU-Verbraucherrechte,
        nach denen Sie u. a. weiterhin in Ihrem Mitgliedstaat klagen können.
      </p>

      <h2>14. Änderungen</h2>
      <p>Wir können diese Bedingungen ändern. Wesentliche Änderungen werden mitgeteilt.</p>

      <h2>15. Kontakt</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        150 SE 2nd Ave, Ste 1403-6691<br />
        Miami, FL 33131, USA<br />
        E-Mail: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>
      </address>
      <p className="text-[11px] text-muted-foreground/70 mt-8">© 2026 Monza Lab LLC. Alle Rechte vorbehalten.</p>
    </>
  )
}

function JaContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">発効日: {EFFECTIVE_DATE}</p>
      <p>
        本利用規約（以下「本規約」）は、米国ワイオミング州のシングルメンバーLLCである Monza Lab LLC が提供する <strong>monzahaus.com</strong> および関連プロダクト（以下「本サービス」）の利用に適用されます。
      </p>

      <h2>1. 当社について</h2>
      <p>
        Monza Lab LLC、EIN 30-1486916、本社所在地: 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, USA。
        お問い合わせ: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>。
      </p>

      <h2>2. サービス概要</h2>
      <p>
        MonzaHausはPorsche専門のコレクター向けインテリジェンスプラットフォームです。本サービスは情報提供を目的とし、当社はブローカー・ディーラー・オークションハウス・金融アドバイザー・エスクローエージェントではありません。取引は第三者プラットフォームと直接行ってください。
      </p>

      <h2>3. 利用資格・アカウント</h2>
      <ul>
        <li>18歳以上または所属国の成人年齢以上であること。</li>
        <li>正確な情報を提供し、最新に保つこと。</li>
        <li>認証情報の管理およびアカウント上の活動について責任を負うこと。</li>
      </ul>

      <h2>4. 無料プランとPistons</h2>
      <p>
        「Pistons」はサービス内クレジットであり、現金ではなく、現金との交換不可、譲渡不可、サービス外での価値はありません。無料Pistonsは毎月1日にリセットされ繰り越しされません。
      </p>

      <h2>5. 有料プラン・トップアップ</h2>
      <p>
        サブスクリプションは月次・年次で前払い課金され、解約まで自動更新されます。トップアップはアカウント有効中は失効しません。決済はStripeが処理します。
      </p>

      <h2>6. 返金</h2>
      <p>初回有料プランおよびトップアップに30日間の返金保証を提供します。期間外は法律で求められる場合を除き返金不可です。</p>

      <h2>7. 禁止事項</h2>
      <ul>
        <li>本サービスのリバースエンジニアリング、大規模スクレイピング、再配信。</li>
        <li>アクセス権の転売、認証情報の共有、競合目的の利用。</li>
        <li>AI出力の操作・誤った帰属表示。</li>
        <li>違法な利用。</li>
      </ul>

      <h2>8. AI Advisorと生成コンテンツ</h2>
      <p>
        本サービスは第三者AIプロバイダー（Anthropic、Google）を利用します。AI出力は不完全または誤りを含む可能性があります。<strong>金融・法務・税務・投資の助言ではありません。</strong>
      </p>

      <h2>9. リスティングおよび第三者データ</h2>
      <p>
        リスティング情報は第三者プラットフォームおよび公開情報源から集約されます。詳細（VIN、状態、由来、価格、在庫）は必ず売り手に直接ご確認ください。
      </p>

      <h2>10. 知的財産</h2>
      <p>
        本サービスはMonza Lab LLCに帰属します。お客様には個人的・非排他的・譲渡不可・取消可能なライセンスを付与します。
      </p>

      <h2>11. 保証の否認</h2>
      <p>
        本サービスは「現状有姿」「利用可能な範囲」で提供されます。法律で許容される最大限まで明示・黙示の保証を否認します。
      </p>

      <h2>12. 責任制限</h2>
      <p>
        法律で許容される範囲で、当社は間接損害・逸失利益・データ損失・業務中断について責任を負いません。直接損害の総合責任は、(a) 過去12ヶ月間にお客様が支払った金額または (b) USD 100 のいずれか大きい額を超えません。
      </p>

      <h2>13. 準拠法・紛争解決</h2>
      <p>
        本規約は米国ワイオミング州法に準拠します。紛争はまず非公式に解決を図り、解決しない場合はワイオミング州シャイアンにてJAMSの拘束的仲裁により解決します。集団訴訟は放棄します。お客様の所在国の強行的消費者保護権利は影響を受けません。
      </p>

      <h2>14. 変更</h2>
      <p>本規約は随時更新される場合があります。重要な変更はサービス内または電子メールで通知します。</p>

      <h2>15. お問い合わせ</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        150 SE 2nd Ave, Ste 1403-6691<br />
        Miami, FL 33131, USA<br />
        Email: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>
      </address>
      <p className="text-[11px] text-muted-foreground/70 mt-8">© 2026 Monza Lab LLC. All rights reserved.</p>
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
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-16 px-6">
      <article className="max-w-2xl mx-auto">
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

        <div className="prose-legal mt-8 space-y-4 text-[13px] leading-relaxed text-foreground/80 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_address]:text-foreground/85">
          <Content />
        </div>
      </article>
    </div>
  )
}
