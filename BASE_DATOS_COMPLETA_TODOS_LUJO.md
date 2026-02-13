# ESTRUCTURA COMPLETA DE BASE DE DATOS - MONZA LAB LUXURY CARS
## Carros de Lujo: 100K€ hasta ILIMITADO
## Documento Técnico para Camilo - Construcción de Sistema

---

## ÍNDICE
1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Segmentación por Rango de Precio](#2-segmentación-por-rango-de-precio)
3. [Volumen de Datos a Scrapear](#3-volumen-de-datos-a-scrapear)
4. [Schema Completo de Base de Datos](#4-schema-completo-de-base-de-datos)
5. [Diccionario de Campos](#5-diccionario-de-campos)
6. [Relaciones entre Tablas](#6-relaciones-entre-tablas)
7. [Índices y Optimización](#7-índices-y-optimización)
8. [Estrategia de Scrappers por Segmento](#8-estrategia-de-scrappers-por-segmento)
9. [Queries Clave para Alejandro](#9-queries-clave-para-alejandro)
10. [Implementación Paso a Paso](#10-implementación-paso-a-paso)

---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1 Rango de Cobertura

```
SEGMENTO 1: LUXURY MASS MARKET (100K€ - 500K€)
├─ Volume: 80% del volumen total
├─ Fuentes: BaT, Collecting Cars, Cars & Bids, regional
├─ Precisión: Alta (datos públicos, competencia)
├─ Actualización: Real-time

SEGMENTO 2: ULTRA-PREMIUM (500K€ - 2M€)
├─ Volume: 15% del volumen
├─ Fuentes: RM Sotheby's, Bonhams, Broad Arrow, especializadas
├─ Precisión: Alta (subastas documentadas)
├─ Actualización: Event-based (1-2x/mes)

SEGMENTO 3: HYPERCARS & ULTRA-RARE (2M€+)
├─ Volume: 5% del volumen
├─ Fuentes: RM Sotheby's, Bonhams, Christie's, private intelligence
├─ Precisión: Media (muchos datos privados)
├─ Actualización: Monthly (escasos datos públicos)

COBERTURA TOTAL: 100K€ → $100M+ (ilimitado)
```

### 1.2 Objetivo del Sistema

```
PRIMARY GOALS:
✓ Capturar TODOS los carros de lujo (100K€+) que se vendan públicamente
✓ Permitir análisis comparativo por geografía (UK vs Alemania vs USA)
✓ Validar Fair Value Range de Alejandro (100K-800K€ principal, +800K€ secundario)
✓ Detectar oportunidades de compra-venta en diferentes mercados
✓ Generar reportes de market trends por marca/modelo
✓ Alertas de carros raros/especiales que caen en el mercado

SECONDARY GOALS:
✓ Análisis de provenance y pedigree (historia del carro)
✓ Tracking de appreciation/depreciation
✓ Comparación precio-condición
✓ Red flags detection (daño no reportado, restauraciones pobres)
```

---

## 2. SEGMENTACIÓN POR RANGO DE PRECIO

### 2.1 Definición de Segmentos

```
┌────────────────────────────────────────────────────────────────────┐
│ SEGMENTO 1: LUXURY ENTRY (€100K - €300K)                          │
├────────────────────────────────────────────────────────────────────┤
│ Ejemplos: Porsche 911 usados, Mercedes AMG, BMW M, Audi RS         │
│ Volume: 40% del total                                              │
│ Fuentes: BaT, Collecting Cars, Cars & Bids, Mecum                 │
│ Precisión: ALTA (mucho volumen, competencia visible)               │
│ Actualización: Daily (real-time)                                   │
│ Característica: "El cliente típico de Monza puede comprar aquí"    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ SEGMENTO 2: LUXURY MID (€300K - €800K)                            │
├────────────────────────────────────────────────────────────────────┤
│ Ejemplos: Ferrari 348/355/360, Lamborghini Murciélago, Porsche 996│
│ Volume: 25% del total                                              │
│ Fuentes: Collecting Cars, RM Sotheby's, Bonhams, Broad Arrow      │
│ Precisión: ALTA (foco principal de Alejandro)                      │
│ Actualización: Daily/Event-based                                   │
│ Característica: "El CORE MARKET de Monza - máximo enfoque aquí"    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ SEGMENTO 3: LUXURY PREMIUM (€800K - €3M)                          │
├────────────────────────────────────────────────────────────────────┤
│ Ejemplos: Ferrari F40/F50, Lamborghini Countach, Jaguar XJ220     │
│ Volume: 15% del total                                              │
│ Fuentes: RM Sotheby's, Bonhams, Broad Arrow, Gooding              │
│ Precisión: ALTA (documentación excelente, subastas reales)         │
│ Actualización: Event-based (2-4 eventos/mes)                       │
│ Característica: "Carros muy raros, excelente data, precios real"   │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ SEGMENTO 4: ULTRA-LUXURY (€3M - €10M)                             │
├────────────────────────────────────────────────────────────────────┤
│ Ejemplos: Ferrari Enzo, LaFerrari, 250 GTO, McLaren F1            │
│ Volume: 10% del total                                              │
│ Fuentes: RM Sotheby's, Bonhams, Christie's, Broad Arrow           │
│ Precisión: ALTA (subastas documentadas)                            │
│ Actualización: Event-based (1-2 eventos/mes)                       │
│ Característica: "Carros de inversión, récords mundiales"           │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ SEGMENTO 5: HYPERCARS EXTREME (€10M+)                             │
├────────────────────────────────────────────────────────────────────┤
│ Ejemplos: 1955 Mercedes 300 SLR, Ferrari 250 GTO (raro), 1963 Aston│
│ Volume: 5% del total                                               │
│ Fuentes: RM Sotheby's auctions, private intelligence               │
│ Precisión: MEDIA (muchos datos privados)                           │
│ Actualización: Monthly/Ad-hoc                                      │
│ Característica: "Carros históricos/únicos, pocos datos públicos"   │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Distribución de Volumen

```
Segmento 1 (€100K-€300K):    ████████████████████ 40%  (~8,000/mes)
Segmento 2 (€300K-€800K):    ████████████ 25%          (~5,000/mes)
Segmento 3 (€800K-€3M):      ███████ 15%               (~3,000/mes)
Segmento 4 (€3M-€10M):       ██████ 10%                (~2,000/mes)
Segmento 5 (€10M+):          ███ 5%                    (~1,000/mes)
                             ─────────────────────────────────────
TOTAL:                                                  (~19,000/mes)
                                                       (~228,000/año)
```

---

## 3. VOLUMEN DE DATOS A SCRAPEAR

### 3.1 Fuentes por Segmento

```
SEGMENTO 1 (€100K-€300K):
├─ Bring a Trailer              60/día       (BaT favorito aquí)
├─ Collecting Cars              10-15/día    (volumen europeo)
├─ Cars & Bids                  15-20/día    (modernas)
├─ Mecum (seasonal)             100-200/evt  (eventos principales)
├─ Regional EU (Aguttes, etc)   5-10/día     (regional)
└─ Total: ~100-150/día

SEGMENTO 2 (€300K-€800K):
├─ Collecting Cars              10-15/día    (especialización)
├─ Bring a Trailer              8-10/día     (menos volumen)
├─ RM Sotheby's                 5-15/evt     (eventos)
├─ Bonhams                      3-8/evt      (eventos)
├─ Broad Arrow                  8-20/evt     (eventos)
└─ Total: ~25-50/día + event-based

SEGMENTO 3 (€800K-€3M):
├─ RM Sotheby's                 8-20/evt     (especializado)
├─ Bonhams                      5-15/evt     (eventos)
├─ Broad Arrow                  10-30/evt    (creciente)
├─ Gooding & Company            3-10/evt     (especializado)
└─ Total: Event-based (2-4 eventos/mes)

SEGMENTO 4 (€3M-€10M):
├─ RM Sotheby's                 5-10/evt     (Abu Dhabi, Scottsdale)
├─ Bonhams                      2-5/evt      (eventos principales)
├─ Broad Arrow                  5-15/evt     (mercado creciente)
├─ Christie's                   2-5/evt      (ocasional)
└─ Total: Event-based (1-2 eventos/mes)

SEGMENTO 5 (€10M+):
├─ RM Sotheby's                 1-3/año      (históricos, raros)
├─ Christie's                   1-2/año      (ocasional)
├─ Private Intelligence         Variable     (datos limitados)
└─ Total: 1-5 carros/año
```

### 3.2 Calendario de Auctions Principales 2026

```
ENERO:
  • RM Sotheby's Scottsdale (Arizona Car Week) - ~100-150 cars
  • Mecum Kissimmee Florida - 3,000+ cars (filtrar para luxury)
  • Gooding & Company

FEBRERO:
  • RM Sotheby's Monaco
  • Broad Arrow events

MARZO:
  • Various regional auctions

ABRIL:
  • Aguttes Tour Auto (París)

MAYO:
  • Broad Arrow Concorso d'Eleganza Villa d'Este (Italia)
  • RM Sotheby's events

JUNIO-AUGUST:
  • Mecum events
  • RM Sotheby's Monterey (Agosto)
  • Broad Arrow Monterey Jet Center

SEPTIEMBRE-OCTOBER:
  • RM Sotheby's Las Vegas
  • Broad Arrow Zoute Concours (Bélgica)

DICIEMBRE:
  • RM Sotheby's Abu Dhabi (récords mundiales)
  • Various Christmas/year-end auctions
```

---

## 4. SCHEMA COMPLETO DE BASE DE DATOS

### 4.1 Diagrama de Tablas

```
┌─────────────────────────────────────────────────────────────────┐
│                        TABLAS PRINCIPALES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐                                       │
│  │   LISTINGS (Core)    │                                       │
│  ├──────────────────────┤                                       │
│  │ id (UUID) - PK       │                                       │
│  │ source               │─────┐                                 │
│  │ year, make, model    │     │                                 │
│  │ mileage, color       │     │                                 │
│  │ hammer_price         │     │                                 │
│  │ condition_grade      │     │                                 │
│  │ sale_date            │     │                                 │
│  │ location (country)   │     │                                 │
│  └──────────────────────┘     │                                 │
│          │                    │                                 │
│          ├────────────────────┼─────┬──────────────────────┐    │
│          │                    │     │                      │    │
│  ┌───────▼──────────┐  ┌──────▼─┐  │  ┌──────────────────┐│    │
│  │  VEHICLE_SPECS   │  │PRICING │  │  │   AUCTION_INFO   ││    │
│  ├──────────────────┤  ├────────┤  │  ├──────────────────┤│    │
│  │ listing_id - FK  │  │listing │  │  │ listing_id - FK  ││    │
│  │ body_style       │  │ id(FK) │  │  │ auction_house    ││    │
│  │ drivetrain       │  │currency│  │  │ auction_date     ││    │
│  │ transmission     │  │original│  │  │ lot_number       ││    │
│  │ engine_cc        │  │ price  │  │  │ estimate_low/hi  ││    │
│  │ horsepower       │  │premium%│  │  │ sold/unsold      ││    │
│  │ fuel_type        │  │reserve │  │  │ reserve_met      ││    │
│  │ doors            │  │ met    │  │  └──────────────────┘│    │
│  └──────────────────┘  └────────┘  │                      │    │
│                                    │  ┌──────────────────┐│    │
│                                    │  │  LOCATION_DATA   ││    │
│                                    │  ├──────────────────┤│    │
│                                    │  │ listing_id - FK  ││    │
│                                    │  │ country          ││    │
│                                    │  │ region/state     ││    │
│                                    │  │ city             ││    │
│                                    │  │ latitude/long    ││    │
│                                    │  │ zip_code         ││    │
│                                    │  └──────────────────┘│    │
│                                    │                      │    │
│                                    └──────────────────────┘    │
│                                                                  │
│  ┌────────────────────┐                                        │
│  │ CONDITION_HISTORY  │  (TimescaleDB - temporal)              │
│  ├────────────────────┤                                        │
│  │ listing_id - FK    │                                        │
│  │ timestamp          │                                        │
│  │ grade (1-4)        │                                        │
│  │ description_hash   │                                        │
│  │ photos_count       │                                        │
│  └────────────────────┘                                        │
│                                                                  │
│  ┌────────────────────┐                                        │
│  │ PRICE_HISTORY      │  (TimescaleDB - tracking precios)      │
│  ├────────────────────┤                                        │
│  │ listing_id - FK    │                                        │
│  │ timestamp          │                                        │
│  │ price_usd          │                                        │
│  │ price_eur          │                                        │
│  │ price_gbp          │                                        │
│  │ status             │                                        │
│  └────────────────────┘                                        │
│                                                                  │
│  ┌─────────────────────┐                                       │
│  │ VEHICLE_HISTORY     │  (Propietarios anteriores)            │
│  ├─────────────────────┤                                       │
│  │ listing_id - FK     │                                       │
│  │ previous_sale_date  │                                       │
│  │ previous_price      │                                       │
│  │ previous_source     │                                       │
│  │ appreciation %      │                                       │
│  │ time_between_sales  │                                       │
│  └─────────────────────┘                                       │
│                                                                  │
│  ┌──────────────────────┐                                      │
│  │ PHOTOS & MEDIA       │  (URLs de fotos para análisis)       │
│  ├──────────────────────┤                                      │
│  │ listing_id - FK      │                                      │
│  │ photo_url            │                                      │
│  │ photo_order          │                                      │
│  │ local_cache_path     │                                      │
│  │ dimensions (W x H)   │                                      │
│  │ file_size_mb         │                                      │
│  └──────────────────────┘                                      │
│                                                                  │
│  ┌──────────────────────┐                                      │
│  │ PROVENANCE_DATA      │  (Historia del carro importante!)    │
│  ├──────────────────────┤                                      │
│  │ listing_id - FK      │                                      │
│  │ racing_history       │  (true/false)                        │
│  │ famous_owner         │  (nombre si aplica)                  │
│  │ competition_history  │  (descrip.)                          │
│  │ restoration_history  │  (descripción)                       │
│  │ accident_history     │  (red flags)                         │
│  │ ownership_count      │  (número de dueños)                  │
│  │ service_records      │  (completos?)                        │
│  │ originality_score    │  (% original parts)                  │
│  └──────────────────────┘                                      │
│                                                                  │
│  ┌──────────────────────┐                                      │
│  │ MARKET_SEGMENTS      │  (Para análisis comparativo)         │
│  ├──────────────────────┤                                      │
│  │ segment_id - PK      │                                      │
│  │ segment_name         │  (ej: "Ferrari 500 Series")          │
│  │ year_range           │  (1950-1970)                         │
│  │ make, model          │                                      │
│  │ variant              │  (opcionalmente)                     │
│  │ expected_price_range │  (low/high)                          │
│  │ rarity_score         │  (1-10)                              │
│  │ investment_potential │  (low/medium/high)                   │
│  └──────────────────────┘                                      │
│                                                                  │
│  ┌──────────────────────┐                                      │
│  │ MARKET_ANALYTICS     │  (Agregaciones diarias)              │
│  ├──────────────────────┤                                      │
│  │ date - PK            │                                      │
│  │ segment_id - FK      │                                      │
│  │ country - PK         │                                      │
│  │ avg_price            │                                      │
│  │ median_price         │                                      │
│  │ price_range_low/high │                                      │
│  │ sold_count           │                                      │
│  │ unsold_count         │                                      │
│  │ avg_days_to_sell     │                                      │
│  │ price_trend          │  (up/flat/down)                      │
│  │ price_volatility     │  (std dev)                           │
│  └──────────────────────┘                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 SQL DDL Completo

```sql
-- TABLA PRINCIPAL: LISTINGS
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- IDENTIFICACIÓN FUENTE
    source VARCHAR(50) NOT NULL,  -- 'BaT', 'CollectingCars', 'RMSothebys', etc
    source_id VARCHAR(200) NOT NULL,  -- Lot number, listing ID, etc
    source_url TEXT NOT NULL UNIQUE,
    
    -- DATOS DEL VEHÍCULO
    year INT NOT NULL CHECK (year >= 1900 AND year <= CURRENT_YEAR + 1),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    trim VARCHAR(100),
    body_style VARCHAR(50),
    color_exterior VARCHAR(100),
    color_interior VARCHAR(100),
    
    -- CONDICIÓN Y ESPECIFICACIONES
    mileage INT,
    mileage_unit ENUM('km', 'miles') DEFAULT 'km',
    vin VARCHAR(17),
    
    -- CLASIFICACIÓN HAGERTY
    hagerty_grade INT CHECK (hagerty_grade IN (1, 2, 3, 4)),
    condition_description TEXT,
    original_vs_restored ENUM('original', 'restored', 'partial', 'unknown'),
    matching_numbers BOOLEAN,
    
    -- PRECIOS
    estimate_low NUMERIC(15, 2),
    estimate_high NUMERIC(15, 2),
    hammer_price NUMERIC(15, 2),
    original_currency ENUM('USD', 'EUR', 'GBP', 'JPY', 'CHF'),
    price_usd NUMERIC(15, 2),
    price_eur NUMERIC(15, 2),
    price_gbp NUMERIC(15, 2),
    buyers_premium_percent NUMERIC(5, 2),
    
    -- UBICACIÓN
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    city VARCHAR(100),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    
    -- INFORMACIÓN DE SUBASTA
    auction_house VARCHAR(100),
    auction_date DATE,
    auction_location VARCHAR(100),
    sale_date DATE NOT NULL,
    list_date DATE,
    days_to_sell INT GENERATED ALWAYS AS (
        CASE WHEN sale_date >= list_date THEN (sale_date - list_date) ELSE NULL END
    ) STORED,
    status ENUM('active', 'sold', 'unsold', 'delisted', 'draft') DEFAULT 'draft',
    reserve_met BOOLEAN,
    
    -- MULTIMEDIA
    photos_count INT DEFAULT 0,
    description_text TEXT,
    
    -- PROVENANCE Y HISTORIA
    racing_history BOOLEAN DEFAULT FALSE,
    famous_owner VARCHAR(200),
    competition_entries INT,
    accident_history TEXT,
    ownership_count INT,
    service_records_complete BOOLEAN,
    restoration_date DATE,
    restoration_type VARCHAR(100),  -- 'frame-off', 'cosmetic', etc
    
    -- METADATOS
    seller_name VARCHAR(200),
    seller_contact VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    scrape_timestamp TIMESTAMP DEFAULT NOW(),
    data_quality_score INT CHECK (data_quality_score BETWEEN 0 AND 100),
    
    -- ÍNDICES
    INDEX idx_year_make_model (year, make, model),
    INDEX idx_country_city (country, city),
    INDEX idx_sale_date (sale_date),
    INDEX idx_source_id (source, source_id),
    INDEX idx_price_range (price_usd),
    INDEX idx_status (status),
    UNIQUE INDEX idx_source_unique (source, source_id)
);

-- TABLA: VEHICLE_SPECS (Especificaciones técnicas detalladas)
CREATE TABLE vehicle_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- MOTOR
    engine_cc INT,
    engine_type VARCHAR(50),  -- 'V8', 'V12', 'Inline-6', etc
    horsepower INT,
    torque_nm INT,
    fuel_type ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid'),
    
    -- TRANSMISIÓN
    transmission VARCHAR(50),  -- 'Manual', 'Automatic', 'CVT', etc
    gears INT,
    drivetrain ENUM('RWD', 'FWD', 'AWD', '4WD'),
    
    -- CHASIS Y SUSPENSION
    suspension_type VARCHAR(100),
    brakes VARCHAR(100),
    wheels_size VARCHAR(50),
    
    -- INFORMACIÓN ADICIONAL
    doors INT,
    seats INT,
    weight_kg INT,
    length_cm INT,
    width_cm INT,
    height_cm INT,
    
    -- PERFORMANCE
    0_100_kmh_seconds NUMERIC(4, 2),
    top_speed_kmh INT,
    
    -- CARACTERÍSTICAS ESPECIALES
    special_features TEXT,
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_listing (listing_id)
);

-- TABLA: PRICING
CREATE TABLE pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- PRECIOS ORIGINALES
    hammer_price_original NUMERIC(15, 2),
    original_currency ENUM('USD', 'EUR', 'GBP', 'JPY', 'CHF'),
    
    -- PRECIOS CONVERTIDOS A ESTÁNDARES
    price_usd NUMERIC(15, 2),
    price_eur NUMERIC(15, 2),
    price_gbp NUMERIC(15, 2),
    
    -- INFORMACIÓN DE COMISIÓN
    buyers_premium_percent NUMERIC(5, 2),
    buyers_premium_amount NUMERIC(15, 2),
    total_price_to_buyer NUMERIC(15, 2),
    
    -- MARKUP INFORMATION
    seller_estimate_low NUMERIC(15, 2),
    seller_estimate_high NUMERIC(15, 2),
    estimate_met_percent INT,  -- (hammer_price / avg_estimate) * 100
    
    -- AUDITORÍA DE PRECIOS
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_listing_pricing (listing_id)
);

-- TABLA: AUCTION_INFO
CREATE TABLE auction_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- INFORMACIÓN DE SUBASTA
    auction_house VARCHAR(100) NOT NULL,
    auction_event_name VARCHAR(200),
    auction_location VARCHAR(100),
    auction_date DATE,
    
    -- LOT INFORMATION
    lot_number VARCHAR(50),
    lot_order INT,
    reserve_price NUMERIC(15, 2),
    reserve_met BOOLEAN,
    
    -- ESTIMADOS
    pre_sale_estimate_low NUMERIC(15, 2),
    pre_sale_estimate_high NUMERIC(15, 2),
    
    -- RESULTADOS
    hammer_price NUMERIC(15, 2),
    total_price_realized NUMERIC(15, 2),
    status ENUM('unsold', 'sold', 'passed', 'withdrawn'),
    
    -- BIDDING INFORMATION
    number_of_bids INT,
    starting_bid NUMERIC(15, 2),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_listing_auction (listing_id)
);

-- TABLA: LOCATION_DATA
CREATE TABLE location_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- GEOLOCALIZACIÓN COMPLETA
    country VARCHAR(100) NOT NULL,
    country_code CHAR(2),
    region VARCHAR(100),
    region_code VARCHAR(10),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- COORDENADAS
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    timezone VARCHAR(50),
    
    -- INFORMACIÓN DE MERCADO LOCAL
    market_segment_local VARCHAR(100),
    typical_price_range_eur NUMERIC(15, 2),
    market_depth INT,  -- número de carros similares en mercado
    
    -- AUDITORÍA
    geocoded_by VARCHAR(50),  -- 'google_maps', 'openstreetmap', etc
    geocoded_date DATE,
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_listing_location (listing_id)
);

-- TABLA TEMPORAL: PRICE_HISTORY (TimescaleDB)
CREATE TABLE price_history (
    time TIMESTAMP NOT NULL,
    listing_id UUID NOT NULL,
    
    -- PRECIOS HISTÓRICOS
    price_usd NUMERIC(15, 2),
    price_eur NUMERIC(15, 2),
    price_gbp NUMERIC(15, 2),
    
    -- ESTADO
    status ENUM('active', 'sold', 'unsold', 'delisted'),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- Convertir price_history a TimescaleDB hypertable
SELECT create_hypertable('price_history', 'time', if_not_exists => TRUE);
SELECT set_integer_now_func('price_history', 'listing_id_epoch', replace_if_exists => TRUE);

-- TABLA: VEHICLE_HISTORY (Ventas anteriores del mismo carro)
CREATE TABLE vehicle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- VENTA ANTERIOR
    previous_sale_date DATE,
    previous_price NUMERIC(15, 2),
    previous_currency ENUM('USD', 'EUR', 'GBP', 'JPY', 'CHF'),
    previous_source VARCHAR(50),  -- Dónde se vendió antes
    previous_location VARCHAR(200),
    
    -- ANÁLISIS
    time_between_sales_days INT,
    appreciation_depreciation_percent NUMERIC(8, 2),
    annualized_appreciation NUMERIC(8, 2),
    
    -- INFORMACIÓN ADICIONAL
    reason_for_sale VARCHAR(200),
    improvements_made TEXT,
    
    -- AUDITORÍA
    data_source VARCHAR(100),  -- Cómo obtuvimos esta información
    confidence_level ENUM('high', 'medium', 'low'),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- TABLA: PHOTOS_MEDIA
CREATE TABLE photos_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- INFORMACIÓN DE FOTOS
    photo_url TEXT NOT NULL,
    photo_order INT,
    photo_category VARCHAR(50),  -- 'exterior', 'interior', 'detail', 'proof', etc
    
    -- LOCAL CACHE
    local_cache_path VARCHAR(500),
    photo_hash VARCHAR(64),  -- SHA256 para deduplication
    
    -- DIMENSIONES
    width_px INT,
    height_px INT,
    file_size_mb NUMERIC(10, 2),
    image_quality_score INT CHECK (image_quality_score BETWEEN 0 AND 100),
    
    -- ANÁLISIS DE IMAGEN (Si aplica)
    has_damage BOOLEAN,
    apparent_condition_grade INT,
    color_accuracy NUMERIC(5, 2),
    
    -- AUDITORÍA
    downloaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- TABLA: PROVENANCE_DATA (Historia y pedigree)
CREATE TABLE provenance_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    
    -- HISTORIA
    racing_history BOOLEAN DEFAULT FALSE,
    racing_details TEXT,
    
    -- PROPIETARIOS FAMOSOS
    famous_owner BOOLEAN DEFAULT FALSE,
    famous_owner_name VARCHAR(200),
    famous_owner_type ENUM('celebrity', 'racing_driver', 'collector', 'royal', 'other'),
    
    -- INFORMACIÓN DE COMPETENCIA
    competition_count INT,
    competition_details TEXT,
    
    -- RED FLAGS
    accident_history BOOLEAN DEFAULT FALSE,
    accident_details TEXT,
    
    -- ORIGINALIDAD
    ownership_count INT,
    service_records_complete BOOLEAN,
    
    -- RESTAURACIÓN
    restoration_done BOOLEAN DEFAULT FALSE,
    restoration_date DATE,
    restoration_type ENUM('frame-off', 'cosmetic', 'partial', 'unknown'),
    restoration_quality ENUM('show', 'excellent', 'good', 'fair', 'poor', 'unknown'),
    restoration_budget_estimated NUMERIC(15, 2),
    
    -- DOCUMENTACIÓN
    original_documents BOOLEAN DEFAULT FALSE,
    factory_history_available BOOLEAN DEFAULT FALSE,
    race_history_documented BOOLEAN DEFAULT FALSE,
    
    -- ORIGINALITY SCORE
    originality_score INT CHECK (originality_score BETWEEN 0 AND 100),
    original_parts_percentage INT,
    
    -- AUDITORÍA
    created_at TIMESTAMP DEFAULT NOW(),
    last_verified_date DATE,
    data_source VARCHAR(100),
    
    -- FOREIGN KEY
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY unique_listing_provenance (listing_id)
);

-- TABLA: MARKET_SEGMENTS (Segmentación de mercado)
CREATE TABLE market_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- IDENTIFICACIÓN DEL SEGMENTO
    segment_code VARCHAR(50) UNIQUE NOT NULL,
    segment_name VARCHAR(200) NOT NULL,
    segment_description TEXT,
    
    -- CRITERIOS
    make VARCHAR(100),
    model VARCHAR(100),
    generation VARCHAR(50),
    year_range_start INT,
    year_range_end INT,
    variant VARCHAR(200),
    
    -- CARACTERÍSTICAS DEL MERCADO
    typical_price_range_low NUMERIC(15, 2),
    typical_price_range_high NUMERIC(15, 2),
    expected_appreciation_annual NUMERIC(5, 2),
    market_liquidity ENUM('high', 'medium', 'low'),
    
    -- VALORACIÓN
    rarity_score INT CHECK (rarity_score BETWEEN 1 AND 10),
    collectibility_score INT CHECK (collectibility_score BETWEEN 1 AND 10),
    investment_potential ENUM('high', 'medium', 'low', 'speculative'),
    
    -- MERCADO GEOGRÁFICO
    primary_markets TEXT,  -- 'USA,UK,Germany'
    seasonal_variation BOOLEAN DEFAULT FALSE,
    
    -- AUDITORÍA
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- TABLA: MARKET_ANALYTICS (Agregaciones diarias)
CREATE TABLE market_analytics (
    date DATE NOT NULL,
    segment_id UUID NOT NULL,
    country VARCHAR(100) NOT NULL,
    
    -- ESTADÍSTICAS DE PRECIO
    avg_price_usd NUMERIC(15, 2),
    median_price_usd NUMERIC(15, 2),
    stddev_price_usd NUMERIC(15, 2),
    min_price_usd NUMERIC(15, 2),
    max_price_usd NUMERIC(15, 2),
    
    -- VOLUMEN
    listings_count INT,
    sold_count INT,
    unsold_count INT,
    avg_days_to_sell INT,
    sell_through_rate NUMERIC(5, 2),
    
    -- TENDENCIAS
    price_trend ENUM('up', 'flat', 'down'),
    price_momentum NUMERIC(8, 2),  -- % change vs previous month
    price_volatility NUMERIC(8, 2),  -- standard deviation
    
    -- DEMANDA
    search_volume_relative INT,  -- índice relativo
    buyer_interest_level ENUM('high', 'medium', 'low'),
    
    -- AUDITORÍA
    created_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (date, segment_id, country),
    FOREIGN KEY (segment_id) REFERENCES market_segments(id) ON DELETE CASCADE
);

-- ÍNDICES CRÍTICOS
CREATE INDEX idx_listings_year_make_model ON listings(year, make, model);
CREATE INDEX idx_listings_country_year ON listings(country, year);
CREATE INDEX idx_listings_sale_date ON listings(sale_date);
CREATE INDEX idx_listings_source_id ON listings(source, source_id);
CREATE INDEX idx_listings_price_usd ON listings(price_usd);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_auction_house ON listings(auction_house);

CREATE INDEX idx_price_history_listing_time ON price_history(listing_id, time);
CREATE INDEX idx_vehicle_history_listing_id ON vehicle_history(listing_id);
CREATE INDEX idx_provenance_listing_id ON provenance_data(listing_id);

CREATE INDEX idx_market_analytics_date_segment ON market_analytics(date, segment_id);
CREATE INDEX idx_market_analytics_country ON market_analytics(country);
```

---

## 5. DICCIONARIO DE CAMPOS

### 5.1 Campos Críticos para Alejandro Lince

```
┌─────────────────────────────────────────────────────────────┐
│ CAMPOS PARA FAIR VALUE RANGE CALCULATION                    │
├─────────────────────────────────────────────────────────────┤

1. price_usd / price_eur / price_gbp
   ├─ Requerido: SÍ (crítico)
   ├─ Fuente: hammer_price convertido automáticamente
   ├─ Validación: No NULL, > 100K, < 500M
   ├─ Normalización: ISO 4217 currency codes
   └─ Uso: Base para Fair Value Range

2. country
   ├─ Requerido: SÍ (crítico)
   ├─ Fuente: Location data del listing
   ├─ Validación: ISO 3166-1 country codes
   ├─ Opciones: 'USA', 'UK', 'Germany', 'France', 'Italy', etc.
   └─ Uso: Separación geográfica (❌ NO mezclar mercados)

3. mileage + mileage_unit
   ├─ Requerido: SÍ (importante)
   ├─ Fuente: Descripción del listing
   ├─ Validación: >= 0, <= 300,000
   ├─ Normalización: Convertir a km
   └─ Uso: Equivalencia (±10% de mileage similar)

4. color_exterior + color_interior
   ├─ Requerido: SÍ (importante)
   ├─ Fuente: Descripción del listing
   ├─ Normalización: Standarizar nombres (no "Rosso Corsa" vs "Red")
   └─ Uso: Equivalencia por color exacto

5. original_vs_restored
   ├─ Requerido: CRÍTICO
   ├─ Opciones: 'original', 'restored', 'partial', 'unknown'
   ├─ Fuente: Análisis de descripción + fotos
   └─ Uso: Ajuste de precio (original +30%, poor restoration -20%)

6. hagerty_grade (1, 2, 3, 4)
   ├─ Requerido: Deseable pero no siempre disponible
   ├─ Fuente: RM Sotheby's, Bonhams, análisis manual
   ├─ Validación: Solo 1, 2, 3, 4
   └─ Uso: Premium classification (grade 1 = +50%, grade 4 = -40%)

7. sale_date
   ├─ Requerido: SÍ (crítico)
   ├─ Fuente: Fecha de cierre del listing
   ├─ Formato: ISO 8601 (YYYY-MM-DD)
   └─ Uso: Filtrar datos recientes (últimos 12 meses MÁXIMO)

8. condition_description
   ├─ Requerido: SÍ (importante)
   ├─ Fuente: Texto completo del listing
   ├─ Longitud: 100-5000 caracteres
   └─ Uso: NLP analysis para detectar damage/red flags

9. buyers_premium_percent
   ├─ Requerido: SÍ (crítico para auctions)
   ├─ Fuente: 5-15% típicamente
   ├─ Uso: Cálculo de precio real = hammer_price * (1 + premium%)
   └─ Nota: MUY IMPORTANTE - sin esto precios son incorrectos

10. location (city/region)
    ├─ Requerido: Deseable
    ├─ Fuente: Listing location data
    ├─ Uso: Análisis local de mercado (precio Baviera vs Bélgica)
    └─ Nota: Afecta 10-20% del precio

11. matching_numbers
    ├─ Requerido: Importante para clásicos
    ├─ Valores: true/false/unknown
    ├─ Impacto: Original matching = +15-30%
    └─ Nota: Crítico para Ferrari/Porsche/Mercedes clásicas

12. originality_score (0-100)
    ├─ Requerido: Importante
    ├─ Fuente: Análisis de original_parts_percentage
    ├─ Impacto: 100% original = +20%, 50% original = -10%
    └─ Uso: Ajuste fino de Fair Value

└─────────────────────────────────────────────────────────────┘
```

### 5.2 Campos Secundarios (Importante)

```
- body_style: Coupe vs Roadster = 10-15% diferencia precio
- transmission: Manual = +20% (coleccionistas), Automatic = baseline
- engine_cc/horsepower: Afecta 5-10% del valor
- racing_history: +30-50% si es documentado
- famous_owner: +20-30% si es verificable
- restoration_type: Frame-off restore = baseline, cosmetic = -20%
- photos_count: >20 fotos = mejor transparency, baja discount por uncertainty
- service_records_complete: Sí = +10%, No = -15%
```

---

## 6. RELACIONES ENTRE TABLAS

### 6.1 Entity-Relationship Diagram

```
LISTINGS (core)
    │
    ├──1:1─→ VEHICLE_SPECS (engine, transmission, etc)
    ├──1:1─→ PRICING (precios y comisiones)
    ├──1:1─→ AUCTION_INFO (información de subasta)
    ├──1:1─→ LOCATION_DATA (geografía)
    ├──1:1─→ PROVENANCE_DATA (historia y pedigree)
    ├──0:N─→ VEHICLE_HISTORY (ventas anteriores)
    ├──0:N─→ PHOTOS_MEDIA (fotos y multimedia)
    └──0:N─→ PRICE_HISTORY (histórico de precios temporal)

MARKET_SEGMENTS
    │
    └──1:N─→ MARKET_ANALYTICS (agregaciones diarias)
    
LISTINGS también referencia implícitamente a MARKET_SEGMENTS
(por year, make, model matching)
```

### 6.2 Queries de Relación Clave

```sql
-- Obtener el carro con su histórico completo
SELECT 
    l.*,
    vs.engine_cc, vs.horsepower, vs.transmission,
    p.price_usd, p.buyers_premium_percent,
    ai.auction_house, ai.auction_date,
    ld.country, ld.city,
    pd.originality_score, pd.restoration_type,
    COUNT(pm.id) as photo_count
FROM listings l
LEFT JOIN vehicle_specs vs ON l.id = vs.listing_id
LEFT JOIN pricing p ON l.id = p.listing_id
LEFT JOIN auction_info ai ON l.id = ai.listing_id
LEFT JOIN location_data ld ON l.id = ld.listing_id
LEFT JOIN provenance_data pd ON l.id = pd.listing_id
LEFT JOIN photos_media pm ON l.id = pm.listing_id
WHERE l.id = $1
GROUP BY l.id, vs.id, p.id, ai.id, ld.id, pd.id;

-- Obtener histórico de ventas previas del mismo carro
SELECT 
    l.year, l.make, l.model,
    vh.previous_sale_date,
    vh.previous_price,
    vh.previous_currency,
    vh.appreciation_depreciation_percent,
    vh.annualized_appreciation
FROM vehicle_history vh
JOIN listings l ON vh.listing_id = l.id
WHERE l.id = $1
ORDER BY vh.previous_sale_date DESC;
```

---

## 7. ÍNDICES Y OPTIMIZACIÓN

### 7.1 Índices Críticos

```
PRIMARIOS (para queries más frecuentes):
├─ idx_listings_year_make_model
│  └─ Uso: Buscar carros similares por model
│  └─ Query: SELECT * FROM listings WHERE year=2000 AND make='Ferrari' AND model='355'
│  └─ Impacto: 1000x más rápido sin índice

├─ idx_listings_country_year
│  └─ Uso: Fair Value Range por país y año
│  └─ Query: SELECT * FROM listings WHERE country='Germany' AND year BETWEEN 1990 AND 2000
│  └─ Impacto: Crítico para análisis geográfico

├─ idx_listings_sale_date
│  └─ Uso: Filtrar datos recientes (últimos 12 meses)
│  └─ Query: SELECT * FROM listings WHERE sale_date >= NOW() - INTERVAL '1 year'
│  └─ Impacto: 100x más rápido para queries temporales

├─ idx_listings_source_id (UNIQUE)
│  └─ Uso: Deduplicación - NO permitir mismo carro 2x
│  └─ Query: SELECT COUNT(*) FROM listings WHERE source='BaT' AND source_id='12345'
│  └─ Impacto: Garantiza integridad de datos

├─ idx_listings_price_usd
│  └─ Uso: Range queries para Fair Value buckets
│  └─ Query: SELECT * FROM listings WHERE price_usd BETWEEN 100000 AND 800000
│  └─ Impacto: Rápido acceso a rangos de precio

└─ idx_listings_auction_house
   └─ Uso: Filtrar por casa de subastas
   └─ Query: SELECT * FROM listings WHERE auction_house='RM Sotheby\\'s'
   └─ Impacto: Análisis de marcas de auction

SECUNDARIOS:
├─ idx_price_history_listing_time
│  └─ Uso: TimescaleDB - datos históricos de precios
│  └─ Impacto: Critical for temporal queries

├─ idx_vehicle_history_listing_id
│  └─ Uso: Obtener histórico de ventas previas
│  └─ Impacto: Importante para appreciation/depreciation

└─ idx_market_analytics_date_segment
   └─ Uso: Queries de tendencias de mercado
   └─ Impacto: Agregaciones rápidas
```

### 7.2 Estrategia de Partición

```
Para volúmenes grandes (>1M carros), considerar partición:

-- Particionar LISTINGS por año
CREATE TABLE listings_2020 PARTITION OF listings
    FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');

CREATE TABLE listings_2021 PARTITION OF listings
    FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');

-- Beneficios:
├─ Queries más rápidas (solo escanea partition relevante)
├─ Vacuum/Analyze más rápido
├─ Backup/restore más manejable
└─ Archivado de datos antiguos más fácil

-- TimescaleDB ya maneja automáticamente la partición temporal
-- para PRICE_HISTORY por chunks de tiempo
```

### 7.3 Compresión de Datos

```sql
-- Para datos históricos (price_history)
SELECT compress_chunk(chunk)
FROM show_chunks('price_history')
WHERE chunk < now() - INTERVAL '3 months';

-- Resultado esperado:
├─ Reducción: 70-90% de tamaño de disco
├─ Velocidad: 10-100x más lento para reads (acceptable para histórico)
└─ Uso ideal: Datos que no se modifican frecuentemente
```

---

## 8. ESTRATEGIA DE SCRAPPERS POR SEGMENTO

### 8.1 Priorización por Segmento y Volumen

```
SEGMENTO 1 (€100K-€300K) - 80% ESFUERZO, 40% VOLUMEN
┌─────────────────────────────────────────────────────────────┐
│ PRIORIDAD 1: Bring a Trailer                                │
│ ├─ Volumen: 60/día (22,000/año)                             │
│ ├─ Precisión: Alta (hand-selected, transparent)             │
│ ├─ Actualización: 3-4x/día (rolling auctions)               │
│ ├─ API: No pública, requiere Puppeteer scraper              │
│ ├─ Campos: Todos (incluyendo comentarios comunidad)         │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ EMPEZAR AQUÍ                        │
│                                                               │
│ PRIORIDAD 2: Collecting Cars                                │
│ ├─ Volumen: 10-15/día (3,650-5,475/año)                     │
│ ├─ Precisión: Alta (verificación seller)                    │
│ ├─ Actualización: 2-3x/día (24/7 rolling)                   │
│ ├─ API: No pública, requiere Puppeteer scraper              │
│ ├─ Campos: Incluyendo location EXACTA                       │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ SEGUNDO INMEDIATAMENTE               │
│                                                               │
│ PRIORIDAD 3: Cars & Bids                                    │
│ ├─ Volumen: 15-20/día (5,475-7,300/año)                     │
│ ├─ Precisión: Media (datos menos detallados)                │
│ ├─ Actualización: 2x/día                                    │
│ ├─ API: No pública, scraper necesario                       │
│ └─ Prioridad: ⭐⭐⭐⭐ TERCERO (menor precision)              │
│                                                               │
│ PRIORIDAD 4: Regional EU (Aguttes, Coys, etc)              │
│ ├─ Volumen: 5-10/día combinado                              │
│ ├─ Precisión: Alta (subastas documentadas)                  │
│ ├─ Actualización: Event-based (1-5/mes cada fuente)         │
│ ├─ Importancia: Profundidad europea                         │
│ └─ Prioridad: ⭐⭐⭐ (volumen menor, datos valiosos)         │
│                                                               │
│ SUBTOTAL SEGMENTO 1: ~100-150 carros/día nuevos             │
└─────────────────────────────────────────────────────────────┘

SEGMENTO 2 (€300K-€800K) - 15% ESFUERZO, 25% VOLUMEN
┌─────────────────────────────────────────────────────────────┐
│ PRIORIDAD 1: Collecting Cars (especialización aquí)         │
│ ├─ Volumen: 10-15/día (focus en este segmento)              │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ YA ESTÁ EN SEGMENTO 1               │
│                                                               │
│ PRIORIDAD 2: RM Sotheby's (subastas live)                   │
│ ├─ Volumen: 5-15/evento (~50-200/mes)                       │
│ ├─ Precisión: ALTA (subastas documentadas)                  │
│ ├─ Actualización: Event-based (2-4 eventos/mes)             │
│ ├─ Importancia: CRÍTICO - precios reales hammer prices      │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ PARA VALIDACIÓN                      │
│                                                               │
│ PRIORIDAD 3: Bonhams (subastas live)                        │
│ ├─ Volumen: 3-8/evento (~25-100/mes)                        │
│ ├─ Importancia: Validación secundaria                       │
│ └─ Prioridad: ⭐⭐⭐⭐ APOYO A RM SOTHEBY'S                  │
│                                                               │
│ PRIORIDAD 4: Broad Arrow (creciente)                        │
│ ├─ Volumen: 10-30/evento (~100-200/mes)                     │
│ ├─ Importancia: Especializado, crecimiento explosivo        │
│ └─ Prioridad: ⭐⭐⭐⭐ NUEVA OPORTUNIDAD                     │
│                                                               │
│ SUBTOTAL SEGMENTO 2: ~25-50/día + event-based               │
└─────────────────────────────────────────────────────────────┘

SEGMENTO 3 (€800K-€3M) - 3% ESFUERZO, 15% VOLUMEN
┌─────────────────────────────────────────────────────────────┐
│ SOLO: Subastas live (RM, Bonhams, Broad Arrow, Gooding)    │
│ ├─ Volumen: ~50-100 carros/mes (muy selectivo)              │
│ ├─ Importancia: CRÍTICO para validation de Fair Value       │
│ ├─ Actualización: Event-based (2-4 eventos/mes)             │
│ ├─ Precisión: MÁXIMA (documentación exhaustiva)             │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ PERO EVENT-BASED (no daily)         │
│                                                               │
│ NOTA: Estos carros tambien aparecen en Collecting Cars      │
│ pero con menos detalles, así que priorizar RM/Bonhams       │
└─────────────────────────────────────────────────────────────┘

SEGMENTO 4 (€3M-€10M) - 1% ESFUERZO, 10% VOLUMEN
┌─────────────────────────────────────────────────────────────┐
│ SOLO: RM Sotheby's y Bonhams (los únicos con volumen)       │
│ ├─ Volumen: ~20-50 carros/mes                               │
│ ├─ Actualización: Event-based (principales: Scottsdale,     │
│ │  Monaco, Abu Dhabi = 3-4x/año MÁXIMO)                    │
│ └─ Prioridad: ⭐⭐⭐⭐⭐ PARA VALIDACIÓN MÁXIMA              │
└─────────────────────────────────────────────────────────────┘

SEGMENTO 5 (€10M+) - 0.5% ESFUERZO, 5% VOLUMEN
┌─────────────────────────────────────────────────────────────┐
│ MANUAL: Solo RM Sotheby's cuando venden (1-3/año)           │
│ ├─ Nota: Muy poco volumen, datos muy públicos cuando pasan  │
│ └─ Prioridad: ⭐⭐ INFORMACIONAL, NO CRÍTICO                 │
└─────────────────────────────────────────────────────────────┘

DISTRIBUCIÓN DE ESFUERZO RECOMENDADA:
├─ 40% en Segmento 1 scrappers (volumen alto, precisión)
├─ 30% en Segmento 2 subastas live (validación crítica)
├─ 20% en infraestructura de datos (database, dedup, alerts)
├─ 7% en Segmento 3+ (premium, pero menos volumen)
└─ 3% en dashboards y reportes
```

---

## 9. QUERIES CLAVE PARA ALEJANDRO

### 9.1 Fair Value Range Calculator

```sql
-- QUERY 1: Fair Value Range por Modelo, País y Año
-- USO: Establecer "precio justo" para un carro
-- LÓGICA:
--  1. Buscar últimos 20 carros similares en MISMO país
--  2. Filtrar outliers (top 2 + bottom 2)
--  3. Calcular media ponderada por condition y mileage
--  4. Ajustar por color, equipamiento, provenance

WITH similar_cars AS (
    SELECT 
        l.id,
        l.year,
        l.make,
        l.model,
        l.price_usd,
        l.mileage,
        l.color_exterior,
        l.hagerty_grade,
        pd.originality_score,
        pd.restoration_type,
        l.sale_date,
        ROW_NUMBER() OVER (ORDER BY l.sale_date DESC) as recency_rank
    FROM listings l
    LEFT JOIN provenance_data pd ON l.id = pd.listing_id
    LEFT JOIN location_data ld ON l.id = ld.listing_id
    WHERE 
        l.year = $year
        AND l.make = $make
        AND l.model = $model
        AND ld.country = $country
        AND l.status = 'sold'
        AND l.sale_date >= NOW() - INTERVAL '12 months'
        AND l.data_quality_score >= 80
    LIMIT 20
),
outlier_removed AS (
    SELECT *
    FROM (
        SELECT *,
               ROW_NUMBER() OVER (ORDER BY price_usd ASC) as price_rank_asc,
               ROW_NUMBER() OVER (ORDER BY price_usd DESC) as price_rank_desc
        FROM similar_cars
    ) ranked
    WHERE price_rank_asc > 2 AND price_rank_desc > 2  -- Remove top 2 and bottom 2
),
with_adjustments AS (
    SELECT 
        *,
        price_usd as base_price,
        -- Ajuste por condition
        (CASE 
            WHEN hagerty_grade = 1 THEN 0.50  -- +50%
            WHEN hagerty_grade = 2 THEN 0.20  -- +20%
            WHEN hagerty_grade = 3 THEN 0     -- baseline
            WHEN hagerty_grade = 4 THEN -0.40 -- -40%
            ELSE 0 END) as condition_adjustment,
        -- Ajuste por restoration
        (CASE 
            WHEN restoration_type = 'frame-off' THEN 0
            WHEN restoration_type = 'cosmetic' THEN -0.15
            WHEN restoration_type = 'partial' THEN -0.25
            ELSE 0 END) as restoration_adjustment,
        -- Ajuste por originalidad
        ((COALESCE(originality_score, 50) - 50) / 100 * 0.20) as originality_adjustment
    FROM outlier_removed
)
SELECT 
    COUNT(*) as sample_size,
    ROUND(AVG(base_price), 2) as fair_value_mean,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY base_price), 2) as fair_value_median,
    ROUND(MIN(base_price), 2) as price_floor,
    ROUND(MAX(base_price), 2) as price_ceiling,
    ROUND(STDDEV(base_price), 2) as price_std_dev,
    
    -- Rango recomendado (±1 std dev)
    ROUND(AVG(base_price) - STDDEV(base_price), 2) as recommended_low,
    ROUND(AVG(base_price) + STDDEV(base_price), 2) as recommended_high,
    
    -- Ajustes promedio
    ROUND(AVG(condition_adjustment), 2) as avg_condition_impact,
    ROUND(AVG(restoration_adjustment), 2) as avg_restoration_impact,
    ROUND(AVG(originality_adjustment), 2) as avg_originality_impact
FROM with_adjustments;

-- PARÁMETROS:
-- $year: 2000
-- $make: Ferrari
-- $model: 355
-- $country: Germany
```

### 9.2 Análisis Geográfico - Comparar Precios por País

```sql
-- QUERY 2: Comparar precios del MISMO carro en diferentes países
-- USO: "Este Ferrari cuesta 30% menos en UK que en Alemania"

WITH price_by_country AS (
    SELECT 
        l.year,
        l.make,
        l.model,
        ld.country,
        COUNT(*) as listing_count,
        ROUND(AVG(l.price_usd), 2) as avg_price_usd,
        ROUND(AVG(l.price_eur), 2) as avg_price_eur,
        ROUND(STDDEV(l.price_usd), 2) as stddev_price,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY l.price_usd), 2) as median_price,
        MIN(l.price_usd) as min_price,
        MAX(l.price_usd) as max_price,
        ROUND(AVG(l.mileage), 0) as avg_mileage,
        ROUND(AVG(COALESCE(pd.originality_score, 50)), 0) as avg_originality
    FROM listings l
    LEFT JOIN location_data ld ON l.id = ld.listing_id
    LEFT JOIN provenance_data pd ON l.id = pd.listing_id
    WHERE 
        l.year BETWEEN $year_start AND $year_end
        AND l.make = $make
        AND l.model = $model
        AND l.status = 'sold'
        AND l.sale_date >= NOW() - INTERVAL '12 months'
        AND ld.country IN ('USA', 'UK', 'Germany', 'France', 'Italy')
    GROUP BY l.year, l.make, l.model, ld.country
),
with_index AS (
    SELECT 
        *,
        ROUND((avg_price_usd / (SELECT avg_price_usd FROM price_by_country WHERE country = 'USA') * 100), 1) as price_index_vs_usa,
        ROUND((avg_price_usd / (SELECT avg_price_usd FROM price_by_country WHERE country = 'UK') * 100), 1) as price_index_vs_uk
    FROM price_by_country
)
SELECT 
    year,
    make,
    model,
    country,
    listing_count,
    avg_price_usd,
    avg_price_eur,
    price_index_vs_usa,
    price_index_vs_uk,
    min_price,
    max_price,
    stddev_price,
    avg_mileage,
    avg_originality
FROM with_index
ORDER BY year DESC, country;

-- PARÁMETROS:
-- $year_start: 2000
-- $year_end: 2005
-- $make: Porsche
-- $model: 911
```

### 9.3 Detección de Oportunidades - Undervalued Cars

```sql
-- QUERY 3: Carros vendidos por MENOS de Fair Value
-- USO: Identificar buenas oportunidades de compra

WITH fair_value_benchmark AS (
    -- Calcular Fair Value para cada modelo
    SELECT 
        year,
        make,
        model,
        country,
        ROUND(AVG(price_usd), 2) as fair_value,
        ROUND(STDDEV(price_usd), 2) as price_std_dev
    FROM listings l
    LEFT JOIN location_data ld ON l.id = ld.listing_id
    WHERE 
        status = 'sold'
        AND sale_date >= NOW() - INTERVAL '12 months'
    GROUP BY year, make, model, country
),
recent_sales AS (
    SELECT 
        l.*,
        ld.country,
        pd.originality_score,
        pd.restoration_type,
        fv.fair_value,
        fv.price_std_dev,
        l.price_usd - fv.fair_value as price_diff,
        ROUND(((l.price_usd - fv.fair_value) / fv.fair_value * 100), 2) as price_discount_percent,
        ROW_NUMBER() OVER (PARTITION BY l.year, l.make, l.model ORDER BY l.sale_date DESC) as sale_recency
    FROM listings l
    LEFT JOIN location_data ld ON l.id = ld.listing_id
    LEFT JOIN provenance_data pd ON l.id = pd.listing_id
    LEFT JOIN fair_value_benchmark fv ON 
        l.year = fv.year 
        AND l.make = fv.make 
        AND l.model = fv.model 
        AND ld.country = fv.country
    WHERE l.status = 'sold'
    AND l.sale_date >= NOW() - INTERVAL '3 months'
    AND l.data_quality_score >= 80
)
SELECT 
    year,
    make,
    model,
    source,
    price_usd,
    fair_value,
    price_discount_percent,
    country,
    mileage,
    originality_score,
    restoration_type,
    sale_date,
    source_url
FROM recent_sales
WHERE 
    price_discount_percent < -15  -- Sold for 15%+ below fair value
    AND sale_recency = 1  -- Most recent sale for that model
    AND fair_value IS NOT NULL
ORDER BY price_discount_percent ASC
LIMIT 50;
```

### 9.4 Tendencias de Mercado - Appreciation/Depreciation

```sql
-- QUERY 4: Qué carros se aprecian vs deprecian
-- USO: Análisis de inversión

WITH sales_history AS (
    SELECT 
        vh.listing_id,
        l.year,
        l.make,
        l.model,
        vh.previous_sale_date,
        l.sale_date as current_sale_date,
        vh.previous_price,
        l.price_usd as current_price,
        vh.appreciation_depreciation_percent,
        vh.annualized_appreciation,
        DATEDIFF(DAY, vh.previous_sale_date, l.sale_date) as days_held
    FROM vehicle_history vh
    JOIN listings l ON vh.listing_id = l.id
    WHERE 
        vh.confidence_level IN ('high', 'medium')
        AND DATEDIFF(YEAR, vh.previous_sale_date, l.sale_date) >= 1  -- At least 1 year
        AND DATEDIFF(YEAR, vh.previous_sale_date, l.sale_date) <= 10  -- Max 10 years
)
SELECT 
    make,
    model,
    COUNT(*) as sample_size,
    ROUND(AVG(appreciation_depreciation_percent), 2) as avg_appreciation_percent,
    ROUND(AVG(annualized_appreciation), 2) as avg_annualized_percent,
    ROUND(MIN(appreciation_depreciation_percent), 2) as worst_case,
    ROUND(MAX(appreciation_depreciation_percent), 2) as best_case,
    ROUND(STDDEV(appreciation_depreciation_percent), 2) as volatility,
    ROUND(AVG(days_held / 365.0), 1) as avg_years_held
FROM sales_history
GROUP BY make, model
HAVING COUNT(*) >= 3  -- At least 3 samples
ORDER BY avg_annualized_percent DESC;
```

### 9.5 Quality Control - Red Flags Detection

```sql
-- QUERY 5: Carros con red flags detectados
-- USO: Identificar listings sospechosas para revisar

SELECT 
    l.id,
    l.year,
    l.make,
    l.model,
    l.source,
    l.source_url,
    l.price_usd,
    CASE 
        WHEN l.photos_count < 5 THEN 'Low photo count'
        WHEN l.hagerty_grade = 4 AND l.price_usd > 500000 THEN 'Low condition but high price'
        WHEN pd.accident_history IS NOT NULL THEN 'Accident history'
        WHEN pd.restoration_type = 'partial' AND pd.originality_score < 30 THEN 'Poor restoration'
        WHEN l.mileage > 300000 AND l.hagerty_grade IN (1, 2) THEN 'High mileage but excellent condition (suspicious)'
        WHEN l.condition_description LIKE '%repaint%' AND l.color_exterior LIKE '%original%' THEN 'Conflicting info'
        WHEN l.buyers_premium_percent > 15 THEN 'Unusually high premium'
        ELSE 'OK'
    END as red_flag,
    l.sale_date,
    l.data_quality_score
FROM listings l
LEFT JOIN provenance_data pd ON l.id = pd.listing_id
WHERE 
    l.status = 'sold'
    AND l.sale_date >= NOW() - INTERVAL '30 days'
    AND l.hagerty_grade IS NOT NULL
ORDER BY l.sale_date DESC;
```

---

## 10. IMPLEMENTACIÓN PASO A PASO

### 10.1 Fase 1: Infraestructura Base (Semanas 1-2)

#### Setup de Database

```bash
# 1. Instalar PostgreSQL + TimescaleDB
sudo apt-get update
sudo apt-get install postgresql-14 postgresql-14-timescaledb

# 2. Crear database
createdb monza_luxury_cars

# 3. Crear extension TimescaleDB
psql -d monza_luxury_cars -c "CREATE EXTENSION timescaledb;"

# 4. Crear usuario con permisos limitados
psql -d monza_luxury_cars <<EOF
CREATE USER monza_app WITH PASSWORD 'SECURE_PASSWORD_HERE';
GRANT CONNECT ON DATABASE monza_luxury_cars TO monza_app;
GRANT USAGE ON SCHEMA public TO monza_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO monza_app;
EOF

# 5. Ejecutar DDL (schema creation)
psql -d monza_luxury_cars -U postgres -f schema.sql
```

#### Instalación de Dependencias

```bash
# Node.js dependencies
npm install \
    puppeteer \
    pg \
    redis \
    axios \
    dotenv \
    morgan \
    express \
    joi \
    moment \
    lodash

# Python dependencies (para analysis)
pip install --break-system-packages \
    psycopg2-binary \
    pandas \
    numpy \
    scikit-learn \
    matplotlib \
    seaborn
```

### 10.2 Fase 2: Scrappers Tier 1 (Semanas 3-4)

#### Bring a Trailer Scraper Skeleton

```javascript
// File: scrapers/bringatrailer.js

const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const redis = require('redis');

class BringATrailerScraper {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        this.redis = redis.createClient();
        this.baseUrl = 'https://bringatrailer.com';
    }

    async scrapeAuctions() {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(`${this.baseUrl}/auctions`);
            
            // Esperar a que cargue contenido dinámico
            await page.waitForSelector('[data-listing]');
            
            const listings = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[data-listing]'))
                    .map(el => ({
                        id: el.dataset.listingId,
                        title: el.querySelector('.title')?.textContent,
                        year: parseInt(el.querySelector('[data-year]')?.textContent),
                        make: el.querySelector('[data-make]')?.textContent,
                        model: el.querySelector('[data-model]')?.textContent,
                        price: parseInt(el.querySelector('.price')?.textContent?.replace(/\D/g, '')),
                        mileage: parseInt(el.querySelector('[data-mileage]')?.textContent?.replace(/\D/g, '')),
                        imageUrl: el.querySelector('img')?.src,
                        url: el.querySelector('a')?.href
                    }));
            });

            // Insertar en database
            for (const listing of listings) {
                await this.insertListing(listing, 'BaT');
            }

            console.log(`✅ Scraped ${listings.length} listings from BaT`);
        } finally {
            await browser.close();
        }
    }

    async insertListing(data, source) {
        const query = `
            INSERT INTO listings (
                source, source_id, source_url, year, make, model,
                mileage, mileage_unit, price_usd, original_currency,
                status, created_at, scrape_timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
            )
            ON CONFLICT (source, source_id) DO UPDATE SET
                updated_at = NOW()
        `;

        await this.pool.query(query, [
            source,
            data.id,
            data.url,
            data.year,
            data.make,
            data.model,
            data.mileage,
            'miles',
            data.price,
            'USD',
            'active'
        ]);
    }
}

module.exports = BringATrailerScraper;
```

### 10.3 Fase 3: Fair Value Calculator (Semana 5)

```javascript
// File: analysis/fairValueCalculator.js

class FairValueCalculator {
    constructor(pool) {
        this.pool = pool;
    }

    async calculateFairValue(year, make, model, country) {
        const query = `
            WITH similar_cars AS (
                SELECT 
                    l.id, l.price_usd, l.mileage, l.hagerty_grade,
                    pd.originality_score, pd.restoration_type,
                    ROW_NUMBER() OVER (ORDER BY l.sale_date DESC) as rn
                FROM listings l
                LEFT JOIN provenance_data pd ON l.id = pd.listing_id
                LEFT JOIN location_data ld ON l.id = ld.listing_id
                WHERE 
                    l.year = $1 AND l.make = $2 AND l.model = $3
                    AND ld.country = $4
                    AND l.status = 'sold'
                    AND l.sale_date >= NOW() - INTERVAL '12 months'
                LIMIT 20
            ),
            outliers_removed AS (
                SELECT * FROM (
                    SELECT *,
                        ROW_NUMBER() OVER (ORDER BY price_usd ASC) as rank_asc,
                        ROW_NUMBER() OVER (ORDER BY price_usd DESC) as rank_desc
                    FROM similar_cars
                ) WHERE rank_asc > 2 AND rank_desc > 2
            )
            SELECT 
                COUNT(*) as sample_size,
                ROUND(AVG(price_usd), 0) as fair_value,
                ROUND(STDDEV(price_usd), 0) as std_dev,
                ROUND(AVG(price_usd) - STDDEV(price_usd), 0) as low_range,
                ROUND(AVG(price_usd) + STDDEV(price_usd), 0) as high_range
            FROM outliers_removed
        `;

        const result = await this.pool.query(query, [year, make, model, country]);
        return result.rows[0];
    }
}

module.exports = FairValueCalculator;
```

### 10.4 Monitoreo y Alertas (Semana 6)

```javascript
// File: monitoring/alerts.js

class AlertSystem {
    constructor(pool, redis) {
        this.pool = pool;
        this.redis = redis;
    }

    async checkAnomalies() {
        // Alert 1: Carros vendidos por <15% Fair Value
        const undervalued = await this.pool.query(`
            SELECT l.id, l.make, l.model, l.price_usd
            FROM listings l
            WHERE l.sale_date = CURRENT_DATE
            AND l.price_usd < (
                SELECT AVG(price_usd) * 0.85
                FROM listings
                WHERE make = l.make AND model = l.model
                AND sale_date >= NOW() - INTERVAL '6 months'
            )
        `);

        if (undervalued.rows.length > 0) {
            await this.redis.lpush(
                'alerts:undervalued',
                JSON.stringify(undervalued.rows)
            );
        }

        // Alert 2: Actividad inusual en mercado
        // ... (implementación similar)
    }
}

module.exports = AlertSystem;
```

---

## RESUMEN DE IMPLEMENTACIÓN

### Timeline Completo

```
SEMANA 1: Setup Database + Infraestructura
├─ PostgreSQL + TimescaleDB setup
├─ Schema creation (DDL)
├─ Redis cache setup
└─ CI/CD pipeline básico

SEMANA 2: Primeros Scrappers
├─ Bring a Trailer scraper (funcional)
├─ Collecting Cars scraper (funcional)
├─ Data validation y deduplicación
└─ 100-150 carros/día en database

SEMANA 3: Base de Datos Robusta
├─ Índices y optimización
├─ Partición de datos
├─ Backup y recovery
└─ Data quality checks

SEMANA 4: Fair Value Calculator
├─ Algorithm implementado
├─ Validación contra Alejandro
├─ API endpoints
└─ Testing completo

SEMANA 5: Subastas Live
├─ RM Sotheby's parser
├─ Bonhams parser
├─ Event detection + alertas
└─ Historical data import

SEMANA 6-8: Polish y Production
├─ Dashboard UI
├─ Performance optimization
├─ Error handling robusto
├─ Monitoring y logging
└─ Ready for production

SEMANA 9+: Expansión
├─ Regional scrappers adicionales
├─ Machine learning features
├─ Advanced analytics
└─ Auto-alerting system
```

### Entregables Finales

```
✅ Base de datos completa (20,000+ carros)
✅ Scrappers activos (100-150/día)
✅ Fair Value Calculator funcional
✅ APIs para consultas
✅ Dashboard de análisis
✅ System de alertas
✅ Documentación técnica
✅ Runbooks de operación
```

---

## CONCLUSIÓN

Esta estructura de base de datos está diseñada para:

1. **Soportar TODOS los carros de lujo** (100K€ a ilimitado)
2. **Separación geográfica clara** (UK vs Alemania vs USA, etc)
3. **Histórico completo** (precios, condición, ventas anteriores)
4. **Fair Value Range calculation** (como Alejandro necesita)
5. **Análisis de inversión** (appreciation, red flags, oportunidades)
6. **Escalabilidad** (de 10K a 1M+ carros)
7. **Precisión de datos** (validación automática, deduplicación)
8. **Performance** (índices, particiones, TimescaleDB)

**Ahora Camilo tiene todo lo que necesita para construir el sistema.** ✅
