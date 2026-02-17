# MONZA CARS: La Base de Datos de Porsche Mas Grande del Mundo

## Vision

Construir la base de datos mas completa, precisa y actualizada de vehiculos Porsche a nivel global. Cubrir cada modelo, cada generacion, cada variante, cada transaccion — desde un 356 Speedster de 1955 hasta un 992 GT3 RS de 2026. Cuatro mercados: Estados Unidos, Europa, Reino Unido y Japon.

Esta base de datos sera el activo central de Monza Cars: alimenta valuaciones, reportes de inversion, analisis de mercado, y la plataforma de marketplace.

---

## Que Significa "La Mas Grande"

No es solo volumen. Es la combinacion de 5 dimensiones de datos que nadie tiene juntas:

1. **Transacciones reales** — Precios de subastas finalizadas (no asking prices). BaT, RM Sotheby's, Bonhams, Collecting Cars, PCarMarket, Mecum, Gooding. Miles de ventas con precio real pagado.

2. **Inventario vivo** — Listings activos en Mobile.de, AutoScout24, AutoTrader UK, Elferspot, Goo-net Exchange. Precios de mercado en tiempo real en 4 continentes.

3. **Especificaciones tecnicas por variante** — No solo "911". Sino 911 Carrera S (992), 3.0L flat-6 turbo, 443hp, PDK 7-speed, RWD, 1515kg, 0-60 en 3.3s, MSRP $117,100. Cada variante, cada ano.

4. **Historial verificado** — VIN decodificado, historial MOT (UK), registros de inspeccion, kilometraje verificado por fuentes gubernamentales.

5. **Inteligencia de precios** — Indice propio de precios por modelo/generacion/trimestre. Tendencias a 12 meses. Comparables. Percentiles. No dependemos de Hagerty ni de KBB — construimos nuestro propio pricing engine con datos reales.

---

## Los Datos que Necesitamos Capturar

Para cada Porsche en la base de datos:

### Datos de Identificacion
- VIN (17 digitos, o chassis number para pre-1981)
- Make: Porsche
- Model family: 911, Cayenne, Taycan, Boxster, Cayman, Panamera, Macan, 356, 914, 928, 944, 968, 959, Carrera GT, 918 Spyder
- Generation: 992, 991.2, 991.1, 997.2, 997.1, 996, 993, 964, 930, G-body, F-body, etc.
- Variant/Trim: Carrera, Carrera S, Carrera 4S, Turbo, Turbo S, GT3, GT3 RS, GT3 Touring, GT2 RS, Targa, GTS, Sport Classic, S/T, Dakar, etc.
- Year: Ano modelo
- Color exterior + Color interior (cuando disponible)
- Porsche option codes (cuando disponible): XMB (Sport Chrono), PCCB (ceramicos), P77 (sport seats), etc.

### Datos de Mercado
- Precio (en moneda original + equivalente USD con tasa historica)
- Tipo de precio: hammer price (subasta), asking price (listing), sold price (venta directa)
- Fuente: BaT, Mobile.de, RM Sotheby's, etc.
- Fecha de la transaccion/listing
- Ubicacion: pais, region, ciudad
- Tipo de vendedor: dealer, privado, casa de subastas
- Estado: activo, vendido, no vendido (reserve not met), retirado

### Datos del Vehiculo
- Kilometraje (mileage) + unidad (miles/km)
- Motor: codigo, layout, cilindrada, cilindros, potencia (HP), torque (Nm)
- Transmision: manual, PDK, Tiptronic, auto
- Traccion: RWD, AWD
- Carroceria: Coupe, Cabriolet, Targa, SUV, Sedan, Wagon (Sport Turismo)
- Planta de fabricacion: Stuttgart-Zuffenhausen, Leipzig, Osnabruck
- Mercado original de entrega: USA, Europe, Japan, Middle East, etc.

### Datos de Historial
- Historial MOT (UK): kilometraje verificado en cada inspeccion anual
- VIN decode: datos confirmados de NHTSA / Vincario
- Numero de propietarios (cuando disponible)
- Historial de servicio (cuando disponible)
- Accidentes / titulo salvage (cuando disponible)

### Media
- Fotos (URLs)
- URL del listing original

---

## Fuentes de Datos por Region

### ESTADOS UNIDOS (Mercado #1 en volumen)

**Subastas online (precios reales — MAXIMO VALOR):**
| Fuente | Volumen Porsche | Metodo | Prioridad |
|--------|----------------|--------|-----------|
| Bring a Trailer | Muy alto (~3000+/ano) | Scraping Cheerio (YA EXISTE) | Ya implementado |
| Cars & Bids | Alto (~500+/ano) | Scraping Cheerio (YA EXISTE) | Ya implementado |
| PCarMarket | Alto (Porsche-only) | Scraping Cheerio | FASE 1 |
| Classic.com | Muy alto (agregador) | Scraping Cheerio/Playwright | FASE 1 |

