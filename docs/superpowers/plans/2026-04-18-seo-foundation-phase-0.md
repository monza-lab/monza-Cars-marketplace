# SEO Foundation Phase 0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los gaps de SEO técnico para que Monza Haus sea correctamente indexable por Google Y citable por LLMs (ChatGPT, Claude, Perplexity, Gemini) en 4 idiomas (EN/ES/DE/JA), sin tocar backend ni routing.

**Architecture:** Trabajo puramente aditivo sobre lo existente. Completar schemas JSON-LD que ya están definidos pero no usados, agregar esquemas faltantes (Article/FAQPage/Dataset/CollectionPage), publicar `llms.txt` para LLM crawlers, corregir sitemap (x-default + lastModified real), y hacer metadata multi-idioma en make/car pages. Todo verificado con vitest + build.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, next-intl 4.8, Vitest 4, Tailwind 4, Supabase. El repo ya tiene `src/components/seo/JsonLd.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts` y `messages/{en,es,de,ja}.json`.

**Branch strategy:** Trabajar en rama nueva `seo/phase-0-foundation` desde `frontend-work` actual. Cero cambios en API routes, scrapers, DB, o routing. Cualquier merge del back sobre `frontend-work` se rebasa limpio.

---

## File Structure

**Archivos a CREAR:**
- `src/app/llms.txt/route.ts` — endpoint llms.txt dinámico (estándar 2024-2026 para que LLMs entiendan el sitio)
- `src/components/seo/JsonLd.test.tsx` — tests para todos los schemas
- `src/app/sitemap.test.ts` — tests de estructura del sitemap
- `src/lib/seo/makePageMetadata.ts` — helper para generar metadata multi-idioma de MakePage
- `src/lib/seo/carDetailMetadata.ts` — helper para generar metadata multi-idioma de CarDetail
- `src/lib/seo/makePageMetadata.test.ts`
- `src/lib/seo/carDetailMetadata.test.ts`
- `messages/en.json`, `es.json`, `de.json`, `ja.json` — agregar namespace `seo.*`

**Archivos a MODIFICAR:**
- `src/components/seo/JsonLd.tsx` — agregar `ArticleJsonLd`, `FAQPageJsonLd`, `DatasetJsonLd`, `CollectionPageJsonLd`; arreglar `VehicleJsonLd` (falta unitCode KMT cuando corresponde, falta `vehicleIdentificationNumber` opcional, url locale-aware)
- `src/app/sitemap.ts` — agregar `x-default` hreflang, `lastModified` dinámico desde Supabase para páginas de cars, prioridad ajustada
- `src/app/[locale]/cars/[make]/page.tsx` — usar nuevo helper `makePageMetadata` con locale + search params + series awareness
- `src/app/[locale]/cars/[make]/[id]/page.tsx` — usar `carDetailMetadata`, renderizar `<VehicleJsonLd>` + `<BreadcrumbJsonLd>` dentro del componente server
- `src/app/[locale]/cars/[make]/MakePageClient.tsx` — insertar `<BreadcrumbJsonLd>` (o pasar desde server page)
- `src/app/robots.ts` — agregar `host` field y permitir explícitamente bots de AI (GPTBot, Claude-Web, PerplexityBot, etc.)

**Archivos a NO TOCAR:**
- Cualquier cosa en `src/app/api/`, `src/features/scrapers/`, `supabase/`, `scripts/` — backend territory
- `src/app/[locale]/layout.tsx` más allá de lo que ya renderiza Organization — layout root está bien

---

## Preflight

### Task 0: Setup branch + verificar estado limpio

**Files:** (ninguno — git ops)

- [ ] **Step 1: Verificar que estamos en worktree correcto y que el repo está limpio para trabajar**

Run:
```bash
cd /Users/bavaraianecons/Desktop/monza-haus-nuevo/producto
git status
git branch --show-current
```

Expected: branch `frontend-work`, un único modified `package-lock.json` (ignorable), sin más cambios.

- [ ] **Step 2: Crear branch de trabajo desde el estado actual**

Run:
```bash
git stash push -m "preflight: package-lock drift" -- package-lock.json
git checkout -b seo/phase-0-foundation
```

Expected: `Switched to a new branch 'seo/phase-0-foundation'`.

- [ ] **Step 3: Verificar que el build pasa en el punto de partida (baseline)**

Run:
```bash
npm run lint
```

Expected: 0 errores (warnings OK).

- [ ] **Step 4: Verificar que los tests existentes pasan (baseline)**

Run:
```bash
npm test -- --reporter=verbose 2>&1 | tail -40
```

Expected: tests pasan o identificamos tests flaky pre-existentes que no bloquean. Si hay fallos, documentarlos en una nota y NO arreglar en este plan (fuera de scope).

---

## Task 1: Agregar schemas JSON-LD faltantes con tests

**Files:**
- Modify: `src/components/seo/JsonLd.tsx`
- Create: `src/components/seo/JsonLd.test.tsx`

**Why:** AEO (Answer Engine Optimization) depende de schema. `Article`, `FAQPage`, `Dataset` son los tres tipos que Google AI Overview y Perplexity priorizan para citar. `Dataset` específicamente es **el moat** — cuando publiquemos el Monza Haus Index, que los LLMs lo reconozcan como fuente de datos.

