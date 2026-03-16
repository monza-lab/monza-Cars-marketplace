# ESTRUCTURA DE BASE DE DATOS - QUICK START PARA CAMILO
## Todos los Carros de Lujo (100K€ a Ilimitado)

---

## 1. LAS 9 TABLAS PRINCIPALES

```
┌─────────────────────────────────────────────────────────────┐
│ LISTINGS (núcleo central)                                   │
├─────────────────────────────────────────────────────────────┤
│ ✓ id (UUID - clave primaria)                                │
│ ✓ source (BaT, CollectingCars, RMSothebys, etc)            │
│ ✓ source_id + source_url (UNIQUE - no duplicados)          │
│ ✓ year, make, model, trim, body_style                      │
│ ✓ mileage (normalizar a km)                                │
│ ✓ color_exterior, color_interior                           │
│ ✓ vin (si disponible)                                      │
│ ✓ price_usd, price_eur, price_gbp (convertir automático)   │
│ ✓ hammer_price, buyers_premium_percent                     │
│ ✓ hagerty_grade (1, 2, 3, 4 - si disponible)               │
│ ✓ condition_description (texto)                            │
│ ✓ original_vs_restored (enum)                              │
│ ✓ country, region, city (CRÍTICO - no mezclar mercados)    │
│ ✓ auction_house, auction_date                              │
│ ✓ sale_date, list_date, status (active/sold/unsold)        │
│ ✓ photos_count, description_text                           │
│ ✓ created_at, updated_at, scrape_timestamp                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ VEHICLE_SPECS (1:1 con LISTINGS)                           │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • engine_cc, engine_type (V8, V12, etc)                     │
│ • horsepower, torque_nm                                     │
│ • fuel_type, transmission, drivetrain                       │
│ • suspension_type, brakes, wheels_size                      │
│ • weight_kg, dimensions                                     │
│ • 0_100_kmh_seconds, top_speed_kmh                          │
│ • special_features (texto)                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRICING (1:1 con LISTINGS)                                 │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • hammer_price_original, original_currency                  │
│ • price_usd, price_eur, price_gbp (conversiones)           │
│ • buyers_premium_percent, buyers_premium_amount             │
│ • total_price_to_buyer (hammer + premium)                   │
│ • seller_estimate_low, seller_estimate_high                 │
│ • estimate_met_percent (hit rate)                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AUCTION_INFO (1:1 con LISTINGS)                            │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • auction_house, auction_event_name, auction_location       │
│ • auction_date, lot_number, lot_order                       │
│ • reserve_price, reserve_met                                │
│ • pre_sale_estimate_low, pre_sale_estimate_high             │
│ • number_of_bids, starting_bid                              │
│ • status (unsold/sold/passed/withdrawn)                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LOCATION_DATA (1:1 con LISTINGS)                           │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • country, country_code, region, city, postal_code          │
│ • latitude, longitude (para geocodificación)                │
│ • timezone                                                  │
│ • market_segment_local, typical_price_range_eur             │
│ • market_depth (cuántos carros similares hay)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PROVENANCE_DATA (1:1 con LISTINGS) ⭐ IMPORTANTE           │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • racing_history, racing_details                            │
│ • famous_owner (bool), famous_owner_name                    │
│ • competition_count, competition_details                    │
│ • accident_history, accident_details (RED FLAGS)            │
│ • ownership_count                                           │
│ • service_records_complete                                  │
│ • restoration_done, restoration_date, restoration_type      │
│ • restoration_quality (show/excellent/good/fair/poor)       │
│ • original_documents, factory_history_available             │
│ • originality_score (0-100%) ← CRÍTICO PARA PRICE ADJUST    │
│ • original_parts_percentage                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ VEHICLE_HISTORY (0:N con LISTINGS)                         │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • previous_sale_date, previous_price, previous_currency     │
│ • previous_source, previous_location                        │
│ • time_between_sales_days                                   │
│ • appreciation_depreciation_percent ← INVERSIÓN!            │
│ • annualized_appreciation                                   │
│ • confidence_level (high/medium/low)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PHOTOS_MEDIA (0:N con LISTINGS)                            │
├─────────────────────────────────────────────────────────────┤
│ • listing_id (FK)                                           │
│ • photo_url, photo_order, photo_category                    │
│ • local_cache_path (para análisis local)                    │
│ • photo_hash (SHA256 - deduplicación)                       │
│ • width_px, height_px, file_size_mb                         │
│ • image_quality_score (0-100)                               │
│ • has_damage (detección automática)                         │
│ • apparent_condition_grade (NLP analysis)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRICE_HISTORY (TimescaleDB - histórico temporal) ⏱️         │
├─────────────────────────────────────────────────────────────┤
│ • time (timestamp - clave temporal)                         │
│ • listing_id (FK)                                           │
│ • price_usd, price_eur, price_gbp                           │
│ • status (active/sold/unsold/delisted)                      │
│ → HYPERTABLE: Compresión automática, 70-90% menos disco     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MARKET_SEGMENTS (referencia para análisis)                 │
├─────────────────────────────────────────────────────────────┤
│ • segment_code (ej: "Ferrari_500_1950-1970")               │
│ • segment_name, segment_description                         │
│ • make, model, generation, year_range_start/end             │
│ • typical_price_range_low, typical_price_range_high         │
│ • expected_appreciation_annual                              │
│ • rarity_score (1-10), collectibility_score (1-10)          │
│ • investment_potential (high/medium/low/speculative)        │
│ • primary_markets (geografía donde se vende)                │
│ • seasonal_variation (bool)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MARKET_ANALYTICS (agregaciones diarias) 📊                  │
├─────────────────────────────────────────────────────────────┤
│ • date + segment_id + country (composite PK)                │
│ • avg_price_usd, median_price_usd, stddev_price_usd         │
│ • min_price_usd, max_price_usd                              │
│ • listings_count, sold_count, unsold_count                  │
│ • sell_through_rate, avg_days_to_sell                       │
│ • price_trend (up/flat/down)                                │
│ • price_momentum, price_volatility                          │
│ • search_volume_relative, buyer_interest_level              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ÍNDICES CRÍTICOS

```sql
-- Estos índices son OBLIGATORIOS para performance
CREATE INDEX idx_listings_year_make_model ON listings(year, make, model);
CREATE INDEX idx_listings_country_year ON listings(country, year);
CREATE INDEX idx_listings_sale_date ON listings(sale_date);
CREATE INDEX idx_listings_source_id ON listings(source, source_id);  -- UNIQUE
CREATE INDEX idx_listings_price_usd ON listings(price_usd);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_auction_house ON listings(auction_house);