**Subastas fisicas de alto valor:**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| RM Sotheby's | Medio-Alto ($100K-$10M) | Playwright (React SPA) | FASE 3 |
| Bonhams | Medio | Cheerio | FASE 3 |
| Gooding & Company | Medio | Cheerio | FASE 3 |
| Mecum | Medio | Playwright | FASE 4 |
| Barrett-Jackson | Bajo-Medio | Cheerio | FASE 4 |

**Listings (asking prices — contexto de mercado):**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| Hemmings | Medio (clasicos) | Cheerio | FASE 4 |

**APIs de enriquecimiento:**
| Servicio | Dato | Costo |
|----------|------|-------|
| NHTSA VIN Decoder | Specs via VIN | Gratis |

### EUROPA (Mercado natal de Porsche)

**Marketplaces (mayor inventario del mundo):**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| Mobile.de | Enorme (Alemania = mercado natal) | Cheerio + Proxy DE | FASE 2 |
| AutoScout24 | Enorme (pan-EU: IT, FR, NL, BE, AT, ES) | Cheerio + Proxy | FASE 2 |
| Elferspot | Alto (Porsche-only) | Cheerio | FASE 1 |
| Classic Driver | Medio-Alto (premium/collector) | Cheerio | FASE 3 |

**Subastas:**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| Collecting Cars | Alto | Scraping Cheerio (YA EXISTE) | Ya implementado |

**APIs de enriquecimiento:**
| Servicio | Dato | Costo |
|----------|------|-------|
| Vincario | VIN decode EU + historial + valor estimado | $49/mes |

### REINO UNIDO

**Marketplaces:**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| AutoTrader UK | Muy alto | Cheerio + Proxy GB | FASE 2 |
| PistonHeads | Alto (comunidad Porsche fuerte) | Cheerio | FASE 3 |
| Car & Classic | Medio (clasicos) | Cheerio | FASE 4 |

**APIs de enriquecimiento:**
| Servicio | Dato | Costo |
|----------|------|-------|
| UK MOT History API | Kilometraje verificado + historial inspecciones | Gratis |

### JAPON (Carros de bajo km, bien mantenidos)

**Plataformas de exportacion:**
| Fuente | Volumen | Metodo | Prioridad |
|--------|---------|--------|-----------|
| Goo-net Exchange | Alto (en ingles, para exportacion) | Cheerio | FASE 3 |
| BidJDM | Medio (subastas japonesas) | Cheerio | FASE 3 |

**Nota sobre Japon:** Las subastas internas (USS, TAA, HAA) requieren licencia de dealer japones. Para acceso profundo se necesita partnership con exportador. Goo-net Exchange y BidJDM son las opciones accesibles.

---

## Fases de Construccion

### FASE 1: Fundacion (Semanas 1-2)
**Objetivo: Tener 5,000+ Porsches en la base de datos con datos de subastas reales**

Acciones:
1. Filtrar scrapers existentes (BaT, Cars & Bids, Collecting Cars) solo para Porsche
2. Correr backfill historico de BaT para TODOS los modelos Porsche (12 meses)
3. Construir scraper PCarMarket (Porsche-only, facil, maximo valor)
4. Construir scraper Classic.com (agregador de todas las casas de subastas)
5. Construir scraper Elferspot (Porsche-only europeo, facil)
6. Integrar NHTSA VIN enrichment en el pipeline
7. Crear y seedear tabla `porsche_model_specs` con generaciones principales del 911, 718, Cayenne, Taycan
8. Implementar normalizador de modelos Porsche (taxonomia estandar)

Resultado esperado:
- ~3,000-5,000 transacciones de subastas con precio real
- ~500-1,000 listings activos de Elferspot
- VIN enrichment funcionando
- Tabla de specs curada con 50-100 variantes principales

### FASE 2: Expansion Europea + UK (Semanas 3-4)
**Objetivo: Agregar 10,000+ listings europeos y verificacion UK**

Acciones:
1. Configurar Decodo/SmartProxy con IPs de Alemania, Francia, Italia, UK
2. Construir scraper Mobile.de (mercado mas grande de Europa para Porsche)
3. Construir scraper AutoScout24 (pan-europeo)
4. Construir scraper AutoTrader UK
5. Integrar Vincario para VIN decode de listings europeos
6. Integrar UK MOT API para verificacion de kilometraje
7. Implementar conversion de monedas (EUR, GBP → USD con tasa historica)
8. Construir Price Index v1: mediana, promedio, min, max, sample size por modelo/generacion/trimestre

Resultado esperado:
- ~10,000-20,000 listings europeos activos
- ~2,000+ listings UK con kilometraje verificado via MOT
- Price index funcionando para modelos principales
- Cobertura de 3 mercados: USA + Europa + UK

### FASE 3: Premium + Japon (Semanas 5-6)
**Objetivo: Cubrir subastas de alto valor y mercado japones**

Acciones:
1. Construir scraper RM Sotheby's (requiere Playwright)
2. Construir scraper Bonhams
3. Construir scraper Gooding & Company
4. Construir scraper Goo-net Exchange (Japon)
5. Construir scraper BidJDM (Japon)
6. Construir scraper Classic Driver (premium europeo)
7. Construir scraper PistonHeads (UK)
8. Expandir tabla `porsche_model_specs` a modelos clasicos (356, 914, 928, 944, 968, 959, Carrera GT, 918)