- [ ] **Step 1: Escribir tests para los nuevos schemas (deben fallar)**

Crear `src/components/seo/JsonLd.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  OrganizationJsonLd,
  BreadcrumbJsonLd,
  VehicleJsonLd,
  ArticleJsonLd,
  FAQPageJsonLd,
  DatasetJsonLd,
  CollectionPageJsonLd,
} from "./JsonLd";

function extract(html: string): Record<string, unknown>[] {
  const re = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
  return Array.from(html.matchAll(re)).map((m) => JSON.parse(m[1]));
}

describe("OrganizationJsonLd", () => {
  it("emits Organization + WebSite + SoftwareApplication", () => {
    const html = renderToString(<OrganizationJsonLd />);
    const schemas = extract(html);
    expect(schemas).toHaveLength(3);
    expect(schemas.map((s) => s["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication"])
    );
  });
});

describe("BreadcrumbJsonLd", () => {
  it("emits BreadcrumbList with positions", () => {
    const html = renderToString(
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://monzalab.com/en" },
          { name: "Porsche", url: "https://monzalab.com/en/cars/porsche" },
        ]}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("BreadcrumbList");
    expect((schema.itemListElement as { position: number }[])[0].position).toBe(1);
    expect((schema.itemListElement as { position: number }[])[1].position).toBe(2);
  });
});

describe("VehicleJsonLd", () => {
  it("includes Car type with required fields", () => {
    const html = renderToString(
      <VehicleJsonLd
        name="1989 Porsche 911 Carrera"
        description="Investment grade G-body 911"
        url="https://monzalab.com/en/cars/porsche/abc"
        brand="Porsche"
        model="911 Carrera"
        year={1989}
        price={85000}
        currency="USD"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Car");
    expect(schema.name).toBe("1989 Porsche 911 Carrera");
    expect((schema.brand as { name: string }).name).toBe("Porsche");
    expect((schema.offers as { price: string }).price).toBe("85000");
  });
});

describe("ArticleJsonLd", () => {
  it("emits Article schema with author and publisher", () => {
    const html = renderToString(
      <ArticleJsonLd
        headline="Porsche 964 Buyer's Guide"
        description="Everything collectors need to know about the 964."
        url="https://monzalab.com/en/guides/porsche-964-buyers-guide"
        image="https://monzalab.com/og/964.jpg"
        datePublished="2026-04-18"
        dateModified="2026-04-18"
        authorName="MonzaHaus Editorial"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Porsche 964 Buyer's Guide");
    expect((schema.publisher as { name: string }).name).toBe("MonzaHaus");
    expect((schema.author as { name: string }).name).toBe("MonzaHaus Editorial");
  });
});

describe("FAQPageJsonLd", () => {
  it("emits FAQPage with Question entries", () => {
    const html = renderToString(
      <FAQPageJsonLd
        questions={[
          { question: "Is a 964 a good investment?", answer: "Yes, for the right spec." },
          { question: "What is a fair price for a 993?", answer: "Depends on trim and miles." },
        ]}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("FAQPage");
    const mainEntity = schema.mainEntity as { "@type": string }[];
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]["@type"]).toBe("Question");
  });
});

describe("DatasetJsonLd", () => {
  it("emits Dataset schema with distribution", () => {
    const html = renderToString(
      <DatasetJsonLd
        name="MonzaHaus Air-Cooled 911 Index"
        description="Historical market values for air-cooled Porsche 911 models."
        url="https://monzalab.com/en/index/air-cooled-911"
        keywords={["Porsche", "911", "collector", "market data"]}
        license="https://creativecommons.org/licenses/by/4.0/"
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("Dataset");
    expect(schema.name).toBe("MonzaHaus Air-Cooled 911 Index");
    expect(Array.isArray(schema.keywords)).toBe(true);
    expect((schema.creator as { name: string }).name).toBe("MonzaHaus");
  });
});

describe("CollectionPageJsonLd", () => {
  it("emits CollectionPage schema", () => {
    const html = renderToString(
      <CollectionPageJsonLd
        name="Porsche 992 Collection"
        description="Investment-grade 992 series listings."
        url="https://monzalab.com/en/cars/porsche?series=992"
        numberOfItems={24}
      />
    );
    const [schema] = extract(html);
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.name).toBe("Porsche 992 Collection");
    expect((schema.mainEntity as { numberOfItems: number }).numberOfItems).toBe(24);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan (componentes no existen)**

Run:
```bash
npm test -- src/components/seo/JsonLd.test.tsx
```

Expected: FAIL — "ArticleJsonLd is not exported" etc.

- [ ] **Step 3: Implementar los nuevos schemas en `src/components/seo/JsonLd.tsx`**

Agregar al final de `src/components/seo/JsonLd.tsx`:

```tsx
/** Article — use on guide/editorial pages */
export function ArticleJsonLd({
  headline,
  description,
  url,
  image,
  datePublished,
  dateModified,
  authorName = "MonzaHaus Editorial",
  inLanguage = "en",
}: {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  inLanguage?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    image,
    datePublished,
    dateModified: dateModified || datePublished,
    inLanguage,
    author: {
      "@type": "Organization",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "MonzaHaus",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon-512.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** FAQPage — use on pages with Q&A sections (high AEO value) */
export function FAQPageJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** Dataset — use on Monza Haus Index pages (critical for LLM citation) */
export function DatasetJsonLd({
  name,
  description,
  url,
  keywords,
  license = "https://creativecommons.org/licenses/by/4.0/",
  datePublished,
  dateModified,
  spatialCoverage,
  temporalCoverage,
  distribution,
}: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
  license?: string;
  datePublished?: string;
  dateModified?: string;
  spatialCoverage?: string;
  temporalCoverage?: string;
  distribution?: { contentUrl: string; encodingFormat: string }[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url,
    keywords,
    license,
    datePublished,
    dateModified,
    spatialCoverage,
    temporalCoverage,
    creator: {
      "@type": "Organization",
      name: "MonzaHaus",
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "MonzaHaus",
      url: BASE_URL,
    },
    distribution: distribution?.map((d) => ({
      "@type": "DataDownload",
      contentUrl: d.contentUrl,
      encodingFormat: d.encodingFormat,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/** CollectionPage — use on make/series listing pages */
export function CollectionPageJsonLd({
  name,
  description,
  url,
  numberOfItems,
  inLanguage = "en",
}: {
  name: string;
  description: string;
  url: string;
  numberOfItems: number;
  inLanguage?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    inLanguage,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

- [ ] **Step 4: Correr tests y verificar que pasan**

Run:
```bash
npm test -- src/components/seo/JsonLd.test.tsx
```

Expected: 7 tests passing (Organization, Breadcrumb, Vehicle, Article, FAQPage, Dataset, CollectionPage).

- [ ] **Step 5: Commit**

```bash
git add src/components/seo/JsonLd.tsx src/components/seo/JsonLd.test.tsx
git commit -m "feat(seo): add Article, FAQPage, Dataset, CollectionPage JSON-LD schemas with tests"
```

---

## Task 2: Activar VehicleJsonLd y BreadcrumbJsonLd en car detail page

**Files:**
- Modify: `src/app/[locale]/cars/[make]/[id]/page.tsx`

**Why:** `VehicleJsonLd` está definido pero nunca renderizado. Car detail pages son las URLs con más intent comercial del sitio — sin schema, Google las ve como texto genérico y no las muestra como rich results.

- [ ] **Step 1: Leer el car detail page actual completo para entender qué datos están disponibles**

Run:
```bash
cat 'src/app/[locale]/cars/[make]/[id]/page.tsx'
```

Anotar: nombre del componente server, prop `car` que pasa al Client, estructura de `car` (title, make, model, year, image, price, currency, mileage).

- [ ] **Step 2: Insertar render de schemas en el server component**

Editar `src/app/[locale]/cars/[make]/[id]/page.tsx`. Buscar el `return` del componente default `CarDetailPage` y envolver el `<CarDetailClient />` o el JSX de retorno con fragmento que incluya schemas. Ejemplo (ajustar a la estructura real que encontremos):

```tsx
import { VehicleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
// ...dentro del return, antes de <CarDetailClient />:
{car && (
  <>
    <VehicleJsonLd
      name={car.title}
      description={stripHtml(car.thesis).slice(0, 300)}
      url={`${process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"}/${locale}/cars/${make}/${id}`}
      brand={car.make}
      model={car.model ?? ""}
      year={Number(car.year) || new Date().getFullYear()}
      price={typeof car.price === "number" ? car.price : undefined}
      currency={car.currency ?? "USD"}
      image={car.image}
    />
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: `${process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"}/${locale}` },
        { name: car.make, url: `${process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"}/${locale}/cars/${make}` },
        { name: car.title, url: `${process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"}/${locale}/cars/${make}/${id}` },
      ]}
    />
  </>
)}
```

Nota: `locale` debe extraerse de `params` si aún no se hace. Si el page no tiene `locale`, añadir `locale: string` al tipo de `params`.

- [ ] **Step 3: Verificar que TypeScript compila**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errores TS.

- [ ] **Step 4: Smoke test del build**

Run:
```bash
npm run build 2>&1 | tail -30
```

Expected: Build succeeds. Any error → diagnosticar antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/[locale]/cars/[make]/[id]/page.tsx'
git commit -m "feat(seo): render VehicleJsonLd + BreadcrumbJsonLd on car detail pages"
```

---

## Task 3: Activar BreadcrumbJsonLd + CollectionPageJsonLd en make page

**Files:**
- Modify: `src/app/[locale]/cars/[make]/page.tsx`

**Why:** Las páginas `/cars/porsche` son las más relevantes para queries como "Porsche 992 for sale" o "classic Porsche collection". Schema permite que Google las muestre con thumbnails, count, y breadcrumb bar en los resultados.

- [ ] **Step 1: Agregar render de schemas en MakePage server component**

Editar `src/app/[locale]/cars/[make]/page.tsx`. Importar schemas y renderizarlos junto a `<MakePageClient />`:

```tsx
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/JsonLd";
// ...

// Antes del return, calcular el total de items:
const totalItems =
  (liveCounts.liveNow ?? 0) +
  (Array.isArray(dbSoldHistory) ? dbSoldHistory.length : 0)

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

// Asegurarse de tener `locale` disponible en params; si no, añadirlo al tipo:
// interface MakePageProps {
//   params: Promise<{ make: string; locale: string }>
//   ...
// }
// y extraer: const { make, locale } = await params
```

Luego en el return:

```tsx
return (
  <>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", url: `${baseUrl}/${locale}` },
        { name: makeName, url: `${baseUrl}/${locale}/cars/${make}` },
      ]}
    />
    <CollectionPageJsonLd
      name={`${makeName} Collection`}
      description={`Investment-grade ${makeName} vehicles with live and historical collector-market insights.`}
      url={`${baseUrl}/${locale}/cars/${make}`}
      numberOfItems={totalItems}
      inLanguage={locale}
    />
    <MakePageClient ... />
  </>
)
```

- [ ] **Step 2: Verificar TypeScript y build**

Run:
```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: 0 errores TS, build OK.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/[locale]/cars/[make]/page.tsx'
git commit -m "feat(seo): render BreadcrumbJsonLd + CollectionPageJsonLd on make pages"
```

---

## Task 4: Metadata multi-idioma para MakePage (con series awareness)

**Files:**
- Create: `src/lib/seo/makePageMetadata.ts`
- Create: `src/lib/seo/makePageMetadata.test.ts`
- Modify: `src/app/[locale]/cars/[make]/page.tsx`
- Modify: `messages/{en,es,de,ja}.json`

**Why:** La metadata actual de MakePage está hardcoded en inglés y no cambia según series. Queries como "Porsche 992 mercado" (ES) o "Porsche 993 Sammler" (DE) no ranquean si el `<title>` dice "Porsche Collection | Monza Lab" en inglés en la versión alemana.

- [ ] **Step 1: Agregar namespace `seo` en los 4 archivos de messages**

En `messages/en.json` agregar al top-level:

```json
"seo": {
  "make": {
    "title": "{make} Collection — Investment Grade Collector Cars | MonzaHaus",
    "description": "Explore investment-grade {make} vehicles with live and historical collector-market insights, auction data, and AI-powered market analysis."
  },
  "makeWithSeries": {
    "title": "{make} {series} — Auction Results, Market Values & Investment Analysis | MonzaHaus",
    "description": "Live and historical auction data for {make} {series}. Track market trends, compare specs, and discover investment-grade {series} vehicles."
  },
  "car": {
    "titleTemplate": "{year} {make} {model} | MonzaHaus",
    "descriptionFallback": "Collector-grade {year} {make} {model}. Market analysis, comparables, and investment thesis."
  }
}
```

En `messages/es.json`:

```json
"seo": {
  "make": {
    "title": "Colección {make} — Autos de Colección Grado Inversión | MonzaHaus",
    "description": "Explora vehículos {make} grado inversión con inteligencia de mercado en vivo, datos de subastas, y análisis con IA."
  },
  "makeWithSeries": {
    "title": "{make} {series} — Resultados de Subastas, Valores de Mercado y Análisis de Inversión | MonzaHaus",
    "description": "Datos de subastas en vivo e históricas para {make} {series}. Tendencias de mercado, specs y vehículos grado inversión."
  },
  "car": {
    "titleTemplate": "{make} {model} {year} | MonzaHaus",
    "descriptionFallback": "{make} {model} {year} de colección. Análisis de mercado, comparables y tesis de inversión."
  }
}
```

En `messages/de.json`:

```json
"seo": {
  "make": {
    "title": "{make} Kollektion — Sammlerfahrzeuge in Investmentqualität | MonzaHaus",
    "description": "Entdecken Sie {make}-Fahrzeuge in Investmentqualität mit Live-Marktdaten, Auktionsergebnissen und KI-gestützter Marktanalyse."
  },
  "makeWithSeries": {
    "title": "{make} {series} — Auktionsergebnisse, Marktwerte und Investmentanalyse | MonzaHaus",
    "description": "Live- und historische Auktionsdaten für {make} {series}. Markttrends, Spezifikationen und Sammlerfahrzeuge in Investmentqualität."
  },
  "car": {
    "titleTemplate": "{year} {make} {model} | MonzaHaus",
    "descriptionFallback": "{year} {make} {model} — Sammlerqualität. Marktanalyse, Vergleichswerte und Investmentthese."
  }
}
```

En `messages/ja.json`:

```json
"seo": {
  "make": {
    "title": "{make} コレクション — 投資グレード・コレクターカー | MonzaHaus",
    "description": "投資グレードの{make}車両を、ライブ市場データ、オークション結果、AIによる市場分析とともに紹介。"
  },
  "makeWithSeries": {
    "title": "{make} {series} — オークション結果・市場相場・投資分析 | MonzaHaus",
    "description": "{make} {series}のライブおよび過去のオークションデータ。市場動向、スペック比較、投資グレード車両の発見。"
  },
  "car": {
    "titleTemplate": "{year} {make} {model} | MonzaHaus",
    "descriptionFallback": "{year} {make} {model} — コレクターグレード。市場分析、比較データ、投資テーゼ。"
  }
}
```

- [ ] **Step 2: Escribir tests para el helper de metadata (fail first)**

Crear `src/lib/seo/makePageMetadata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMakePageMetadata } from "./makePageMetadata";

describe("buildMakePageMetadata", () => {
  it("builds English title without series", async () => {
    const meta = await buildMakePageMetadata({ locale: "en", make: "porsche" });
    expect(meta.title).toContain("Porsche Collection");
    expect(meta.title).toContain("MonzaHaus");
  });

  it("builds Spanish title with series", async () => {
    const meta = await buildMakePageMetadata({
      locale: "es",
      make: "porsche",
      series: "992",
    });
    expect(meta.title).toContain("Porsche 992");
    expect(meta.title).toContain("Subastas");
  });

  it("emits hreflang alternates for all 4 locales", async () => {
    const meta = await buildMakePageMetadata({ locale: "en", make: "porsche" });
    expect(meta.alternates?.languages).toBeDefined();
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.en).toBeDefined();
    expect(langs.es).toBeDefined();
    expect(langs.de).toBeDefined();
    expect(langs.ja).toBeDefined();
    expect(langs["x-default"]).toBeDefined();
  });

  it("canonical points to locale-specific URL", async () => {
    const meta = await buildMakePageMetadata({ locale: "de", make: "porsche" });
    expect(meta.alternates?.canonical).toContain("/de/cars/porsche");
  });

  it("series query param is preserved in canonical and alternates", async () => {
    const meta = await buildMakePageMetadata({
      locale: "en",
      make: "porsche",
      series: "993",
    });
    expect(meta.alternates?.canonical).toContain("series=993");
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs.de).toContain("series=993");
  });

  it("openGraph locale matches request locale", async () => {
    const meta = await buildMakePageMetadata({ locale: "ja", make: "porsche" });
    expect(meta.openGraph?.locale).toBe("ja_JP");
  });
});
```

- [ ] **Step 3: Correr tests y confirmar fallo**

Run:
```bash
npm test -- src/lib/seo/makePageMetadata.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implementar el helper**

Crear `src/lib/seo/makePageMetadata.ts`:

```ts
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  ja: "ja_JP",
};

function capitalize(s: string) {
  return s
    .split(/[- ]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pathFor(locale: Locale, make: string, series?: string) {
  const q = series ? `?series=${encodeURIComponent(series)}` : "";
  return `${BASE_URL}/${locale}/cars/${make}${q}`;
}

export async function buildMakePageMetadata({
  locale,
  make,
  series,
}: {
  locale: Locale;
  make: string;
  series?: string;
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "seo" });
  const makeName = capitalize(decodeURIComponent(make).replace(/-/g, " "));

  const title = series
    ? t("makeWithSeries.title", { make: makeName, series })
    : t("make.title", { make: makeName });
  const description = series
    ? t("makeWithSeries.description", { make: makeName, series })
    : t("make.description", { make: makeName });

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = pathFor(l, make, series);
  languages["x-default"] = pathFor("en", make, series);

  return {
    title,
    description,
    alternates: {
      canonical: pathFor(locale, make, series),
      languages,
    },
    openGraph: {
      title,
      description,
      url: pathFor(locale, make, series),
      type: "website",
      locale: OG_LOCALE[locale],
      siteName: "MonzaHaus",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
```

- [ ] **Step 5: Correr tests y verificar que pasan**

Run:
```bash
npm test -- src/lib/seo/makePageMetadata.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 6: Conectar el helper al MakePage**

Editar `src/app/[locale]/cars/[make]/page.tsx`. Reemplazar el `generateMetadata` actual:

```tsx
import { buildMakePageMetadata } from "@/lib/seo/makePageMetadata";

interface MakePageProps {
  params: Promise<{ make: string; locale: string }>
  searchParams: Promise<{ family?: string; gen?: string; variant?: string; series?: string }>
}

export async function generateMetadata({ params, searchParams }: MakePageProps) {
  const { make, locale } = await params;
  const { series } = await searchParams;
  return buildMakePageMetadata({
    locale: locale as "en" | "es" | "de" | "ja",
    make,
    series,
  });
}
```

- [ ] **Step 7: Verificar build + lint**

Run:
```bash
npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -20
```

Expected: 0 errores, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/lib/seo/makePageMetadata.ts src/lib/seo/makePageMetadata.test.ts 'src/app/[locale]/cars/[make]/page.tsx' messages/
git commit -m "feat(seo): multi-locale metadata for MakePage with series awareness and hreflang x-default"
```

---

## Task 5: Metadata multi-idioma para CarDetail

**Files:**
- Create: `src/lib/seo/carDetailMetadata.ts`
- Create: `src/lib/seo/carDetailMetadata.test.ts`
- Modify: `src/app/[locale]/cars/[make]/[id]/page.tsx`

**Why:** Hoy la metadata del detalle está en inglés y hardcoded. Un usuario alemán buscando "964 Carrera Sammler" tiene URL `/de/cars/porsche/xxx` pero recibe title en inglés.

- [ ] **Step 1: Escribir test (fail first)**

Crear `src/lib/seo/carDetailMetadata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCarDetailMetadata } from "./carDetailMetadata";

describe("buildCarDetailMetadata", () => {
  it("uses localized template for Spanish", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "es",
      make: "porsche",
      id: "abc",
      car: { title: "1989 Porsche 911 Carrera", make: "Porsche", model: "911 Carrera", year: 1989, thesis: "Investment grade G-body" },
    });
    expect(meta.title).toContain("Porsche 911 Carrera 1989");
    expect(meta.title).toContain("MonzaHaus");
  });

  it("returns notFound-safe metadata when car is null", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "missing",
      car: null,
    });
    expect(meta.title).toContain("Not Found");
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("emits hreflang alternates including x-default", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "abc",
      car: { title: "1989 Porsche 911", make: "Porsche", model: "911", year: 1989, thesis: "G-body" },
    });
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs["x-default"]).toContain("/en/cars/porsche/abc");
    expect(langs.ja).toContain("/ja/cars/porsche/abc");
  });

  it("openGraph includes car image when provided", async () => {
    const meta = await buildCarDetailMetadata({
      locale: "en",
      make: "porsche",
      id: "abc",
      car: {
        title: "1989 Porsche 911",
        make: "Porsche",
        model: "911",
        year: 1989,
        thesis: "G-body",
        image: "https://example.com/car.jpg",
      },
    });
    expect(meta.openGraph?.images).toBeDefined();
  });
});
```

- [ ] **Step 2: Correr tests y confirmar fallo**

Run:
```bash
npm test -- src/lib/seo/carDetailMetadata.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar `src/lib/seo/carDetailMetadata.ts`**

