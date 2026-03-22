// src/lib/brandVariants.ts
import type { VariantConfig } from "./brandConfig"

// ── 992 ──
export const PORSCHE_992_VARIANTS: VariantConfig[] = [
  // Existing variants (preserved)
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs", "gt3rs"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "sport-classic", label: "Sport Classic", keywords: ["sport classic"] },
  { id: "st", label: "S/T", keywords: ["s/t"] },
  { id: "dakar", label: "Dakar", keywords: ["dakar"] },
  // New Elferspot variants
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-t", label: "Carrera T", keywords: ["carrera t"] },
  { id: "carrera-4-gts", label: "Carrera 4 GTS", keywords: ["carrera 4 gts"] },
  { id: "gt3-touring", label: "GT3 Touring", keywords: ["gt3 touring"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-r-rennsport", label: "GT3 R Rennsport", keywords: ["gt3 r rennsport", "rennsport"] },
  { id: "turbo-50-jahre", label: "Turbo 50 Jahre", keywords: ["turbo 50 jahre", "turbo 50"] },
  { id: "heritage-design", label: "Heritage Design Edition", keywords: ["heritage design"] },
  { id: "edition-50-jahre", label: "Edition 50 Jahre Porsche Design", keywords: ["50 jahre porsche design"] },
  { id: "belgian-legend", label: "Belgian Legend Edition", keywords: ["belgian legend"] },
  { id: "sally-special", label: "Sally Special", keywords: ["sally special"] },
  { id: "spirit-70", label: "Spirit 70", keywords: ["spirit 70"] },
  // 992.2 sub-generation
  { id: "992.2-carrera", label: "992.2 Carrera", keywords: ["992.2 carrera"] },
  { id: "992.2-carrera-s", label: "992.2 Carrera S", keywords: ["992.2 carrera s"] },
  { id: "992.2-carrera-4s", label: "992.2 Carrera 4S", keywords: ["992.2 carrera 4s"] },
  { id: "992.2-carrera-t", label: "992.2 Carrera T", keywords: ["992.2 carrera t"] },
  { id: "992.2-carrera-gts", label: "992.2 Carrera GTS", keywords: ["992.2 carrera gts"] },
  { id: "992.2-carrera-4-gts", label: "992.2 Carrera 4 GTS", keywords: ["992.2 carrera 4 gts"] },
  { id: "992.2-gt3", label: "992.2 GT3", keywords: ["992.2 gt3"] },
  { id: "992.2-gt3-touring", label: "992.2 GT3 Touring", keywords: ["992.2 gt3 touring"] },
  { id: "992.2-turbo-s", label: "992.2 Turbo S", keywords: ["992.2 turbo s"] },
  { id: "992.2-cuarenta", label: "992.2 Carrera GTS Cuarenta Edition", keywords: ["cuarenta"] },
]

// ── 991 ──
export const PORSCHE_991_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "carrera-4-gts", label: "Carrera 4 GTS", keywords: ["carrera 4 gts"] },
  { id: "carrera-t", label: "Carrera T", keywords: ["carrera t"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-touring", label: "GT3 Touring", keywords: ["gt3 touring"] },
  { id: "gt2-rs", label: "GT2 RS", keywords: ["gt2 rs"] },
  { id: "gt2-rs-clubsport", label: "GT2 RS Clubsport", keywords: ["gt2 rs clubsport"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "911-r", label: "911 R", keywords: ["911 r", "911r"] },
  { id: "carrera-s-50-jahre", label: "Carrera S 50 Jahre", keywords: ["50 jahre"] },
  { id: "club-coupe", label: "Club Coupe", keywords: ["club coupé", "club coupe"] },
  { id: "turbo-s-exclusive", label: "Turbo S Exclusive Series", keywords: ["exclusive series"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
  { id: "martini-racing", label: "Martini Racing Edition", keywords: ["martini racing"] },
  // 991.2 sub-generation
  { id: "991.2-carrera", label: "991.2 Carrera", keywords: ["991.2 carrera"] },
  { id: "991.2-carrera-s", label: "991.2 Carrera S", keywords: ["991.2 carrera s"] },
  { id: "991.2-carrera-4", label: "991.2 Carrera 4", keywords: ["991.2 carrera 4"] },
  { id: "991.2-carrera-4s", label: "991.2 Carrera 4S", keywords: ["991.2 carrera 4s"] },
  { id: "991.2-carrera-gts", label: "991.2 Carrera GTS", keywords: ["991.2 carrera gts"] },
  { id: "991.2-carrera-4-gts", label: "991.2 Carrera 4 GTS", keywords: ["991.2 carrera 4 gts"] },
  { id: "991.2-carrera-t", label: "991.2 Carrera T", keywords: ["991.2 carrera t"] },
  { id: "991.2-gt3", label: "991.2 GT3", keywords: ["991.2 gt3"] },
  { id: "991.2-gt3-rs", label: "991.2 GT3 RS", keywords: ["991.2 gt3 rs"] },
  { id: "991.2-turbo", label: "991.2 Turbo", keywords: ["991.2 turbo"] },
  { id: "991.2-turbo-s", label: "991.2 Turbo S", keywords: ["991.2 turbo s"] },
]

// ── 997 ──
export const PORSCHE_997_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-rs", label: "GT2 RS", keywords: ["gt2 rs"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-rs-4.0", label: "GT3 RS 4.0", keywords: ["gt3 rs 4.0", "rs 4.0"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-cup-s", label: "GT3 Cup S", keywords: ["gt3 cup s"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "sport-classic", label: "Sport Classic", keywords: ["sport classic"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  // 997.2 sub-generation
  { id: "997.2-carrera", label: "997.2 Carrera", keywords: ["997.2 carrera"] },
  { id: "997.2-carrera-s", label: "997.2 Carrera S", keywords: ["997.2 carrera s"] },
  { id: "997.2-carrera-4", label: "997.2 Carrera 4", keywords: ["997.2 carrera 4"] },
  { id: "997.2-carrera-4s", label: "997.2 Carrera 4S", keywords: ["997.2 carrera 4s"] },
  { id: "997.2-carrera-gts", label: "997.2 Carrera GTS", keywords: ["997.2 carrera gts"] },
  { id: "997.2-carrera-4-gts", label: "997.2 Carrera 4 GTS", keywords: ["997.2 carrera 4 gts"] },
  { id: "997.2-carrera-black", label: "997.2 Carrera Black Edition", keywords: ["997.2 carrera black", "997.2 black edition"] },
  { id: "997.2-turbo", label: "997.2 Turbo", keywords: ["997.2 turbo"] },
  { id: "997.2-turbo-s", label: "997.2 Turbo S", keywords: ["997.2 turbo s"] },
  { id: "997.2-gt3", label: "997.2 GT3", keywords: ["997.2 gt3"] },
  { id: "997.2-gt3-rs", label: "997.2 GT3 RS", keywords: ["997.2 gt3 rs"] },
  { id: "997.2-gt3-r", label: "997.2 GT3 R", keywords: ["997.2 gt3 r"] },
  { id: "997.2-gt3-rsr", label: "997.2 GT3 RSR", keywords: ["997.2 gt3 rsr"] },
  { id: "997.2-gt3-cup", label: "997.2 GT3 Cup", keywords: ["997.2 gt3 cup"] },
]

// ── 996 ──
export const PORSCHE_996_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-4s", label: "Carrera 4S", keywords: ["carrera 4s"] },
  { id: "carrera-r", label: "Carrera R", keywords: ["carrera r"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-clubsport", label: "GT2 Clubsport", keywords: ["gt2 clubsport"] },
  { id: "gt2-r", label: "GT2 R", keywords: ["gt2 r"] },
  { id: "gt3", label: "GT3", keywords: ["gt3"] },
  { id: "gt3-clubsport", label: "GT3 Clubsport", keywords: ["gt3 clubsport"] },
  { id: "gt3-cup", label: "GT3 Cup", keywords: ["gt3 cup"] },
  { id: "gt3-r", label: "GT3 R", keywords: ["gt3 r"] },
  { id: "gt3-rs", label: "GT3 RS", keywords: ["gt3 rs"] },
  { id: "gt3-rsr", label: "GT3 RSR", keywords: ["gt3 rsr"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "40-jahre", label: "40 Jahre 911", keywords: ["40 jahre"] },
  { id: "millennium", label: "Millennium Edition", keywords: ["millennium"] },
  // 996.2 sub-generation
  { id: "996.2-carrera", label: "996.2 Carrera", keywords: ["996.2 carrera"] },
  { id: "996.2-carrera-4", label: "996.2 Carrera 4", keywords: ["996.2 carrera 4"] },
  { id: "996.2-gt3", label: "996.2 GT3", keywords: ["996.2 gt3"] },
  { id: "996.2-gt3-clubsport", label: "996.2 GT3 Clubsport", keywords: ["996.2 gt3 clubsport"] },
]

// ── 993 ──
export const PORSCHE_993_VARIANTS: VariantConfig[] = [
  { id: "carrera", label: "Carrera", keywords: ["carrera"] },
  { id: "carrera-s", label: "Carrera S", keywords: ["carrera s"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "carrera-3.8", label: "Carrera 3.8", keywords: ["carrera 3.8"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-cabrio", label: "Turbo Cabrio", keywords: ["turbo cabrio", "turbo cabriolet"] },
  { id: "turbo-wls-1", label: "Turbo WLS 1", keywords: ["turbo wls 1", "wls 1"] },
  { id: "turbo-wls-2", label: "Turbo WLS 2", keywords: ["turbo wls 2", "wls 2"] },
  { id: "gt2", label: "GT2", keywords: ["gt2"] },
  { id: "gt2-evo", label: "GT2 Evo", keywords: ["gt2 evo"] },
  { id: "cup-3.8", label: "3.8 Cup", keywords: ["3.8 cup", "cup 3.8"] },
  { id: "cup-3.8-rsr", label: "Cup 3.8 RSR", keywords: ["cup 3.8 rsr"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "rs", label: "RS", keywords: [" rs"] },
]

// ── 964 ──
export const PORSCHE_964_VARIANTS: VariantConfig[] = [
  { id: "carrera-2", label: "Carrera 2", keywords: ["carrera 2"] },
  { id: "carrera-4", label: "Carrera 4", keywords: ["carrera 4"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "carrera-rs-3.8", label: "Carrera RS 3.8", keywords: ["rs 3.8", "carrera rs 3.8"] },
  { id: "rs-america", label: "RS America", keywords: ["rs america"] },
  { id: "rs-n-gt", label: "Carrera RS N/GT", keywords: ["rs n/gt"] },
  { id: "rsr-3.8", label: "Carrera RSR 3.8", keywords: ["rsr 3.8"] },
  { id: "america-roadster", label: "America Roadster", keywords: ["america roadster"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-3.6", label: "Turbo 3.6", keywords: ["turbo 3.6"] },
  { id: "turbo-flachbau", label: "Turbo Flachbau", keywords: ["flachbau", "flatnose", "slantnose"] },
  { id: "turbo-s-leichtbau", label: "Turbo S Leichtbau", keywords: ["leichtbau"] },
  { id: "turbo-s2", label: "Turbo S2", keywords: ["turbo s2"] },
  { id: "turbo-wls", label: "Turbo WLS", keywords: ["turbo wls"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "cup", label: "Cup", keywords: [" cup"] },
  { id: "targa", label: "Targa", keywords: ["targa"] },
  { id: "jubilaeums", label: "Jubiläumsmodell 30 Jahre 911", keywords: ["jubiläum", "jubilae", "30 jahre"] },
  { id: "carrera-4-lightweight", label: "Carrera 4 Lightweight", keywords: ["lightweight"] },
]

// ── 930 (first variants ever for this series!) ──
export const PORSCHE_930_VARIANTS: VariantConfig[] = [
  { id: "turbo-3.0", label: "Turbo 3.0", keywords: ["turbo 3.0"] },
  { id: "turbo-3.3", label: "Turbo 3.3", keywords: ["turbo 3.3"] },
  { id: "turbo-3.3-wls", label: "Turbo 3.3 WLS", keywords: ["turbo 3.3 wls", "wls"] },
  { id: "turbo-5-gang", label: "Turbo 5 Gang", keywords: ["5 gang", "5-speed", "5 speed"] },
  { id: "turbo-flachbau", label: "Turbo Flachbau", keywords: ["flachbau", "flatnose", "slantnose"] },
  { id: "turbo-s-3.3", label: "Turbo S 3.3", keywords: ["turbo s 3.3"] },
  { id: "934", label: "934", keywords: ["934"] },
]

// ── G-Model (first variants ever!) ──
export const PORSCHE_GMODEL_VARIANTS: VariantConfig[] = [
  { id: "carrera-2.7", label: "Carrera 2.7", keywords: ["carrera 2.7"] },
  { id: "carrera-rs-3.0", label: "Carrera RS 3.0", keywords: ["carrera rs 3.0", "rs 3.0"] },
  { id: "carrera-rsr-3.0", label: "Carrera RSR 3.0", keywords: ["rsr 3.0"] },
  { id: "carrera-3.0", label: "Carrera 3.0", keywords: ["carrera 3.0"] },
  { id: "sc", label: "SC", keywords: ["911 sc", " sc "] },
  { id: "sc-3.1", label: "SC 3.1", keywords: ["sc 3.1"] },
  { id: "sc-rs", label: "SC/RS", keywords: ["sc/rs"] },
  { id: "carrera-3.2", label: "Carrera 3.2", keywords: ["carrera 3.2"] },
  { id: "carrera-3.2-clubsport", label: "Carrera 3.2 Clubsport", keywords: ["3.2 clubsport", "3.2 club sport"] },
  { id: "carrera-3.2-speedster", label: "Carrera 3.2 Speedster", keywords: ["3.2 speedster"] },
  { id: "carrera-3.2-supersport", label: "Carrera 3.2 Supersport", keywords: ["3.2 supersport"] },
  { id: "carrera-3.2-wtl", label: "Carrera 3.2 WTL", keywords: ["3.2 wtl"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
]

// ── F-Model (first variants ever!) ──
export const PORSCHE_FMODEL_VARIANTS: VariantConfig[] = [
  { id: "901", label: "901", keywords: ["901"] },
  { id: "911-base", label: "911", keywords: ["911"] },
  { id: "911-l", label: "911 L", keywords: ["911 l", "911l"] },
  { id: "911-t", label: "911 T", keywords: ["911 t", "911t"] },
  { id: "911-s", label: "911 S", keywords: ["911 s", "911s"] },
  { id: "911-e", label: "911 E", keywords: ["911 e", "911e"] },
  { id: "911-r", label: "911 R", keywords: ["911 r", "911r"] },
  { id: "911-st", label: "911 ST", keywords: ["911 st"] },
  { id: "911-tr", label: "911 T/R", keywords: ["911 t/r"] },
  { id: "carrera-rs", label: "Carrera RS", keywords: ["carrera rs"] },
  { id: "carrera-2.8-rsr", label: "Carrera 2.8 RSR", keywords: ["2.8 rsr"] },
]

// ── 912 ──
export const PORSCHE_912_VARIANTS: VariantConfig[] = [
  { id: "912", label: "912", keywords: ["912"] },
  { id: "912-e", label: "912 E", keywords: ["912 e", "912e"] },
]

// ── 718 / 982 ──
export const PORSCHE_718_CAYMAN_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Base", keywords: ["cayman"] },
  { id: "s", label: "S", keywords: ["cayman s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "gts-4.0", label: "GTS 4.0", keywords: ["gts 4.0"] },
  { id: "t", label: "T", keywords: ["cayman t"] },
  { id: "gt4", label: "GT4", keywords: ["gt4"] },
  { id: "gt4-rs", label: "GT4 RS", keywords: ["gt4 rs"] },
  { id: "gt4-clubsport", label: "GT4 Clubsport", keywords: ["gt4 clubsport"] },
  { id: "gt4-rs-clubsport", label: "GT4 RS Clubsport", keywords: ["gt4 rs clubsport"] },
]

export const PORSCHE_718_BOXSTER_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Base", keywords: ["boxster"] },
  { id: "s", label: "S", keywords: ["boxster s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "gts-4.0", label: "GTS 4.0", keywords: ["gts 4.0"] },
  { id: "t", label: "T", keywords: ["boxster t"] },
  { id: "spyder", label: "Spyder", keywords: ["spyder"] },
  { id: "spyder-rs", label: "Spyder RS", keywords: ["spyder rs"] },
  { id: "25-years", label: "25 Years", keywords: ["25 years", "25 jahre"] },
]

// ── Cayman (pre-718: covers 981 + 987 generations) ──
// Maps to series id "cayman" in brandConfig.ts
export const PORSCHE_CAYMAN_VARIANTS: VariantConfig[] = [
  { id: "cayman", label: "Cayman", keywords: ["cayman"] },
  { id: "cayman-s", label: "Cayman S", keywords: ["cayman s"] },
  { id: "cayman-gts", label: "Cayman GTS", keywords: ["cayman gts"] },
  { id: "cayman-gt4", label: "Cayman GT4", keywords: ["cayman gt4", "gt4"] },
  { id: "cayman-gt4-clubsport", label: "Cayman GT4 Clubsport", keywords: ["gt4 clubsport"] },
  { id: "cayman-r", label: "Cayman R", keywords: ["cayman r"] },
  { id: "cayman-cup", label: "Cayman Cup", keywords: ["cayman cup"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
]

// ── Boxster (pre-718: covers 986 + 987 + 981 generations) ──
// Maps to series id "boxster" in brandConfig.ts
export const PORSCHE_BOXSTER_VARIANTS: VariantConfig[] = [
  { id: "boxster", label: "Boxster", keywords: ["boxster"] },
  { id: "boxster-s", label: "Boxster S", keywords: ["boxster s"] },
  { id: "boxster-gts", label: "Boxster GTS", keywords: ["boxster gts"] },
  { id: "boxster-spyder", label: "Boxster Spyder", keywords: ["boxster spyder", "spyder"] },
  { id: "boxster-rs60", label: "Boxster RS 60 Spyder", keywords: ["rs 60"] },
  { id: "black-edition", label: "Black Edition", keywords: ["black edition"] },
]

// ── 914 ──
export const PORSCHE_914_VARIANTS: VariantConfig[] = [
  { id: "914-1.7", label: "914 1.7", keywords: ["1.7"] },
  { id: "914-1.8", label: "914 1.8", keywords: ["1.8"] },
  { id: "914-2.0", label: "914 2.0", keywords: ["2.0"] },
  { id: "914-6", label: "914/6", keywords: ["914/6"] },
  { id: "914-6-gt", label: "914/6 GT", keywords: ["914/6 gt"] },
  { id: "916", label: "916", keywords: ["916"] },
]

// ── Transaxle Classics ──
export const PORSCHE_944_VARIANTS: VariantConfig[] = [
  { id: "coupe", label: "Coupé", keywords: ["coupé", "coupe"] },
  { id: "s-coupe", label: "S Coupé", keywords: ["944 s coupe", "944 s coupé"] },
  { id: "s2-coupe", label: "S2 Coupé", keywords: ["s2 coupe", "s2 coupé"] },
  { id: "s2-cabrio", label: "S2 Cabriolet", keywords: ["s2 cabriolet", "s2 cabrio"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-cup", label: "Turbo Cup", keywords: ["turbo cup"] },
]

export const PORSCHE_928_VARIANTS: VariantConfig[] = [
  { id: "base", label: "928", keywords: ["928"] },
  { id: "s", label: "S", keywords: ["928 s"] },
  { id: "s4", label: "S4", keywords: ["s4"] },
  { id: "s4-clubsport", label: "S4 Clubsport", keywords: ["s4 clubsport"] },
  { id: "gt", label: "GT", keywords: ["928 gt"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
]

export const PORSCHE_968_VARIANTS: VariantConfig[] = [
  { id: "base", label: "968", keywords: ["968"] },
  { id: "club-sport", label: "Club Sport", keywords: ["club sport", "clubsport"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-rs", label: "Turbo RS", keywords: ["turbo rs"] },
]

export const PORSCHE_924_VARIANTS: VariantConfig[] = [
  { id: "base", label: "924", keywords: ["924"] },
  { id: "s", label: "S", keywords: ["924 s"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "carrera-gt", label: "Carrera GT", keywords: ["carrera gt"] },
  { id: "carrera-gts", label: "Carrera GTS", keywords: ["carrera gts"] },
  { id: "carrera-gtp", label: "Carrera GTP", keywords: ["carrera gtp"] },
  { id: "carrera-gtr", label: "Carrera GTR", keywords: ["carrera gtr"] },
]

// ── Heritage ──
export const PORSCHE_356_VARIANTS: VariantConfig[] = [
  { id: "pre-a", label: "Pre-A", keywords: ["pre-a", "pre a"] },
  { id: "a-1300", label: "A 1300", keywords: ["a 1300"] },
  { id: "a-1300-super", label: "A 1300 Super", keywords: ["a 1300 super"] },
  { id: "a-1500-gs-carrera", label: "A 1500 GS Carrera", keywords: ["a 1500 gs carrera"] },
  { id: "a-1600", label: "A 1600", keywords: ["a 1600"] },
  { id: "a-1600-super", label: "A 1600 Super", keywords: ["a 1600 super"] },
  { id: "a-1600-speedster", label: "A 1600 Speedster", keywords: ["a 1600 speedster"] },
  { id: "b-1600", label: "B 1600", keywords: ["b 1600"] },
  { id: "b-1600-super", label: "B 1600 Super", keywords: ["b 1600 super"] },
  { id: "b-1600-super-90", label: "B 1600 Super 90", keywords: ["b 1600 super 90"] },
  { id: "b-2000-gs-carrera", label: "B 2000 GS Carrera", keywords: ["b 2000 gs"] },
  { id: "c", label: "C", keywords: ["356 c"] },
  { id: "sc", label: "SC", keywords: ["356 sc"] },
  { id: "speedster", label: "Speedster", keywords: ["speedster"] },
  { id: "convertible-d", label: "Convertible D", keywords: ["convertible d"] },
  { id: "america-roadster", label: "America Roadster", keywords: ["america roadster"] },
]

// ── GT & Hypercars ──
export const PORSCHE_918_VARIANTS: VariantConfig[] = [
  { id: "spyder", label: "918 Spyder", keywords: ["spyder", "918"] },
]

export const PORSCHE_CARRERA_GT_VARIANTS: VariantConfig[] = [
  { id: "carrera-gt", label: "Carrera GT", keywords: ["carrera gt"] },
  { id: "carrera-gt-r", label: "Carrera GT-R", keywords: ["carrera gt-r", "gt-r"] },
]

export const PORSCHE_959_VARIANTS: VariantConfig[] = [
  { id: "959", label: "959", keywords: ["959"] },
  { id: "959-s", label: "959 S", keywords: ["959 s"] },
  { id: "959-sport", label: "959 Sport", keywords: ["959 sport"] },
]

// ── SUV & Sedan ──
// Taycan expanded from Elferspot
export const PORSCHE_TAYCAN_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Taycan", keywords: ["taycan"] },
  { id: "4", label: "Taycan 4", keywords: ["taycan 4 "] },
  { id: "4s", label: "Taycan 4S", keywords: ["taycan 4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "turbo-gt", label: "Turbo GT", keywords: ["turbo gt"] },
  { id: "cross-turismo", label: "Cross Turismo", keywords: ["cross turismo"] },
  { id: "sport-turismo", label: "Sport Turismo", keywords: ["sport turismo"] },
]

// Panamera expanded from Elferspot
export const PORSCHE_PANAMERA_VARIANTS: VariantConfig[] = [
  { id: "base", label: "Panamera", keywords: ["panamera"] },
  { id: "4", label: "Panamera 4", keywords: ["panamera 4 "] },
  { id: "s", label: "S", keywords: ["panamera s"] },
  { id: "4s", label: "4S", keywords: ["4s"] },
  { id: "gts", label: "GTS", keywords: ["gts"] },
  { id: "turbo", label: "Turbo", keywords: ["turbo"] },
  { id: "turbo-s", label: "Turbo S", keywords: ["turbo s"] },
  { id: "e-hybrid", label: "E-Hybrid", keywords: ["e-hybrid", "hybrid"] },
  { id: "executive", label: "Executive", keywords: ["executive"] },
  { id: "sport-turismo", label: "Sport Turismo", keywords: ["sport turismo"] },
]