Resultado esperado:
- Cobertura de subastas high-end ($100K-$10M+)
- Datos del mercado japones
- 4 mercados cubiertos: USA + Europa + UK + Japon
- Specs completos para toda la gama historica de Porsche

### FASE 4: Completar + Escalar (Semanas 7-8)
**Objetivo: Llenar gaps, mejorar calidad, automatizar**

Acciones:
1. Construir scrapers restantes: Mecum, Barrett-Jackson, Hemmings, Car & Classic
2. Implementar scraping automatizado (cron jobs: diario para listings activos, semanal para resultados de subastas)
3. Implementar alertas de calidad de datos (detectar anomalias en precios, duplicados, datos faltantes)
4. Price Index v2: tendencias 12 meses, comparables, percentiles, segmentacion por condicion/mileage
5. Dashboard de monitoreo: cuantos listings por fuente, tasa de exito de scraping, datos enriquecidos vs raw
6. Documentar toda la infraestructura

Resultado esperado:
- 50,000+ registros totales en la base de datos
- 15+ fuentes de datos activas
- Pipeline automatizado corriendo diariamente
- Price intelligence propio compitiendo con Hagerty

### FASE 5: Inteligencia de Mercado (Semanas 9+)
**Objetivo: Convertir datos en insights que nadie mas tiene**

Acciones:
1. Analisis de arbitraje entre mercados (mismo carro: precio en USA vs Europa vs UK vs Japon)
2. Prediccion de tendencias de precio por modelo/generacion
3. Identificacion de "sleeper" models (carros subvalorados con potencial de apreciacion)
4. Scoring de inversion por vehiculo (combinando: rareza, tendencia de precio, condicion, kilometraje, mercado)
5. Reportes automatizados de mercado (mensuales/trimestrales)
6. API publica o partnership para monetizar los datos

---

## Infraestructura Tecnica

### APIs Configuradas
| Servicio | Region | Costo | Estado |
|----------|--------|-------|--------|
| NHTSA VIN Decoder | USA | Gratis | Listo (sin registro) |
| UK MOT History | UK | Gratis | Registrado, esperando API key |
| Vincario | Europa | $49/mes | Registrado, free trial |
| Decodo (SmartProxy) | Todas | ~$75/mes | En configuracion |

### Tech Stack Existente
- **Frontend**: Next.js + TypeScript
- **Backend/DB**: Supabase (Postgres) + Prisma ORM
- **Scraping**: Cheerio (HTML parsing), fetch (HTTP)
- **Agregar**: Playwright (para sitios JS-heavy), p-queue (concurrencia), proxy integration

### Costo Mensual Operativo
| Item | Costo |
|------|-------|
| Vincario | $49 |
| Decodo/SmartProxy | $75 |
| Supabase (ya existe) | Incluido |
| **Total** | **$124/mes** |

---

## Metricas de Exito

| Metrica | Fase 1 | Fase 2 | Fase 3 | Fase 4 | Fase 5 |
|---------|--------|--------|--------|--------|--------|
| Total registros | 5,000 | 25,000 | 40,000 | 50,000+ | 75,000+ |
| Fuentes activas | 6 | 9 | 14 | 17+ | 17+ |
| Regiones cubiertas | USA + EU parcial | USA + EU + UK | USA + EU + UK + JP | Todas | Todas |
| Modelos con specs | 50+ | 100+ | 150+ | 200+ | 200+ |
| Price index | No | v1 basico | v1 completo | v2 con tendencias | v2 + prediccion |
| Actualizacion | Manual | Semi-auto | Semi-auto | Automatico diario | Automatico + alertas |

---

## Principios de Este Proyecto

1. **Datos reales > asking prices.** Priorizamos precios de subastas finalizadas (hammer prices) sobre asking prices de listings. Los asking prices son contexto; los hammer prices son la verdad.

2. **VIN es el identificador universal.** Donde haya VIN, ese es el primary key para deduplicar entre fuentes. Un mismo Porsche puede aparecer en BaT, Mobile.de, y Classic.com — el VIN los unifica.

3. **La normalizacion es el reto mas grande.** "911 Carrera S", "Porsche 911 Carrera S", "991.2 Carrera S", "911 (991) Carrera S" son el mismo carro. El normalizador de modelos es una pieza critica del pipeline.

4. **Moneda original + USD.** Siempre almacenar el precio en la moneda original con la tasa de cambio historica. Nunca convertir y perder la referencia original.

5. **Respetar las fuentes.** Delays entre requests, rotacion de proxies, no sobrecargar servidores. Scraping responsable = scraping sostenible.

6. **Construir nuestro propio pricing engine.** No depender de Hagerty ($25K/ano) ni KBB ($10K/ano). Con suficientes data points de subastas reales, podemos construir un indice de precios propio que sea igual o mejor.

7. **Porsche primero, expandir despues.** Este proyecto es 100% Porsche. Una vez que el pipeline este probado y funcionando, se puede replicar para Ferrari, Mercedes, BMW, etc.
