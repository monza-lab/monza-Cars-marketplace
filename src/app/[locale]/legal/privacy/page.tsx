import React from "react"
import { getLocale } from "next-intl/server"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"

// Aligned with the master "Monza Lab LLC — Privacy Policy v1.0" document
// (signed April 28, 2026) which covers monzalab.com, monzaindex.ai and
// monzahaus.com under the same Wyoming LLC. The English version is the
// canonical text from that PDF; ES/DE/JA are translations preserving the
// same legal effect.

export async function generateMetadata() {
  const locale = await getLocale()
  const titles: Record<string, string> = {
    en: "Privacy Policy | MonzaHaus",
    es: "Política de Privacidad | MonzaHaus",
    de: "Datenschutzerklärung | MonzaHaus",
    ja: "プライバシーポリシー | MonzaHaus",
  }
  return { title: titles[locale] || titles.en }
}

const EFFECTIVE_DATE = "April 28, 2026"
const LAST_UPDATED = "May 10, 2026"

function EnContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">
        Effective date: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
      </p>

      <p>
        Monza Lab LLC (&ldquo;Monza Lab,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy and is committed to protecting your personal data.
        This Privacy Policy explains how we collect, use, share, and protect information about you when you visit our websites — including
        monzalab.com, monzaindex.ai, and <strong>monzahaus.com</strong> — use our products and services, or otherwise interact with us
        (collectively, the &ldquo;Services&rdquo;).
      </p>
      <p>
        By using our Services, you agree to the collection and use of information in accordance with this Policy. If you do not agree, please do not
        use the Services.
      </p>

      <h2>1. Who We Are</h2>
      <p>
        Monza Lab LLC is a single-member limited liability company organized under the laws of the State of Wyoming, USA, with EIN 30-1486916. Our
        principal place of business is 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, United States. For privacy-related inquiries, contact us at{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>
      <p>This Privacy Policy applies to all properties owned and operated by Monza Lab LLC, including:</p>
      <ul>
        <li><strong>monzalab.com</strong> — corporate website and creative studio.</li>
        <li><strong>monzaindex.ai</strong> — AI Index platform and related software products.</li>
        <li><strong>monzahaus.com</strong> — MonzaHaus collector cars platform, reports, and community.</li>
      </ul>

      <h2>2. Information We Collect</h2>
      <p>We collect information in the following ways:</p>
      <ul>
        <li>
          <strong>Information you provide directly</strong> — such as your name, email address, phone number, company, billing details, and any
          content you submit through forms, sign-ups, surveys, or communications with us.
        </li>
        <li>
          <strong>Account and transaction data</strong> — if you purchase a product or subscribe to a service, we collect order details, payment
          confirmations, and related records (we do not store full payment card numbers; payments are processed by Stripe and similar third-party
          processors).
        </li>
        <li>
          <strong>Automatically collected data</strong> — including IP address, browser type, device identifiers, operating system, referring URLs,
          pages viewed, time spent, and clickstream data, collected through cookies, pixels, and similar technologies.
        </li>
        <li>
          <strong>Communications</strong> — records of your interactions with us via email, chat, the in-app Advisor, social media, or other channels.
        </li>
        <li>
          <strong>Information from third parties</strong> — we may receive information from analytics providers, advertising partners, and publicly
          available sources (such as auction houses and listing platforms whose data we index).
        </li>
      </ul>

      <h2>3. How We Use Your Information &amp; Legal Basis</h2>
      <p>
        We use the information we collect for the purposes below. For users in the EEA/UK, the table also identifies our legal basis under
        Articles 6 and (where applicable) 9 of the GDPR.
      </p>
      <ul>
        <li><strong>Provide, operate, and maintain the Services</strong> — legal basis: <em>performance of a contract</em>.</li>
        <li><strong>Process transactions, send confirmations and receipts</strong> — legal basis: <em>performance of a contract</em>.</li>
        <li><strong>Personalize your experience</strong> — legal basis: <em>legitimate interests</em> (offering a useful product).</li>
        <li><strong>Send marketing communications and newsletters</strong> — legal basis: <em>consent</em> (you may withdraw at any time).</li>
        <li><strong>Analyze usage and measure performance</strong> (Vercel Analytics, Vercel Speed Insights, Google Analytics) — legal basis: <em>consent</em> (via the cookie banner).</li>
        <li><strong>Advertising and conversion measurement</strong> (Meta Pixel, Conversions API) — legal basis: <em>consent</em>; no advertising tracker fires before opt-in.</li>
        <li><strong>Detect and prevent fraud, abuse, and security incidents</strong> — legal basis: <em>legitimate interests</em>.</li>
        <li><strong>Comply with legal obligations</strong> (tax, accounting, lawful requests) — legal basis: <em>legal obligation</em>.</li>
      </ul>
      <p>
        We do <strong>not</strong> use your data to make decisions producing legal or similarly significant effects on you without human review.
        The in-app Advisor produces informational analysis only.
      </p>

      <h2>4. Cookies and Tracking Technologies</h2>
      <p>
        We use cookies and similar technologies to operate our Services, remember your preferences, measure performance, and deliver relevant
        advertising. Providers we use include Vercel Analytics, Vercel Speed Insights, Google Analytics and Meta (Facebook) Pixel for analytics
        and advertising. You can control non-essential cookies through our cookie banner (shown on first visit) or your browser settings. Disabling
        cookies may affect your experience. See our <Link href="/legal/cookies">Cookie Policy</Link> for the complete list and purpose of each
        cookie.
      </p>

      <h2>5. AI Advisor and AI-Generated Content</h2>
      <p>
        When you interact with the in-app Advisor or generate a report, your prompt and the relevant context (e.g. listing data) are sent to
        third-party AI providers (currently Anthropic and Google) to produce a response. We do not allow these providers to train their public
        models on your content under the contractual terms applicable to their enterprise APIs. AI-generated analysis is informational and is not
        financial, legal, or investment advice.
      </p>

      <h2>6. How We Share Your Information</h2>
      <p>We do not sell your personal information. We share data only in these circumstances:</p>
      <ul>
        <li>
          <strong>Service providers</strong> — with vendors who perform services on our behalf, such as hosting (Vercel), authentication and database
          (Supabase), payment processing (Stripe), email delivery, analytics, customer support, and advertising. These providers are bound by
          contractual obligations to protect your data.
        </li>
        <li>
          <strong>Legal and safety</strong> — when required by law, subpoena, or to protect our rights, users, or the public.
        </li>
        <li>
          <strong>Business transfers</strong> — in connection with a merger, acquisition, financing, or sale of assets, subject to confidentiality
          protections.
        </li>
        <li>
          <strong>With your consent</strong> — for any other purpose disclosed at the time of collection or with your separate consent.
        </li>
      </ul>

      <h2>7. International Data Transfers</h2>
      <p>
        Monza Lab LLC operates from the United States and may process data in other countries where our service providers operate. By using the
        Services, you consent to the transfer of your information to countries that may have different data protection laws than your jurisdiction.
        Where required, we rely on appropriate safeguards such as Standard Contractual Clauses.
      </p>

      <h2>8. Data Retention</h2>
      <p>
        We retain personal data only for as long as necessary to fulfill the purposes for which it was collected, comply with legal obligations,
        resolve disputes, and enforce our agreements. Retention periods vary based on the nature of the data and applicable legal requirements. You
        may request deletion of your account and associated personal data at any time by contacting us.
      </p>

      <h2>9. Sub-processors</h2>
      <p>We rely on a small number of vetted vendors to operate the Services. Each is contractually bound to protect your data:</p>
      <ul className="!list-none !pl-0">
        <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-2"><span><strong>Supabase</strong> — authentication &amp; database</span><span className="text-[11px] text-muted-foreground">United States · DPA + SCCs</span></li>
        <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-2"><span><strong>Vercel</strong> — hosting, Analytics, Speed Insights</span><span className="text-[11px] text-muted-foreground">United States · DPA + SCCs</span></li>
        <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-2"><span><strong>Stripe</strong> — payments &amp; subscription management</span><span className="text-[11px] text-muted-foreground">US / Ireland · DPA + SCCs</span></li>
        <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-2"><span><strong>Anthropic</strong> — AI Advisor responses (Claude API)</span><span className="text-[11px] text-muted-foreground">United States · enterprise terms; no model training on your content</span></li>
        <li className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-2"><span><strong>Google (Gemini, Analytics)</strong> — vision scoring + analytics</span><span className="text-[11px] text-muted-foreground">United States · DPA + SCCs</span></li>
        <li className="grid grid-cols-[1fr_auto] gap-4 py-2"><span><strong>Meta (Pixel, CAPI)</strong> — advertising attribution (consent only)</span><span className="text-[11px] text-muted-foreground">US / Ireland · DPA + SCCs</span></li>
      </ul>
      <p className="text-[12px] text-muted-foreground">We will update this list when sub-processors change. If we add a new sub-processor, the &ldquo;Last updated&rdquo; date above changes and we may notify you.</p>

      <h2>10. EU and UK Representative</h2>
      <p>
        For users in the EEA/UK, our Article 27 representatives are listed below. You may contact them directly regarding GDPR/UK GDPR matters.
      </p>
      <p className="text-[12px] text-muted-foreground">
        <em>To be appointed before EU launch.</em> If you reside in the EEA or UK and need to exercise your rights before then, contact us at{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> and we will respond directly.
      </p>

      <h2>11. Your Rights</h2>
      <p>Depending on your location, you may have the following rights regarding your personal data:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
        <li><strong>Correction</strong> — request correction of inaccurate or incomplete data.</li>
        <li><strong>Deletion</strong> — request deletion of your data, subject to legal exceptions.</li>
        <li><strong>Objection / restriction</strong> — object to or restrict certain processing.</li>
        <li><strong>Portability</strong> — receive your data in a structured, machine-readable format.</li>
        <li><strong>Withdraw consent</strong> — where processing is based on consent.</li>
        <li><strong>Opt out of marketing</strong> — unsubscribe via the link in any marketing email or by contacting us.</li>
      </ul>
      <p>
        <strong>California residents (CCPA/CPRA):</strong> you have additional rights including the right to know what categories of personal
        information we collect, to request deletion, to correct inaccurate information, to opt out of the &ldquo;sale&rdquo; or &ldquo;sharing&rdquo;
        (cross-context behavioral advertising) of personal information, and to limit the use of sensitive personal information. We do <strong>not
        sell</strong> personal information for monetary value. To honor your right to opt out of sharing for advertising, you may reject advertising
        cookies through the <Link href="/legal/cookies">Cookie preferences</Link> link in our footer, and we honor the Global Privacy Control (GPC)
        browser signal automatically.
      </p>
      <p>
        <strong>EEA/UK residents (GDPR):</strong> you may lodge a complaint with your local supervisory authority if you believe our processing of
        your personal data violates applicable law.
      </p>
      <p>
        To exercise any of these rights, contact us at <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>. We will respond within the
        timeframes required by applicable law.
      </p>

      <h2>10. Data Security</h2>
      <p>
        We implement reasonable administrative, technical, and physical safeguards designed to protect your personal information against unauthorized
        access, disclosure, alteration, and destruction. However, no method of transmission or storage is completely secure, and we cannot guarantee
        absolute security.
      </p>

      <h2>11. Children&rsquo;s Privacy</h2>
      <p>
        Our Services are not directed to children under the age of 16, and we do not knowingly collect personal information from children. If we
        learn that we have collected such information, we will delete it promptly. If you believe a child has provided us with personal data, please
        contact us.
      </p>

      <h2>12. Third-Party Links and Services</h2>
      <p>
        Our Services may contain links to third-party websites or integrations with third-party platforms (including auction houses such as Bring a
        Trailer, Cars &amp; Bids, Collecting Cars, AutoScout24, Elferspot, and others whose listings we surface). We are not responsible for the
        privacy practices of those third parties. We encourage you to review their privacy policies before providing any personal information.
      </p>

      <h2>13. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date above reflects the most recent version. Material
        changes will be communicated through our Services or via email. Continued use of the Services after changes take effect constitutes
        acceptance of the updated Policy.
      </p>

      <h2>14. Contact Us</h2>
      <p>If you have questions, requests, or complaints regarding this Privacy Policy or our data practices, please contact:</p>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        Attn: Privacy<br />
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
      <p className="text-[12px] text-muted-foreground/80 italic">
        Fecha de entrada en vigor: 28 de abril de 2026 · Última actualización: 10 de mayo de 2026
      </p>

      <p>
        Monza Lab LLC (&ldquo;Monza Lab,&rdquo; &ldquo;nosotros,&rdquo; &ldquo;nos&rdquo; u &ldquo;nuestro&rdquo;) respeta tu privacidad y se
        compromete a proteger tus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, compartimos y protegemos la
        información sobre ti cuando visitas nuestros sitios web — incluyendo monzalab.com, monzaindex.ai y <strong>monzahaus.com</strong> — usas
        nuestros productos y servicios, o interactúas con nosotros (colectivamente, los &ldquo;Servicios&rdquo;).
      </p>
      <p>
        Al utilizar nuestros Servicios, aceptas la recopilación y el uso de la información de acuerdo con esta Política. Si no estás de acuerdo, por
        favor no utilices los Servicios.
      </p>

      <h2>1. Quiénes Somos</h2>
      <p>
        Monza Lab LLC es una sociedad de responsabilidad limitada de un solo miembro organizada bajo las leyes del Estado de Wyoming, EE. UU., con
        EIN 30-1486916. Nuestra sede principal se encuentra en 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, Estados Unidos. Para consultas sobre
        privacidad, contáctanos en <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>
      <p>Esta Política aplica a todas las propiedades operadas por Monza Lab LLC, incluyendo monzalab.com, monzaindex.ai y monzahaus.com.</p>

      <h2>2. Información que Recopilamos</h2>
      <ul>
        <li><strong>Información que proporcionas directamente</strong>: nombre, correo electrónico, teléfono, empresa, datos de facturación y cualquier contenido enviado a través de formularios o comunicaciones.</li>
        <li><strong>Datos de cuenta y transacciones</strong>: detalles de pedidos, confirmaciones y registros relacionados (no almacenamos números completos de tarjetas; los pagos los procesa Stripe u otros procesadores externos).</li>
        <li><strong>Datos recopilados automáticamente</strong>: dirección IP, tipo de navegador, identificadores de dispositivo, sistema operativo, URLs de referencia, páginas vistas, tiempo en página y datos de clickstream, recopilados mediante cookies, píxeles y tecnologías similares.</li>
        <li><strong>Comunicaciones</strong>: registros de tus interacciones con nosotros por email, chat, el Advisor in-app, redes sociales u otros canales.</li>
        <li><strong>Información de terceros</strong>: podemos recibir información de proveedores de analítica, socios publicitarios y fuentes públicamente disponibles (como casas de subastas y plataformas cuyos listings indexamos).</li>
      </ul>

      <h2>3. Cómo Usamos tu Información</h2>
      <ul>
        <li>Proveer, operar y mantener nuestros Servicios.</li>
        <li>Procesar transacciones y enviar confirmaciones y recibos.</li>
        <li>Personalizar tu experiencia y entregar contenido relevante.</li>
        <li>Enviar comunicaciones de marketing, newsletters y actualizaciones de producto (puedes darte de baja en cualquier momento).</li>
        <li>Analizar el uso para mejorar productos, contenido y experiencia de cliente.</li>
        <li>Detectar, prevenir y responder a fraude, abuso, incidentes de seguridad y violaciones legales.</li>
        <li>Cumplir obligaciones legales y hacer cumplir nuestros términos.</li>
      </ul>

      <h2>4. Cookies y Tecnologías de Seguimiento</h2>
      <p>
        Usamos cookies y tecnologías similares para operar los Servicios, recordar preferencias, medir rendimiento y entregar publicidad relevante.
        Los proveedores que utilizamos incluyen Vercel Analytics, Vercel Speed Insights, Google Analytics y Meta (Facebook) Pixel. Puedes controlar
        cookies no esenciales mediante nuestro banner de cookies (mostrado en la primera visita) o las configuraciones de tu navegador. Consulta
        nuestra <Link href="/legal/cookies">Política de Cookies</Link> para la lista completa.
      </p>

      <h2>5. Advisor IA y Contenido Generado por IA</h2>
      <p>
        Cuando interactúas con el Advisor o generas un reporte, tu pregunta y el contexto relevante (p.ej. datos del listing) son enviados a
        proveedores de IA externos (actualmente Anthropic y Google) para producir una respuesta. No permitimos que estos proveedores entrenen sus
        modelos públicos con tu contenido bajo los términos contractuales aplicables a sus APIs empresariales. El análisis generado por IA es
        informativo y no constituye asesoría financiera, legal ni de inversión.
      </p>

      <h2>6. Cómo Compartimos tu Información</h2>
      <p>No vendemos tu información personal. Compartimos datos solo en estas circunstancias:</p>
      <ul>
        <li><strong>Proveedores de servicios</strong>: con vendors que realizan servicios en nuestro nombre — alojamiento (Vercel), autenticación y base de datos (Supabase), procesamiento de pagos (Stripe), envío de emails, analítica, soporte y publicidad. Están vinculados contractualmente a proteger tus datos.</li>
        <li><strong>Por ley o seguridad</strong>: cuando lo requiera la ley, una orden judicial, o para proteger derechos de usuarios o del público.</li>
        <li><strong>Transferencias de negocio</strong>: en conexión con fusión, adquisición, financiamiento o venta de activos, sujeto a protecciones de confidencialidad.</li>
        <li><strong>Con tu consentimiento</strong>: para cualquier otro propósito divulgado en el momento de la recopilación.</li>
      </ul>

      <h2>7. Transferencias Internacionales de Datos</h2>
      <p>
        Monza Lab LLC opera desde Estados Unidos y puede procesar datos en otros países donde operan nuestros proveedores de servicio. Al usar los
        Servicios, consientes la transferencia de tu información a países que pueden tener leyes de protección de datos diferentes. Donde aplica,
        recurrimos a salvaguardas apropiadas como las Cláusulas Contractuales Tipo (SCC).
      </p>

      <h2>8. Retención de Datos</h2>
      <p>
        Conservamos los datos personales solo el tiempo necesario para cumplir los propósitos para los que fueron recopilados, las obligaciones
        legales, la resolución de disputas y el cumplimiento de nuestros acuerdos. Puedes solicitar la eliminación de tu cuenta y tus datos personales
        en cualquier momento contactándonos.
      </p>

      <h2>9. Tus Derechos</h2>
      <p>Dependiendo de tu ubicación, puedes tener los siguientes derechos:</p>
      <ul>
        <li><strong>Acceso</strong>: solicitar una copia de tus datos personales.</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos o incompletos.</li>
        <li><strong>Eliminación</strong>: borrar tus datos, sujeto a excepciones legales.</li>
        <li><strong>Oposición / restricción</strong>: oponerte o restringir cierto procesamiento.</li>
        <li><strong>Portabilidad</strong>: recibir tus datos en formato estructurado y legible por máquina.</li>
        <li><strong>Retirar consentimiento</strong>: cuando el procesamiento se base en consentimiento.</li>
        <li><strong>Opt-out de marketing</strong>: darte de baja desde cualquier email de marketing o contactándonos.</li>
      </ul>
      <p>
        <strong>Residentes de California (CCPA/CPRA):</strong> tienes derechos adicionales incluyendo conocer las categorías de información personal
        que recopilamos, solicitar eliminación, corregir información y optar por no participar en venta o intercambio. No vendemos información
        personal.
      </p>
      <p>
        <strong>Residentes EEA/UK (RGPD):</strong> puedes presentar una reclamación ante tu autoridad supervisora local si crees que nuestro
        procesamiento viola la ley aplicable.
      </p>
      <p>Para ejercer cualquiera de estos derechos, contáctanos en <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.</p>

      <h2>10. Seguridad de los Datos</h2>
      <p>
        Implementamos salvaguardas administrativas, técnicas y físicas razonables diseñadas para proteger tu información personal. Sin embargo,
        ningún método de transmisión o almacenamiento es completamente seguro y no podemos garantizar seguridad absoluta.
      </p>

      <h2>11. Privacidad de Menores</h2>
      <p>
        Nuestros Servicios no están dirigidos a menores de 16 años, y no recopilamos conscientemente información personal de menores. Si descubrimos
        que hemos recopilado tal información, la eliminaremos rápidamente.
      </p>

      <h2>12. Enlaces y Servicios de Terceros</h2>
      <p>
        Nuestros Servicios pueden contener enlaces a sitios web de terceros o integraciones (incluidas casas de subastas como Bring a Trailer, Cars
        &amp; Bids, Collecting Cars, AutoScout24, Elferspot y otras cuyos listings exhibimos). No somos responsables de las prácticas de privacidad
        de esos terceros.
      </p>

      <h2>13. Cambios a Esta Política</h2>
      <p>
        Podemos actualizar esta Política periódicamente. La fecha &ldquo;Última actualización&rdquo; arriba refleja la versión más reciente. Los
        cambios materiales se comunicarán a través de los Servicios o por email.
      </p>

      <h2>14. Contacto</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        Attn: Privacy<br />
        150 SE 2nd Ave, Ste 1403-6691<br />
        Miami, FL 33131, Estados Unidos<br />
        Email: <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>
      </address>
      <p className="text-[11px] text-muted-foreground/70 mt-8">© 2026 Monza Lab LLC. Todos los derechos reservados.</p>
    </>
  )
}

function DeContent() {
  return (
    <>
      <p className="text-[12px] text-muted-foreground/80 italic">
        Wirksamkeitsdatum: 28. April 2026 · Zuletzt aktualisiert: 10. Mai 2026
      </p>

      <p>
        Monza Lab LLC (&bdquo;Monza Lab,&ldquo; &bdquo;wir,&ldquo; &bdquo;uns&ldquo; oder &bdquo;unser&ldquo;) respektiert Ihre Privatsphäre und ist
        verpflichtet, Ihre personenbezogenen Daten zu schützen. Diese Datenschutzerklärung erläutert, wie wir Informationen über Sie erheben,
        verwenden, weitergeben und schützen, wenn Sie unsere Websites besuchen — darunter monzalab.com, monzaindex.ai und <strong>monzahaus.com</strong> —
        unsere Produkte und Dienste nutzen oder anderweitig mit uns interagieren (gemeinsam die &bdquo;Dienste&ldquo;).
      </p>
      <p>
        Mit der Nutzung unserer Dienste stimmen Sie der Erhebung und Verwendung von Informationen gemäß dieser Erklärung zu. Wenn Sie nicht zustimmen,
        nutzen Sie die Dienste bitte nicht.
      </p>

      <h2>1. Wer wir sind</h2>
      <p>
        Monza Lab LLC ist eine Single-Member-LLC, gegründet nach dem Recht des US-Bundesstaates Wyoming, mit EIN 30-1486916. Unser Hauptsitz ist 150
        SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, USA. Bei datenschutzrechtlichen Anfragen erreichen Sie uns unter{" "}
        <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>

      <h2>2. Welche Daten wir erheben</h2>
      <ul>
        <li><strong>Daten, die Sie direkt bereitstellen</strong>: Name, E-Mail, Telefonnummer, Unternehmen, Abrechnungsdetails und Inhalte aus Formularen, Anmeldungen oder Mitteilungen.</li>
        <li><strong>Konto- und Transaktionsdaten</strong>: Bestelldetails, Zahlungsbestätigungen und zugehörige Aufzeichnungen (vollständige Kreditkartennummern werden nicht gespeichert; Zahlungen werden von Stripe und ähnlichen Dienstleistern verarbeitet).</li>
        <li><strong>Automatisch erfasste Daten</strong>: IP-Adresse, Browsertyp, Geräte-IDs, Betriebssystem, Referrer-URLs, aufgerufene Seiten, Verweildauer und Klickstrom-Daten, erhoben über Cookies, Pixel und ähnliche Technologien.</li>
        <li><strong>Kommunikation</strong>: Aufzeichnungen Ihrer Interaktionen mit uns per E-Mail, Chat, dem In-App-Advisor, Social Media oder anderen Kanälen.</li>
        <li><strong>Daten von Dritten</strong>: Wir können Daten von Analyse-Anbietern, Werbepartnern und öffentlich zugänglichen Quellen erhalten (z. B. Auktionshäuser und Listing-Plattformen, deren Daten wir indexieren).</li>
      </ul>

      <h2>3. Wie wir Ihre Daten verwenden</h2>
      <ul>
        <li>Bereitstellung, Betrieb und Wartung unserer Dienste.</li>
        <li>Verarbeitung von Transaktionen und Versand von Bestätigungen und Quittungen.</li>
        <li>Personalisierung Ihrer Erfahrung und Bereitstellung relevanter Inhalte.</li>
        <li>Versand von Marketing-Mitteilungen, Newslettern und Produkt-Updates (jederzeit abbestellbar).</li>
        <li>Analyse der Nutzung zur Verbesserung von Produkten und Kundenerlebnis.</li>
        <li>Erkennung und Verhinderung von Betrug, Missbrauch und Sicherheitsvorfällen.</li>
        <li>Erfüllung gesetzlicher Pflichten und Durchsetzung unserer Bedingungen.</li>
      </ul>

      <h2>4. Cookies und Tracking-Technologien</h2>
      <p>
        Wir verwenden Cookies und ähnliche Technologien zum Betrieb der Dienste, zur Speicherung von Präferenzen, zur Leistungsmessung und zur
        Bereitstellung relevanter Werbung. Genutzte Anbieter sind u. a. Vercel Analytics, Vercel Speed Insights, Google Analytics und Meta
        (Facebook) Pixel. Sie können nicht-essentielle Cookies über unser Cookie-Banner (beim ersten Besuch) oder Ihre Browser-Einstellungen
        steuern. Siehe unsere <Link href="/legal/cookies">Cookie-Richtlinie</Link>.
      </p>

      <h2>5. KI-Advisor und KI-generierte Inhalte</h2>
      <p>
        Wenn Sie mit dem Advisor interagieren oder einen Bericht erstellen, werden Ihre Eingabe und der relevante Kontext (z. B. Listing-Daten) an
        externe KI-Anbieter (derzeit Anthropic und Google) gesendet, um eine Antwort zu erzeugen. Wir gestatten diesen Anbietern unter den vertraglich
        anwendbaren Bedingungen ihrer Enterprise-APIs nicht, ihre öffentlichen Modelle mit Ihren Inhalten zu trainieren. KI-generierte Analysen sind
        informativ und stellen keine Finanz-, Rechts- oder Anlageberatung dar.
      </p>

      <h2>6. Wie wir Ihre Daten teilen</h2>
      <p>Wir verkaufen Ihre personenbezogenen Daten nicht. Wir teilen Daten nur in folgenden Fällen:</p>
      <ul>
        <li><strong>Dienstleister</strong>: Hosting (Vercel), Authentifizierung und Datenbank (Supabase), Zahlungsabwicklung (Stripe), E-Mail-Versand, Analytik, Support und Werbung. Vertraglich zum Datenschutz verpflichtet.</li>
        <li><strong>Recht und Sicherheit</strong>: wenn gesetzlich oder gerichtlich verpflichtet, oder zum Schutz von Rechten.</li>
        <li><strong>Unternehmensübertragungen</strong>: bei Fusion, Übernahme, Finanzierung oder Verkauf von Vermögenswerten.</li>
        <li><strong>Mit Ihrer Einwilligung</strong>: für andere offengelegte Zwecke.</li>
      </ul>

      <h2>7. Internationale Datenübermittlungen</h2>
      <p>
        Monza Lab LLC operiert von den USA aus und kann Daten in anderen Ländern verarbeiten. Mit der Nutzung der Dienste stimmen Sie der Übermittlung
        Ihrer Daten in Länder mit ggf. abweichendem Datenschutzrecht zu. Wo erforderlich, stützen wir uns auf Standardvertragsklauseln (SCC).
      </p>

      <h2>8. Datenspeicherung</h2>
      <p>
        Wir speichern personenbezogene Daten nur so lange, wie es für die Erhebungszwecke, gesetzliche Pflichten und Streitbeilegung erforderlich ist.
        Sie können jederzeit die Löschung Ihres Kontos beantragen.
      </p>

      <h2>9. Ihre Rechte</h2>
      <ul>
        <li><strong>Auskunft</strong>: Kopie Ihrer Daten anfordern.</li>
        <li><strong>Berichtigung</strong>: ungenaue Daten korrigieren.</li>
        <li><strong>Löschung</strong>: Daten löschen lassen, vorbehaltlich gesetzlicher Ausnahmen.</li>
        <li><strong>Widerspruch / Einschränkung</strong>: bestimmten Verarbeitungen widersprechen.</li>
        <li><strong>Datenübertragbarkeit</strong>: Daten in maschinenlesbarem Format erhalten.</li>
        <li><strong>Widerruf der Einwilligung</strong>.</li>
        <li><strong>Marketing-Opt-out</strong>.</li>
      </ul>
      <p>
        <strong>Kalifornische Einwohner (CCPA/CPRA):</strong> zusätzliche Rechte gemäß kalifornischem Recht. Wir verkaufen keine personenbezogenen
        Daten.
      </p>
      <p>
        <strong>EWR/UK-Einwohner (DSGVO):</strong> Sie können Beschwerde bei Ihrer örtlichen Aufsichtsbehörde einlegen.
      </p>
      <p>
        Zur Ausübung dieser Rechte kontaktieren Sie <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a>.
      </p>

      <h2>10. Datensicherheit</h2>
      <p>
        Wir setzen angemessene administrative, technische und physische Schutzmaßnahmen ein. Allerdings ist keine Übertragung oder Speicherung völlig
        sicher.
      </p>

      <h2>11. Datenschutz von Minderjährigen</h2>
      <p>Unsere Dienste richten sich nicht an Personen unter 16 Jahren. Wir erheben wissentlich keine Daten von Kindern.</p>

      <h2>12. Drittanbieter-Links und -Dienste</h2>
      <p>
        Unsere Dienste können Links zu Drittanbieter-Websites oder Integrationen enthalten (einschließlich Auktionshäuser wie Bring a Trailer, Cars
        &amp; Bids, Collecting Cars, AutoScout24, Elferspot u. a.). Wir sind nicht verantwortlich für deren Datenschutzpraktiken.
      </p>

      <h2>13. Änderungen dieser Erklärung</h2>
      <p>
        Wir können diese Datenschutzerklärung gelegentlich aktualisieren. Das &bdquo;Zuletzt aktualisiert&ldquo;-Datum spiegelt die aktuelle Version
        wider. Wesentliche Änderungen werden über die Dienste oder per E-Mail kommuniziert.
      </p>

      <h2>14. Verantwortlicher</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        Attn: Privacy<br />
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
      <p className="text-[12px] text-muted-foreground/80 italic">
        発効日: 2026年4月28日 · 最終更新日: 2026年5月10日
      </p>

      <p>
        Monza Lab LLC（以下「Monza Lab」「当社」）は、お客様のプライバシーを尊重し、個人データの保護に努めています。
        本プライバシーポリシーは、当社のウェブサイト（monzalab.com、monzaindex.ai、<strong>monzahaus.com</strong> を含む。総称して「本サービス」）をご利用いただく際、または当社とやり取りする際に、お客様に関する情報をどのように収集、使用、共有、保護するかを説明するものです。
      </p>
      <p>
        本サービスをご利用いただくことで、本ポリシーに従った情報の収集および使用に同意したものとみなされます。同意いただけない場合は、本サービスをご利用にならないでください。
      </p>

      <h2>1. 当社について</h2>
      <p>
        Monza Lab LLCは、米国ワイオミング州法に基づき設立されたシングルメンバーLLC（EIN 30-1486916）です。本社所在地: 150 SE 2nd Ave, Ste 1403-6691, Miami, FL 33131, USA。
        プライバシーに関するお問い合わせは <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> までお願いします。
      </p>

      <h2>2. 収集する情報</h2>
      <ul>
        <li><strong>お客様が直接提供する情報</strong>: 氏名、メールアドレス、電話番号、所属、請求情報、フォーム・登録・問い合わせ等で送信されたコンテンツ。</li>
        <li><strong>アカウントおよび取引データ</strong>: 注文の詳細、支払い確認、関連記録（クレジットカード番号は保存せず、Stripe等の第三者処理業者が処理します）。</li>
        <li><strong>自動収集データ</strong>: IPアドレス、ブラウザ種別、デバイス識別子、OS、参照URL、閲覧ページ、滞在時間、クリックストリーム等。Cookie・ピクセル等の技術で収集します。</li>
        <li><strong>コミュニケーション記録</strong>: メール、チャット、アプリ内Advisor、SNS等とのやり取り。</li>
        <li><strong>第三者からの情報</strong>: 分析プロバイダー、広告パートナー、公開情報源（オークションハウス、リスティング・プラットフォーム等）。</li>
      </ul>

      <h2>3. 情報の利用目的</h2>
      <ul>
        <li>本サービスの提供・運営・維持。</li>
        <li>取引処理および確認・領収書の送付。</li>
        <li>体験のパーソナライズおよび関連コンテンツの提供。</li>
        <li>マーケティング配信・ニュースレター・プロダクト更新（いつでも配信停止可）。</li>
        <li>製品・コンテンツ・カスタマー体験の改善のための利用分析。</li>
        <li>不正・濫用・セキュリティ事案・違法行為の検知と防止。</li>
        <li>法令遵守および規約の執行。</li>
      </ul>

      <h2>4. Cookieおよびトラッキング技術</h2>
      <p>
        当社は、サービス運営、設定保存、パフォーマンス測定、関連広告の提供のためCookie等の技術を使用します。利用プロバイダーには Vercel Analytics、Vercel Speed Insights、Google Analytics、Meta（Facebook）Pixel が含まれます。
        非必須Cookieは、初回訪問時のCookieバナーまたはブラウザ設定で管理できます。詳細は <Link href="/legal/cookies">Cookieポリシー</Link> をご覧ください。
      </p>

      <h2>5. AI Advisor とAI生成コンテンツ</h2>
      <p>
        Advisorと対話したりレポートを生成すると、入力内容と関連コンテキスト（例: リスティング情報）を、回答生成のため第三者AIプロバイダー（現在は Anthropic と Google）に送信します。これらプロバイダーがエンタープライズAPIの契約条件下において、お客様のコンテンツで公開モデルを学習させることは認めていません。AIによる分析は情報提供であり、金融・法務・投資の助言ではありません。
      </p>

      <h2>6. 情報の共有</h2>
      <p>当社はお客様の個人情報を販売しません。以下の場合に限り共有します:</p>
      <ul>
        <li><strong>サービスプロバイダー</strong>: ホスティング（Vercel）、認証・DB（Supabase）、決済（Stripe）、メール配信、分析、サポート、広告等。契約上の保護義務を負います。</li>
        <li><strong>法令・安全</strong>: 法令、令状、または権利・公衆の保護のため。</li>
        <li><strong>事業譲渡</strong>: 合併、買収、資金調達、資産売却等の際、機密保護下で。</li>
        <li><strong>同意に基づく共有</strong>: 収集時に開示される他の目的または個別の同意に基づく場合。</li>
      </ul>

      <h2>7. 国際データ移転</h2>
      <p>
        Monza Lab LLCは米国を拠点とし、サービスプロバイダーが運営する他の国でデータを処理する場合があります。本サービスの利用により、データ保護法が異なる場合のある他国へのデータ移転に同意するものとします。必要に応じ、標準契約条項（SCC）等の適切な保護措置を講じます。
      </p>

      <h2>8. データ保持</h2>
      <p>
        当社は、収集目的の達成、法令遵守、紛争解決、契約の執行に必要な期間のみ個人データを保持します。アカウントおよび関連個人データの削除はいつでもご請求いただけます。
      </p>

      <h2>9. お客様の権利</h2>
      <ul>
        <li><strong>開示請求</strong>: 当社が保有するデータのコピーを請求。</li>
        <li><strong>訂正</strong>: 不正確・不完全なデータの訂正。</li>
        <li><strong>削除</strong>: データの削除（法的例外あり）。</li>
        <li><strong>異議・制限</strong>: 一部処理への異議または制限。</li>
        <li><strong>データポータビリティ</strong>: 構造化された機械可読形式での受領。</li>
        <li><strong>同意の撤回</strong>: 同意に基づく処理について。</li>
        <li><strong>マーケティングのオプトアウト</strong>。</li>
      </ul>
      <p><strong>カリフォルニア州住民（CCPA/CPRA）:</strong> 追加の権利があります。当社は個人情報を販売しません。</p>
      <p><strong>EEA/UK住民（GDPR）:</strong> 監督機関への苦情申立てが可能です。</p>
      <p>権利を行使するには <a href="mailto:edgar@monzalab.com">edgar@monzalab.com</a> までご連絡ください。</p>

      <h2>10. データセキュリティ</h2>
      <p>合理的な管理的・技術的・物理的安全管理措置を講じていますが、伝送・保存方法に絶対的な安全性はありません。</p>

      <h2>11. 子どものプライバシー</h2>
      <p>本サービスは16歳未満を対象としていません。子どもからの情報を意図的に収集しません。</p>

      <h2>12. 第三者リンク・サービス</h2>
      <p>本サービスには第三者ウェブサイトへのリンクや統合（Bring a Trailer、Cars &amp; Bids、Collecting Cars、AutoScout24、Elferspot 等のリスティングを含む）が含まれることがあります。当社はそれら第三者のプライバシー慣行について責任を負いません。</p>

      <h2>13. 本ポリシーの変更</h2>
      <p>本ポリシーを随時更新する場合があります。「最終更新日」が最新版を示します。重要な変更はサービス内またはメールで通知します。</p>

      <h2>14. お問い合わせ</h2>
      <address className="not-italic mt-2">
        <strong>Monza Lab LLC</strong><br />
        Attn: Privacy<br />
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
    <div className="min-h-screen bg-background pt-[var(--app-header-h,3.5rem)] md:pt-24 pb-16 px-6">
      <article className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors mb-8"
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