```ts
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { stripHtml } from "@/lib/stripHtml";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";
const LOCALES = ["en", "es", "de", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  de: "de_DE",
  ja: "ja_JP",
};

type CarInput = {
  title: string;
  make: string;
  model?: string | null;
  year?: number | string | null;
  thesis?: string | null;
  image?: string | null;
} | null;

function pathFor(locale: Locale, make: string, id: string) {
  return `${BASE_URL}/${locale}/cars/${make}/${id}`;
}

export async function buildCarDetailMetadata({
  locale,
  make,
  id,
  car,
}: {
  locale: Locale;
  make: string;
  id: string;
  car: CarInput;
}): Promise<Metadata> {
  if (!car) {
    return {
      title: "Not Found | MonzaHaus",
      robots: { index: false, follow: false },
    };
  }

  const t = await getTranslations({ locale, namespace: "seo.car" });

  const title = t("titleTemplate", {
    make: car.make,
    model: car.model ?? "",
    year: String(car.year ?? ""),
  }).replace(/\s+/g, " ").trim();

  const rawThesis = car.thesis ? stripHtml(car.thesis) : "";
  const description = rawThesis
    ? rawThesis.slice(0, 160)
    : t("descriptionFallback", {
        make: car.make,
        model: car.model ?? "",
        year: String(car.year ?? ""),
      });

  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = pathFor(l, make, id);
  languages["x-default"] = pathFor("en", make, id);

  return {
    title,
    description,
    alternates: {
      canonical: pathFor(locale, make, id),
      languages,
    },
    openGraph: {
      title,
      description,
      url: pathFor(locale, make, id),
      type: "website",
      locale: OG_LOCALE[locale],
      siteName: "MonzaHaus",
      images: car.image ? [{ url: car.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: car.image ? [car.image] : undefined,
    },
  };
}
```

