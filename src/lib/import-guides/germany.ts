import type { ImportGuide } from "./types";

export const germanyImportGuide: ImportGuide = {
  slug: "germany",
  country: "Germany",
  tagline: "TÜV, Zoll, and the H-Kennzeichen — importing a Porsche into its home market.",
  title: "How to Import a Porsche to Germany — TÜV, Zoll, H-Kennzeichen | MonzaHaus",
  intro: [
    "Germany is the origin market for virtually every collector Porsche — built in Stuttgart-Zuffenhausen and, for many 911 variants, finished at the Werk II facility. Importing a Porsche into Germany is therefore less often a 'gray-market' exercise and more often a Rückimport (re-import) of a car originally sold abroad, or a relocation of a US-/UK-/Japan-spec car bought by a German resident. In both cases, the regulatory path is well defined but unforgiving of paperwork errors.",
    "Two variables drive the entire process. First: is the car coming from inside the EU customs union or from outside it? Intra-EU movements are duty-free and VAT-neutral for used cars transferred between private individuals. Imports from the US, UK (post-Brexit), Japan, Switzerland, or any non-EU origin trigger the full EU import regime — 10% customs duty plus 19% German VAT (Einfuhrumsatzsteuer) on the landed value. Second: is the car 30 years or older? If yes, H-Kennzeichen status becomes available, with material tax and usage benefits.",
    "Every non-German-registered car entering Germany — regardless of origin — must pass a Vollabnahme (full inspection) at TÜV, DEKRA, or GTÜ before it can be registered at the Kfz-Zulassungsstelle. For US-spec Porsches in particular, this inspection is the single largest cost and timing risk: km/h speedometer, headlight beam pattern, rear fog lamp, and side-marker treatment all require modification before the car will pass.",
    "This guide walks the full process for a collector Porsche entering Germany, covering both intra-EU and non-EU scenarios, TÜV/Vollabnahme mechanics, H-Kennzeichen qualification, and the Zulassungsstelle registration workflow. Import regulations and TÜV acceptance criteria vary meaningfully between Länder and between individual inspection shops — consult a specialist Porsche workshop (for example a Porsche Classic Partner) and your local Prüfstelle before committing to a non-EU purchase.",
  ],
  regulatoryContext: [
    "Federal level: Zoll (customs, for non-EU imports), Kraftfahrt-Bundesamt (KBA, type approval authority), and the StVZO (Straßenverkehrs-Zulassungs-Ordnung, road-traffic licensing regulation). Inspection is delegated to TÜV/DEKRA/GTÜ/KÜS organisations. Registration (Zulassung) is executed at the municipal Kfz-Zulassungsstelle. Taxation is administered by the Hauptzollamt (motor vehicle tax moved from Länder to federal Zoll in 2014).",
    "Age and origin determine the cost structure. Intra-EU used-car transfers between private parties incur no customs duty and no VAT (VAT was already paid in the origin country). Non-EU imports incur 10% customs duty on (declared value + shipping + insurance), plus 19% Einfuhrumsatzsteuer on (value + duty + shipping). Cars 30+ years old with original character can apply for §23 StVZO recognition as a historical vehicle, unlocking H-Kennzeichen — a flat annual road tax of €191.73 and full access to all German Umweltzonen regardless of emissions class.",
    "The StVZO requires every imported car to hold either an EU type approval (CoC / Certificate of Conformity) or to pass an Einzelabnahme (single-vehicle approval) via TÜV. For Porsches, German-market Rückimport cars usually have a CoC on file with Porsche Classic (€200–€400 to obtain a replacement). US-spec and Japan-spec cars have no EU CoC and must go through full Einzelabnahme, which is where conversion work becomes necessary.",
  ],
  steps: [
    {
      name: "Determine EU vs non-EU origin and target registration",
      text: "Confirm the car's current country of registration. EU-origin cars (Italy, France, Netherlands, Belgium, Austria) move duty-free with only a Fahrzeugbrief transfer and TÜV check. Non-EU cars (US, UK, Switzerland, Japan) incur 10% duty + 19% VAT and require Einzelabnahme. Decide early whether the target is H-Kennzeichen (car must be 30+ years, largely original) or regular plate.",
    },
    {
      name: "Source the car and arrange pre-purchase inspection",
      text: "For Rückimport of a German-original car, request the Porsche Certificate (€200–€400 from Porsche Classic) to verify matching numbers, factory build spec, and original paint code. For gray-market US/UK cars, engage an independent Porsche specialist (many 911 shops in the destination Land offer PPI services) before wiring funds. Document condition extensively — photos are your sole recourse if transit damage occurs.",
    },
    {
      name: "Arrange shipping (container strongly preferred)",
      text: "From the US: container shipping to Bremerhaven or Hamburg runs €2,500–€4,500, 4–6 weeks transit. From the UK post-Brexit: ferry via Calais/Zeebrugge/Rotterdam is cheapest (€800–€1,500) but now requires customs paperwork at both sides. From Japan: container to Hamburg, 6–8 weeks, €3,500–€5,500. Container shipping is mandatory for any collector-grade Porsche — RoRo exposes the car to weather and handling damage.",
    },
    {
      name: "Clear Zoll at port of entry (non-EU only)",
      text: "For non-EU imports, a German customs broker files the import declaration at Bremerhaven/Hamburg. You pay 10% customs duty on (value + freight + insurance), then 19% Einfuhrumsatzsteuer on (value + duty + freight). Retain the Zollbescheid (customs notice) — the Zulassungsstelle requires it for registration. Intra-EU imports skip this step entirely.",
      url: "https://www.zoll.de/EN/Private-individuals/Vehicles/vehicles_node.html",
    },
    {
      name: "Execute Vollabnahme / Einzelabnahme at TÜV or DEKRA",
      text: "Book an appointment at TÜV Süd, TÜV Rheinland, DEKRA, GTÜ, or KÜS. For an EU-spec Porsche with CoC, this is a straightforward §21 StVZO inspection (€150–€400). For a US-spec car, Einzelabnahme requires km/h speedometer conversion, European headlight units (E-marked), rear fog lamp retrofit, amber-to-red turn-signal conversion, and often an emissions certificate (H-plate candidates are exempt via §47 StVZO for historical vehicles). Budget €3,000–€8,000 in conversion work for a 964 or 993 coming from the US.",
    },
    {
      name: "Obtain insurance (eVB number) and execute Kfz-Steuer registration",
      text: "Before visiting the Zulassungsstelle, secure liability insurance from a German insurer and receive an eVB (elektronische Versicherungsbestätigung) number. Simultaneously, the Hauptzollamt will assess Kfz-Steuer (motor vehicle tax) — for a non-H-plate classic Porsche, expect €200–€400/year depending on displacement and emissions class. H-plate cars pay a flat €191.73.",
    },
    {
      name: "Register at the Kfz-Zulassungsstelle",
      text: "Bring: TÜV Abnahme report, Zollbescheid (non-EU only), original foreign title (surrendered), purchase invoice, Porsche CoC or Einzelabnahme certificate, eVB insurance number, and personal ID/Meldebescheinigung. Appointment-based in most cities; budget €60–€120 in Zulassungsstelle fees. You walk out with Fahrzeugbrief (Zulassungsbescheinigung Teil II), Fahrzeugschein (Teil I), and plates.",
    },
    {
      name: "Apply for H-Kennzeichen if 30+ years old",
      text: "For cars 30+ years old with largely original condition, request §23 StVZO Begutachtung at TÜV (€100–€200 additional on top of the standard Abnahme). TÜV issues an H-Gutachten confirming historical-vehicle status. Present it at the Zulassungsstelle, pay a small plate swap fee, and receive the H-suffix plate (e.g. S-PO 911H). Annual tax drops to €191.73 flat and the car is exempt from all Umweltzone restrictions.",
    },
  ],
  costs: [
    { label: "Purchase price", estimate: "Varies", note: "Transfer via SEPA or escrow" },
    { label: "Export prep (foreign seller, transport to port)", estimate: "€300–€900" },
    { label: "Container shipping (US → Hamburg/Bremerhaven)", estimate: "€2,500–€4,500", note: "4–6 weeks; RoRo cheaper but not recommended for collector cars" },
    { label: "Shipping insurance", estimate: "1.25–2% of value" },
    { label: "German Zoll — customs duty (non-EU only)", estimate: "10% of (value + freight + insurance)" },
    { label: "German Zoll — Einfuhrumsatzsteuer (non-EU only)", estimate: "19% of (value + duty + freight)" },
    { label: "Customs broker fee", estimate: "€250–€600" },
    { label: "TÜV Vollabnahme / Einzelabnahme", estimate: "€300–€800", note: "Higher for US-spec conversions" },
    { label: "US→EU conversion work (lights, speedo, fog lamp, emissions)", estimate: "€3,000–€8,000", note: "For 964/993-era US-spec cars; varies materially by shop" },
    { label: "Zulassungsstelle registration fees + plates", estimate: "€60–€120" },
    { label: "H-Kennzeichen Gutachten (if 30+ years)", estimate: "€100–€200" },
    { label: "Annual Kfz-Steuer (H-plate)", estimate: "€191.73 flat", note: "Regular plate: €200–€400/year for classic Porsches" },
  ],
  pitfalls: [
    "Assuming all TÜV shops accept the same modifications. Acceptance of US-to-EU lighting conversions varies meaningfully between TÜV Süd, TÜV Rheinland, and DEKRA and between individual Prüfer. Call the specific Prüfstelle before committing.",
    "Buying a US-spec car without pricing Einzelabnahme conversion first. A 'cheap' 964 from the US becomes expensive once €5,000–€8,000 of conversion work is added. Always price the landed, road-legal cost — not the purchase price.",
    "Attempting H-Kennzeichen on a modified car. The §23 StVZO Begutachtung requires largely original condition. Non-period wheels, modern paint respray, or modified suspension can disqualify the car. Revert to stock before the Gutachten appointment.",
    "Missing the 30-year threshold by months. H-Kennzeichen is measured from month of first registration (Erstzulassung), not model year. Wait the additional months rather than registering as a regular plate and re-plating later.",
    "Under-declaring value to Zoll. German customs cross-references auction comparables and Porsche-market indices; declared values materially below market trigger reassessment plus penalties.",
    "Buying a grauer Markt car without a CoC. Without a Porsche Certificate of Authenticity or factory CoC, matching-numbers verification becomes difficult and resale value suffers 10–20%.",
    "Forgetting that post-Brexit UK imports now behave like non-EU imports. A car imported from London in 2026 incurs the same 10% duty + 19% VAT as one from the US, unless it qualifies under the UK-EU TCA rules of origin.",
  ],
  timeline:
    "End-to-end, a typical Porsche import into Germany takes 8–14 weeks from purchase agreement: 2 weeks of export prep, 4–6 weeks of ocean transit (or 1 week for UK/EU road transport), 1–2 weeks of Zoll clearance and broker filing, 1–3 weeks for TÜV Abnahme (longer if US conversion work is required), and 1 week at the Zulassungsstelle. US-spec cars requiring full Einzelabnahme and conversion work can extend this to 16–20 weeks.",
  faqs: [
    {
      question: "Is it cheaper to buy a Porsche in the US and import to Germany?",
      answer:
        "Rarely, once all costs are tallied. A US-sourced 964 at $80,000 lands in Germany at roughly €90,000–€100,000 after 10% duty, 19% VAT, shipping (€3,500), TÜV Einzelabnahme, and €3,000–€8,000 of conversion work. An equivalent German-market 964 typically trades at €85,000–€110,000. The math only works if the specific US car is materially under-market or is a rare spec (e.g. a Speedster, a 964 RS America) not available in Europe.",
    },
    {
      question: "What is H-Kennzeichen and why does it matter?",
      answer:
        "H-Kennzeichen is Germany's historic-vehicle registration, available to cars 30+ years old that are largely original and in roadworthy condition (§23 StVZO). Benefits: flat €191.73 annual road tax (vs €200–€400+ for a regular classic), full exemption from all Umweltzone / Low-Emission Zone restrictions in German cities, and recognition as a cultural-heritage vehicle. For any 1995-or-older Porsche in original condition, H-plate is almost always the right choice.",
    },
    {
      question: "Do I pay German VAT on a used Porsche from the EU?",
      answer:
        "No — intra-EU private-party transfers of used cars (owned 6+ months by the seller in the origin country) are VAT-neutral. VAT was already paid in the origin EU country and is not reassessed in Germany. You pay only the transfer and registration fees. Note: if you buy from a commercial dealer across an EU border, VAT handling differs (margin scheme or export VAT) — consult a tax advisor.",
    },
    {
      question: "TÜV for a 964 imported from the US — what's involved?",
      answer:
        "An Einzelabnahme under §21 StVZO. The car must be converted to EU specification: E-marked headlights (often Euro H4 units from a period-correct German 964), km/h speedometer (conversion or replacement instrument cluster), rear fog lamp installation, amber-to-red turn signal conversion, and side-marker deletion or modification. An emissions check is required unless the car qualifies for H-plate historical-vehicle status (§47 StVZO exempts historical vehicles from modern emissions requirements). Budget €3,000–€8,000 at a Porsche specialist plus €300–€800 TÜV fee, and 3–6 weeks of shop time.",
    },
    {
      question: "Can I drive a US-plated Porsche in Germany?",
      answer:
        "Only temporarily. A US-registered vehicle brought into Germany by a non-EU-resident tourist can be driven on its foreign plates for up to 12 months under the temporary-import regime (ATA Carnet or verbal declaration). A German resident cannot legally drive a US-plated car on German roads — the car must be registered in Germany within a short window (typically immediately upon residence). Enforcement is via police spot-checks and Zoll audits.",
    },
    {
      question: "How long does a German Porsche import take?",
      answer:
        "8–14 weeks for a standard case — 2 weeks export, 4–6 weeks shipping, 1–2 weeks Zoll, 1–3 weeks TÜV, 1 week Zulassung. US-spec cars requiring full conversion work can extend to 16–20 weeks. Intra-EU moves (Italy, France, Netherlands) complete in 3–5 weeks total because Zoll and Einzelabnahme are skipped.",
    },
    {
      question: "What's the difference between EU and non-EU Porsche import?",
      answer:
        "EU imports are duty-free, VAT-neutral (for private used-car transfers), and usually pass TÜV on the basis of the existing EU CoC — a €150–€400 inspection. Non-EU imports incur 10% customs duty, 19% Einfuhrumsatzsteuer, and require full Einzelabnahme with potential conversion work. The landed cost delta between EU and non-EU sourcing on the same car can exceed 35%.",
    },
    {
      question: "Is the 30-year H-Kennzeichen worth applying for?",
      answer:
        "Almost always yes for eligible cars. Savings: €100–€250/year in road tax vs regular plate; unrestricted access to Umweltzonen in Berlin, Stuttgart, Munich, Cologne, and 50+ other cities; and an implicit recognition of collector status that supports resale value. The one-time Gutachten cost is €100–€200. The only reason not to apply is if the car is heavily modified and would fail the originality assessment.",
    },
    {
      question: "Zoll process for a non-EU Porsche — step by step",
      answer:
        "1) Container arrives at Bremerhaven or Hamburg; 2) Customs broker files import declaration (ATLAS system) with invoice, bill of lading, insurance certificate; 3) Zoll assesses 10% customs duty on CIF value (cost + insurance + freight); 4) Zoll assesses 19% Einfuhrumsatzsteuer on (CIF + duty); 5) You pay both via SEPA transfer; 6) Zoll issues the Zollbescheid and releases the car; 7) Broker coordinates release and onward transport to TÜV. Total clearance time: 5–10 business days.",
    },
    {
      question: "Can I re-import a German-original Porsche (Rückimport)?",
      answer:
        "Yes, and it is the preferred scenario. Rückimport cars — Porsches originally built for Germany or other EU markets and subsequently sold abroad — retain their original EU type approval. Porsche Classic can reissue the CoC from factory records (€200–€400), matching numbers verification is straightforward, and TÜV Abnahme typically passes on first attempt. Rückimport cars often trade at a premium over equivalent cars that were always-abroad due to simpler paperwork and the cultural preference in the German market for cars returning home.",
    },
  ],
  keywords: [
    "Porsche Import Deutschland",
    "Porsche nach Deutschland importieren",
    "H-Kennzeichen Porsche",
    "TÜV Einzelabnahme Porsche",
    "Porsche Rückimport",
    "Zoll Porsche USA Deutschland",
    "Einfuhrumsatzsteuer Porsche",
    "Porsche 964 US Import Deutschland",
    "Vollabnahme Porsche",
    "§23 StVZO Porsche",
    "Porsche Classic CoC Deutschland",
    "Kfz-Zulassungsstelle Porsche Import",
  ],
};