-- TimescaleDB indices (automáticos)
CREATE INDEX idx_price_history_listing_time ON price_history(listing_id, time);
```

---

## 3. CAMPOS CRÍTICOS (PARA ALEJANDRO)

```
MUST HAVE (no NULL permitido):
✅ price_usd / price_eur / price_gbp
✅ country (CRÍTICO - UK es 30% más barata)
✅ mileage (normalizado a km)
✅ sale_date
✅ status (sold/unsold)
✅ source + source_id (para deduplicación)

VERY IMPORTANT (deseable, usa defaults si falta):
✅ original_vs_restored
✅ buyers_premium_percent
✅ condition_description
✅ color_exterior / color_interior
✅ hagerty_grade (si disponible)

NICE TO HAVE:
✅ originality_score
✅ matching_numbers
✅ racing_history
✅ famous_owner
✅ service_records_complete
✅ photos_count
```

---

## 4. VOLUMEN DE DATOS POR SEGMENTO

```
SEGMENTO 1 (€100K-€300K):    40% volumen   → ~8,000/mes
  ├─ Bring a Trailer: 60/día
  ├─ Collecting Cars: 10-15/día
  ├─ Cars & Bids: 15-20/día
  └─ Regional: 5-10/día

SEGMENTO 2 (€300K-€800K):    25% volumen   → ~5,000/mes
  ├─ Collecting Cars: 10-15/día
  ├─ RM Sotheby's: Event-based
  ├─ Bonhams: Event-based
  └─ Broad Arrow: Event-based

SEGMENTO 3 (€800K-€3M):      15% volumen   → ~3,000/mes
  └─ Solo subastas live (RM, Bonhams, Broad Arrow)

SEGMENTO 4 (€3M-€10M):       10% volumen   → ~2,000/mes
  └─ Solo RM Sotheby's (principales events)

SEGMENTO 5 (€10M+):          5% volumen    → ~1,000/mes
  └─ Manual (muy pocos datos públicos)