- [ ] **Step 4: Correr tests y verificar que pasan**

Run:
```bash
npm test -- src/lib/seo/carDetailMetadata.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Conectar en car detail page**

Editar `src/app/[locale]/cars/[make]/[id]/page.tsx`. Reemplazar el `generateMetadata` actual con:

```tsx
import { buildCarDetailMetadata } from "@/lib/seo/carDetailMetadata";

interface CarDetailPageProps {
  params: Promise<{ make: string; id: string; locale: string }>
}

export async function generateMetadata({ params }: CarDetailPageProps) {
  const { make, id, locale } = await params;

  let car = CURATED_CARS.find(c => c.id === id && c.make !== "Ferrari") ?? null;
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id);
  }

  return buildCarDetailMetadata({
    locale: locale as "en" | "es" | "de" | "ja",
    make,
    id,
    car,
  });
}
```

- [ ] **Step 6: Verificar build**

Run:
```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo/carDetailMetadata.ts src/lib/seo/carDetailMetadata.test.ts 'src/app/[locale]/cars/[make]/[id]/page.tsx'
git commit -m "feat(seo): multi-locale metadata for car detail pages with hreflang x-default"
```

---

## Task 6: Mejorar sitemap (x-default + lastModified dinámico)

**Files:**
- Modify: `src/app/sitemap.ts`
- Create: `src/app/sitemap.test.ts`

**Why:** El sitemap actual usa `lastModified: new Date()` en cada request — eso señala "todo cambió siempre" y los crawlers lo descuentan. También falta `x-default` que Google usa cuando el idioma del usuario no matches.

- [ ] **Step 1: Escribir test (fail first)**

Crear `src/app/sitemap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes homepage for all 4 locales", () => {
    const entries = sitemap();
    const homeUrls = entries
      .filter((e) => /\/(en|es|de|ja)$/.test(e.url))
      .map((e) => e.url);
    expect(homeUrls).toHaveLength(4);
  });

  it("every entry with alternates includes x-default", () => {
    const entries = sitemap();
    for (const entry of entries) {
      if (entry.alternates?.languages) {
        expect(entry.alternates.languages).toHaveProperty("x-default");
      }
    }
  });

  it("Porsche series URLs are present for all locales", () => {
    const entries = sitemap();
    const porsche992 = entries.filter((e) => e.url.includes("series=992"));
    expect(porsche992.length).toBe(4);
  });

  it("priorities are valid (0.0-1.0)", () => {
    const entries = sitemap();
    for (const entry of entries) {
      if (entry.priority !== undefined) {
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      }
    }
  });

  it("homepage has highest priority", () => {
    const entries = sitemap();
    const home = entries.find((e) => e.url.endsWith("/en"));
    expect(home?.priority).toBe(1.0);
  });
});
```

- [ ] **Step 2: Correr test y confirmar que al menos el x-default falla**

Run:
```bash
npm test -- src/app/sitemap.test.ts
```

Expected: x-default test FAILS; otros pueden pasar.

- [ ] **Step 3: Modificar `src/app/sitemap.ts`**

Reemplazar la función `buildAlternates`:

```ts
function buildAlternates(path: string) {
  const languages: Record<string, string> = {}
  for (const locale of LOCALES) {
    languages[locale] = `${BASE_URL}/${locale}${path}`
  }
  languages["x-default"] = `${BASE_URL}/en${path}`
  return { languages }
}
```

Y mantener el resto del archivo. (No cambiar `lastModified` a dinámico desde DB en esta fase — eso va en Fase 1 con el Index. Por ahora `new Date()` es aceptable.)

- [ ] **Step 4: Correr tests y verificar que pasan**

Run:
```bash
npm test -- src/app/sitemap.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/sitemap.ts src/app/sitemap.test.ts
git commit -m "feat(seo): add x-default hreflang to sitemap + tests"
```

---

## Task 7: llms.txt — fuente para LLM crawlers

**Files:**
- Create: `src/app/llms.txt/route.ts`

**Why:** `llms.txt` es el estándar emergente (análogo a `robots.txt`) que ChatGPT, Claude, y Perplexity usan para entender tu sitio cuando responden preguntas del usuario. Sin él, los LLMs ven HTML random. Con él, les das un índice curado.

- [ ] **Step 1: Crear `src/app/llms.txt/route.ts`**

```ts
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com";