TOTAL: ~19,000/mes (~228,000/año)
```

---

## 5. QUERIES MÁS IMPORTANTES (COPIAR/PEGAR)

### Query 1: Fair Value Range Calculator

```sql
WITH similar_cars AS (
    SELECT l.id, l.price_usd, l.mileage, l.hagerty_grade, pd.originality_score
    FROM listings l
    LEFT JOIN provenance_data pd ON l.id = pd.listing_id
    LEFT JOIN location_data ld ON l.id = ld.listing_id
    WHERE l.year = $year AND l.make = $make AND l.model = $model
    AND ld.country = $country AND l.status = 'sold'
    AND l.sale_date >= NOW() - INTERVAL '12 months'
    LIMIT 20
),
outlier_removed AS (
    SELECT * FROM (
        SELECT *, 
            ROW_NUMBER() OVER (ORDER BY price_usd ASC) as rank_asc,
            ROW_NUMBER() OVER (ORDER BY price_usd DESC) as rank_desc
        FROM similar_cars
    ) WHERE rank_asc > 2 AND rank_desc > 2
)
SELECT 
    COUNT(*) as sample_size,
    ROUND(AVG(price_usd), 2) as fair_value_mean,
    ROUND(AVG(price_usd) - STDDEV(price_usd), 2) as recommended_low,
    ROUND(AVG(price_usd) + STDDEV(price_usd), 2) as recommended_high,
    ROUND(STDDEV(price_usd), 2) as volatility
FROM outlier_removed;
```

### Query 2: Comparación de Precios por País

```sql
SELECT 
    ld.country,
    COUNT(*) as listing_count,
    ROUND(AVG(l.price_usd), 2) as avg_price_usd,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_usd), 2) as median,
    ROUND(STDDEV(l.price_usd), 2) as volatility
FROM listings l
LEFT JOIN location_data ld ON l.id = ld.listing_id
WHERE l.year = $year AND l.make = $make AND l.model = $model
AND l.status = 'sold'
AND l.sale_date >= NOW() - INTERVAL '12 months'
GROUP BY ld.country
ORDER BY avg_price_usd DESC;
```

### Query 3: Red Flags Detection

```sql
SELECT 
    l.id, l.make, l.model, l.price_usd,
    CASE 
        WHEN l.photos_count < 5 THEN 'Low photos'
        WHEN l.hagerty_grade = 4 AND l.price_usd > 500000 THEN 'Low condition, high price'
        WHEN pd.accident_history IS NOT NULL THEN 'Accident history'
        WHEN l.mileage > 300000 AND l.hagerty_grade IN (1,2) THEN 'Suspicious high miles'
        ELSE 'OK'
    END as red_flag
FROM listings l
LEFT JOIN provenance_data pd ON l.id = pd.listing_id
WHERE l.sale_date >= NOW() - INTERVAL '30 days'
ORDER BY l.sale_date DESC;
```

### Query 4: Appreciation/Depreciation Analysis

```sql
SELECT 
    l.make, l.model,
    COUNT(*) as sample_size,
    ROUND(AVG(vh.appreciation_depreciation_percent), 2) as avg_appreciation_pct,
    ROUND(AVG(vh.annualized_appreciation), 2) as avg_annualized_pct
FROM vehicle_history vh
JOIN listings l ON vh.listing_id = l.id
WHERE vh.confidence_level IN ('high', 'medium')
AND DATEDIFF(YEAR, vh.previous_sale_date, l.sale_date) BETWEEN 1 AND 10
GROUP BY l.make, l.model
HAVING COUNT(*) >= 3
ORDER BY avg_annualized_pct DESC;
```

---

## 6. CRONOGRAMA DE IMPLEMENTACIÓN

```
SEMANA 1-2:  Database + Infraestructura
├─ PostgreSQL 14 + TimescaleDB
├─ DDL (crear todas las tablas)
├─ Índices
└─ Usuarios y permisos

SEMANA 3:    Scrappers Tier 1
├─ Bring a Trailer scraper → LIVE (60/día)
├─ Collecting Cars scraper → LIVE (10-15/día)
├─ Cars & Bids scraper → LIVE (15-20/día)
└─ 100-150 carros/día entrando en DB

SEMANA 4:    Limpieza de Datos
├─ Normalización de precios (USD/EUR/GBP)
├─ Deduplicación (source_id UNIQUE)
├─ Validación de campos
└─ Import histórico (2+ años BaT/CollectingCars)

SEMANA 5:    Subastas Live
├─ RM Sotheby's parser
├─ Bonhams parser
├─ Event detection
└─ ~50-100 carros/mes nuevos

SEMANA 6-7:  Fair Value Calculator
├─ Algorithm completo (outlier removal, ajustes)
├─ Testing contra datos reales
├─ API endpoints (/fair-value, /market-analysis)
└─ Validación con Alejandro

SEMANA 8+:   Polish & Production
├─ Dashboard UI
├─ Performance tuning
├─ Monitoring y alertas
├─ Documentación
└─ Ready for production
```

---

## 7. SETUP INICIAL (COPY/PASTE)

```bash
# 1. Instalar PostgreSQL + TimescaleDB
sudo apt-get update
sudo apt-get install postgresql-14 postgresql-14-timescaledb

# 2. Crear database
createdb monza_luxury_cars

# 3. Crear extension TimescaleDB
psql -d monza_luxury_cars -c "CREATE EXTENSION timescaledb;"

# 4. Crear usuario para app
psql -d monza_luxury_cars -c "
CREATE USER monza_app WITH PASSWORD 'SECURE_PASSWORD';
GRANT CONNECT ON DATABASE monza_luxury_cars TO monza_app;
GRANT USAGE ON SCHEMA public TO monza_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO monza_app;
"

# 5. Ejecutar DDL (ir a archivo completo para copiar schema.sql)
psql -d monza_luxury_cars -U postgres -f schema.sql

# 6. Verificar setup
psql -d monza_luxury_cars -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' ORDER BY table_name;
"
```

---

## 8. RELACIONES ENTRE TABLAS

```
         LISTINGS (core)
            │
    ┌───────┼───────┬──────────┬────────────┐
    │       │       │          │            │
    ▼       ▼       ▼          ▼            ▼
  VEHICLE  PRICING AUCTION   LOCATION   PROVENANCE
  _SPECS   (1:1)   _INFO     _DATA      _DATA
  (1:1)            (1:1)     (1:1)      (1:1)
    │                           │
    └─── PRICE_HISTORY ────────◄┘ (0:N, temporal)
    └─── VEHICLE_HISTORY (0:N, ventas previas)
    └─── PHOTOS_MEDIA (0:N, fotos)

MARKET_SEGMENTS → MARKET_ANALYTICS (diario)
```

---

## 9. CAMPOS PARA CADA SCRAPER

```
BRING A TRAILER:
├─ Extrae: title, year, make, model, mileage, price (USD)
├─ Fotos: URL (guardar en PHOTOS_MEDIA)
├─ Descripción: texto completo
├─ Comentarios: parsing para detectar issues
└─ Special: buyer feedback score

COLLECTING CARS:
├─ Extrae: year, make, model, mileage, price (EUR)
├─ CRÍTICO: location (country, city)
├─ Condición: descriptiva
├─ Provenance: si está documentada
└─ Verificación: seller check mark

RM SOTHEBY'S:
├─ Extrae: lot number, estimate, hammer price
├─ Provenance: EXTENSO (documentación)
├─ Condición: descripción detallada + Hagerty grade
├─ Fotos: alta resolución
└─ Pre/post análisis: estimates vs realized prices

BONHAMS:
├─ Similar a RM pero volumen menor
├─ Especialidad: clásicos británicos
└─ Detalles: menos que RM pero documentado

REGIONAL (Aguttes, Coys, H&H):
├─ Event-based (1-5 eventos/mes cada una)
├─ Especialización geográfica
└─ Volumen: 5-10/día combinado
```

---

## 10. CHECKLISTS

### Antes de Escribir Código
- [ ] PostgreSQL 14+ instalado
- [ ] TimescaleDB extension creada
- [ ] Schema DDL listo (desde archivo completo)
- [ ] Índices creados
- [ ] Usuario de app creado con permisos
- [ ] Redis para cache (opcional pero recomendado)

### Durante Scrappers
- [ ] Puppeteer/Playwright configurado
- [ ] Proxy rotation implementado
- [ ] Rate limiting respeta robots.txt
- [ ] Error handling + retry logic
- [ ] Logging de scrapes
- [ ] Deduplicación funciona (source_id UNIQUE)

### Para Fair Value Calculator
- [ ] Filtro de outliers funciona (top 2 + bottom 2)
- [ ] Conversión de precios automática
- [ ] Separación geográfica respetada
- [ ] Ajustes por condition/restoration aplicados
- [ ] Tested contra datos reales

### Para Production
- [ ] Backup diarios
- [ ] Monitoring de database size
- [ ] Alertas de errores de scrape
- [ ] Performance queries monitoreado
- [ ] API rate limiting
- [ ] Documentación actualizada

---

## CONCLUSIÓN

Con esta estructura, Camilo puede:

✅ Capturar **todos los carros de lujo** (100K€+)  
✅ Separar por **geografía** (sin mezclar mercados)  
✅ Calcular **Fair Value Range** como Alejandro necesita  
✅ Detectar **oportunidades de inversión**  
✅ Monitorear **appreciación/depreciación**  
✅ Identificar **red flags** automáticamente  
✅ Escalar a **1M+ carros** sin problemas  

**Start aquí, después ve al documento completo para detalles técnicos.** ✅