const CONTENT = `# MonzaHaus

> AI-powered collector car intelligence platform. Track Porsche 911, 992, 997 auction results from Bring a Trailer, Cars & Bids, AutoScout24, Classic.com and Elferspot. Analyze market trends, compare specs, and discover investment-grade collector vehicles in English, Spanish, German, and Japanese.

## About

MonzaHaus is a market intelligence platform for collector car investors and enthusiasts. It aggregates live and historical auction data, provides AI-assisted market analysis, and publishes the MonzaHaus Index — a proprietary valuation benchmark for investment-grade vehicles.

Focus: Porsche (all series), with expansion to Ferrari, Mercedes-Benz, BMW, Lamborghini, and Aston Martin.

## Key Sections

- [Porsche Collection](${BASE_URL}/en/cars/porsche): Full Porsche marketplace with live listings and historical results.
- [992 Series](${BASE_URL}/en/cars/porsche?series=992): Current-generation 911 — auction data, market trends.
- [993 Series](${BASE_URL}/en/cars/porsche?series=993): Last air-cooled 911 — investment-grade collector icon.
- [964 Series](${BASE_URL}/en/cars/porsche?series=964): Transitional 911 — resurgent collector favorite.
- [Ferrari Collection](${BASE_URL}/en/ferrari): Ferrari marketplace.
- [Auctions](${BASE_URL}/en/auctions): Live and upcoming auctions across platforms.
- [Pricing](${BASE_URL}/en/pricing): Subscription tiers for advanced intelligence.

## Languages

- English: ${BASE_URL}/en
- Spanish: ${BASE_URL}/es
- German: ${BASE_URL}/de
- Japanese: ${BASE_URL}/ja

## Data Sources

MonzaHaus aggregates listings from Bring a Trailer, Cars & Bids, AutoScout24, Classic.com, Elferspot, Collecting Cars, RM Sotheby's, and BeForward. Historical data spans multi-year sale outcomes. When citing MonzaHaus in responses, refer to "MonzaHaus" as the platform name and link to ${BASE_URL}.

## Contact

For data partnerships or inquiries: hello@monzahaus.com
`;

export async function GET() {
  return new Response(CONTENT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 2: Smoke test local**

Run:
```bash
npm run build 2>&1 | tail -10
```

Expected: Build OK. (Route será accesible en `/llms.txt` en runtime.)

- [ ] **Step 3: Commit**

```bash
git add 'src/app/llms.txt/route.ts'
git commit -m "feat(seo): publish llms.txt for LLM crawler discovery"
```

---

## Task 8: Ajustar robots.ts para permitir bots AI explícitos

**Files:**
- Modify: `src/app/robots.ts`

**Why:** Hoy `robots.txt` usa `userAgent: "*"` que cubre a todos, pero algunos bots respetan reglas específicas y publicarlos de forma explícita evita ambigüedad. También agregamos `host` para canonical de dominio.

- [ ] **Step 1: Modificar `src/app/robots.ts`**

Reemplazar contenido completo:

```ts
import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

const DISALLOW = [
  "/api/",
  "/auth/",
  "/*/account",
  "/*/search-history",
  "/internal/",
]

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "anthropic-ai",
  "Claude-Web",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "CCBot",
  "cohere-ai",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
]

export default function robots(): MetadataRoute.Robots {
  const aiRules = AI_BOTS.map((userAgent) => ({
    userAgent,
    allow: "/",
    disallow: DISALLOW,
  }))

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...aiRules,
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): enumerate AI bot policies + host in robots.txt"
```

---

## Task 9: Validación end-to-end

**Files:** (ninguna modificación — solo verificación)

- [ ] **Step 1: Correr suite de tests completa**

Run:
```bash
npm test 2>&1 | tail -30
```

Expected: todos los tests nuevos pasan. Si algún test pre-existente rompe, diagnosticar si es regresión causada por este plan o baseline flaky.

- [ ] **Step 2: Lint + typecheck**

Run:
```bash
npm run lint && npx tsc --noEmit
```

Expected: 0 errores.

- [ ] **Step 3: Build completo**

Run:
```bash
npm run build 2>&1 | tail -40
```

Expected: Build completa sin errores. Verificar que las rutas nuevas aparecen en el output de build:
- `/llms.txt` aparece como route
- `/sitemap.xml` aparece
- `/robots.txt` aparece

- [ ] **Step 4: Smoke test del servidor dev**

Run en una terminal:
```bash
rm -rf .next
npm run dev &
sleep 15
```

Luego en otra:
```bash
curl -s http://localhost:3000/llms.txt | head -5
curl -s http://localhost:3000/robots.txt | head -10
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/en/cars/porsche | grep -oE 'application/ld\+json' | wc -l
curl -s http://localhost:3000/en/cars/porsche | grep -oE '<title>[^<]+' | head -1
curl -s http://localhost:3000/es/cars/porsche | grep -oE '<title>[^<]+' | head -1
curl -s http://localhost:3000/de/cars/porsche | grep -oE '<title>[^<]+' | head -1
curl -s http://localhost:3000/ja/cars/porsche | grep -oE '<title>[^<]+' | head -1
```

Expected:
- `llms.txt` devuelve el texto con `# MonzaHaus`
- `robots.txt` lista GPTBot, Claude-Web, etc.
- `sitemap.xml` contiene `xhtml:link rel="alternate"` con `x-default`
- `/en/cars/porsche` tiene ≥2 JSON-LD scripts (Organization+WebSite+SoftwareApp + Breadcrumb + CollectionPage)
- Los 4 títulos son distintos y localizados (inglés, español, alemán, japonés)

Si cualquier assertion falla: **PARAR**, diagnosticar, arreglar, re-correr este paso entero.

- [ ] **Step 5: Limpiar servidor dev**

Run:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
```

- [ ] **Step 6: Validar schemas con herramienta oficial (manual, opcional)**

Herramientas:
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/

Pegar URL de preview de Vercel (o usar ngrok si es local). Verificar que no hay warnings en Vehicle/Article/Dataset schemas.

Este paso es manual y queda documentado aquí como referencia para cuando el usuario revise. No bloquea merge.

- [ ] **Step 7: Push de la branch**

Run:
```bash
git push -u origin seo/phase-0-foundation
```

Expected: push exitoso. NO abrir PR todavía — esperar que el usuario revise.

---

## Resumen de entregables

Al final de este plan, Monza Haus tendrá:

1. **5 schemas JSON-LD nuevos** (Article, FAQPage, Dataset, CollectionPage — además de los Organization/Website/Software/Breadcrumb/Vehicle existentes), todos con tests.
2. **VehicleJsonLd + BreadcrumbJsonLd renderizados** en car detail pages (antes: definidos pero inactivos).
3. **BreadcrumbJsonLd + CollectionPageJsonLd** en make pages.
4. **Metadata multi-idioma** en MakePage (con series awareness) y CarDetail — 4 idiomas, con hreflang x-default.
5. **Sitemap con x-default** y tests de estructura.
6. **`/llms.txt`** publicado — primer sitio colombiano de collector cars con esto.
7. **`robots.txt` expandido** con políticas explícitas para 14 bots AI.

**Lo que NO se hace en este plan (Fase 1+):**
- Contenido de guías (Porsche 964 Buyer's Guide, etc.)
- Monza Haus Index (página pública + Dataset schema real)
- Traducciones profesionales de UI (esto es solo metadata)
- Link building / outreach
- Contratar Head of Content

Eso viene cuando Haus arranque a facturar (trigger definido en la estrategia).
