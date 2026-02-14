// ═══════════════════════════════════════════════════════════════════════════
// MONZA INTELLIGENCE: INVESTMENT-GRADE VEHICLE DATABASE
// 100+ Authentic Collector Cars with Deep Financial Data
// ═══════════════════════════════════════════════════════════════════════════

export type InvestmentGrade = "AAA" | "AA" | "A" | "B+" | "B" | "C";
export type AuctionStatus = "ACTIVE" | "ENDING_SOON" | "ENDED";
export type Platform = "BRING_A_TRAILER" | "RM_SOTHEBYS" | "GOODING" | "BONHAMS" | "CARS_AND_BIDS" | "COLLECTING_CARS";

export interface CollectorCar {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number;
  trend: string;
  trendValue: number;
  investmentGrade: InvestmentGrade;
  thesis: string;
  image: string;
  images: string[];
  engine: string;
  transmission: string;
  mileage: number;
  mileageUnit: "mi" | "km";
  location: string;
  history: string;
  platform: Platform;
  status: AuctionStatus;
  currentBid: number;
  bidCount: number;
  endTime: Date;
  category: string;
}

// ─── BLUE CHIP CLASSICS (20%) ───
const blueChipModels = [
  { make: "Ferrari", model: "250 GTO", years: [1962, 1963, 1964], engine: "3.0L Colombo V12", price: [45000000, 70000000], grade: "AAA" as InvestmentGrade, thesis: "The holy grail of collecting. Only 36 ever made, each appreciating like fine art.", trim: "Series II" },
  { make: "Ferrari", model: "275 GTB/4", years: [1966, 1967, 1968], engine: "3.3L V12 DOHC", price: [2800000, 3800000], grade: "AAA" as InvestmentGrade, thesis: "The last of the front-engine V12 berlinettas. Museum-quality appreciation trajectory.", trim: "Alloy Body" },
  { make: "Mercedes-Benz", model: "300SL", years: [1954, 1955, 1956, 1957], engine: "3.0L I6 Fuel Injection", price: [1200000, 1800000], grade: "AAA" as InvestmentGrade, thesis: "First production fuel-injected car. Gullwing doors create unmatched curb appeal.", trim: "Gullwing" },
  { make: "Mercedes-Benz", model: "300SL Roadster", years: [1957, 1958, 1959, 1960, 1961, 1962, 1963], engine: "3.0L I6 Fuel Injection", price: [1000000, 1400000], grade: "AA" as InvestmentGrade, thesis: "More usable than the Gullwing with strong collector demand. Excellent investment vehicle.", trim: null },
  { make: "Aston Martin", model: "DB5", years: [1963, 1964, 1965], engine: "4.0L I6 Twin SU", price: [700000, 1100000], grade: "AA" as InvestmentGrade, thesis: "The James Bond effect creates permanent cultural cache. Blue chip collector cornerstone.", trim: "Vantage" },
  { make: "Aston Martin", model: "DB4 GT Zagato", years: [1960, 1961], engine: "3.7L I6 Twin Plug", price: [12000000, 18000000], grade: "AAA" as InvestmentGrade, thesis: "Ultra-rare coachbuilt masterpiece. Only 19 originals—museum tier.", trim: null },
  { make: "Ferrari", model: "250 GT SWB", years: [1959, 1960, 1961, 1962], engine: "3.0L Colombo V12", price: [7000000, 12000000], grade: "AAA" as InvestmentGrade, thesis: "Competition pedigree with road car usability. Peak golden-era Ferrari.", trim: "Berlinetta Competizione" },
  { make: "Jaguar", model: "E-Type", years: [1961, 1962, 1963, 1964, 1965, 1966, 1967], engine: "3.8L I6 DOHC", price: [150000, 350000], grade: "A" as InvestmentGrade, thesis: "Enzo called it the most beautiful car ever made. Series 1 commands premium.", trim: "Series 1 Roadster" },
  { make: "Porsche", model: "356 Speedster", years: [1954, 1955, 1956, 1957, 1958], engine: "1.6L Flat-4", price: [350000, 550000], grade: "AA" as InvestmentGrade, thesis: "The car that built Porsche's legend. California car culture icon.", trim: null },
  { make: "Ferrari", model: "365 GTB/4 Daytona", years: [1968, 1969, 1970, 1971, 1972, 1973], engine: "4.4L Colombo V12", price: [650000, 900000], grade: "A" as InvestmentGrade, thesis: "Last front-engine V12 Ferrari. Strong appreciation post-market correction.", trim: "Spider Conversion" },
];

// ─── MODERN SUPERCARS (30%) ───
const modernSupercars = [
  { make: "Porsche", model: "Carrera GT", years: [2004, 2005, 2006], engine: "5.7L V10 F1-derived", price: [1600000, 2200000], grade: "AAA" as InvestmentGrade, thesis: "The last analog supercar. Manual-only V10 makes it irreplaceable in the electric era.", trim: null },
  { make: "Ferrari", model: "Enzo", years: [2002, 2003, 2004], engine: "6.0L V12 F140", price: [2800000, 3500000], grade: "AAA" as InvestmentGrade, thesis: "Limited to 400 units. F1 technology in road car form. Collector cornerstone.", trim: null },
  { make: "McLaren", model: "F1", years: [1994, 1995, 1996, 1997, 1998], engine: "6.1L BMW S70 V12", price: [18000000, 28000000], grade: "AAA" as InvestmentGrade, thesis: "The greatest supercar ever built. Center-seat layout never replicated. Trophy asset.", trim: "LM Spec" },
  { make: "McLaren", model: "P1", years: [2013, 2014, 2015], engine: "3.8L Twin-Turbo V8 Hybrid", price: [1400000, 1900000], grade: "AA" as InvestmentGrade, thesis: "Hybrid hypercar pioneer. Part of the 'Holy Trinity' with 918 and LaFerrari.", trim: null },
  { make: "Ferrari", model: "LaFerrari", years: [2013, 2014, 2015, 2016], engine: "6.3L V12 + HY-KERS", price: [3200000, 4500000], grade: "AAA" as InvestmentGrade, thesis: "499 coupes produced. Ferrari's technological flagship. Allocation-only collector.", trim: null },
  { make: "Porsche", model: "918 Spyder", years: [2013, 2014, 2015], engine: "4.6L V8 + Dual Electric", price: [1600000, 2100000], grade: "AA" as InvestmentGrade, thesis: "918 units. Weissach Package commands 20% premium. Hybrid tech pioneer.", trim: "Weissach Package" },
  { make: "Ford", model: "GT", years: [2005, 2006], engine: "5.4L Supercharged V8", price: [380000, 550000], grade: "A" as InvestmentGrade, thesis: "Modern homage to Le Mans legend. American supercar renaissance leader.", trim: null },
  { make: "Ford", model: "GT", years: [2017, 2018, 2019, 2020], engine: "3.5L EcoBoost V6 Twin-Turbo", price: [900000, 1300000], grade: "AA" as InvestmentGrade, thesis: "Allocation-controlled. Carbon fiber monocoque. Strong secondary market.", trim: "Carbon Series" },
  { make: "Lamborghini", model: "Murciélago", years: [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010], engine: "6.5L V12", price: [280000, 450000], grade: "A" as InvestmentGrade, thesis: "Last hand-built Lamborghini V12. Manual transmission examples command premium.", trim: "LP640" },
  { make: "Lamborghini", model: "Aventador", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022], engine: "6.5L V12 700HP", price: [380000, 650000], grade: "A" as InvestmentGrade, thesis: "Final naturally-aspirated Lamborghini V12. SVJ commands significant premium.", trim: "SVJ" },
  { make: "Pagani", model: "Huayra", years: [2012, 2013, 2014, 2015, 2016, 2017, 2018], engine: "6.0L AMG Twin-Turbo V12", price: [2400000, 3800000], grade: "AAA" as InvestmentGrade, thesis: "100 coupes produced. Artisanal Italian hypercar with bespoke personalization.", trim: "BC Roadster" },
  { make: "Bugatti", model: "Veyron", years: [2005, 2006, 2007, 2008, 2009, 2010, 2011], engine: "8.0L W16 Quad-Turbo", price: [1600000, 2400000], grade: "AA" as InvestmentGrade, thesis: "Engineering marvel. 1,001HP when launched. Grand Sport commands premium.", trim: "Grand Sport" },
  { make: "Bugatti", model: "Chiron", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022], engine: "8.0L W16 1,500HP", price: [3000000, 4200000], grade: "AA" as InvestmentGrade, thesis: "Limited to 500 units. Pur Sport and Super Sport variants most collectible.", trim: "Pur Sport" },
  { make: "Koenigsegg", model: "Agera RS", years: [2015, 2016, 2017, 2018], engine: "5.0L Twin-Turbo V8 1,360HP", price: [5500000, 8000000], grade: "AAA" as InvestmentGrade, thesis: "25 units. Held production car speed record. Swedish hypercar apex.", trim: null },
  { make: "Aston Martin", model: "One-77", years: [2009, 2010, 2011, 2012], engine: "7.3L V12 750HP", price: [2000000, 2800000], grade: "AAA" as InvestmentGrade, thesis: "77 units. Hand-formed aluminum bodywork. Collector exclusivity guaranteed.", trim: null },
];

// ─── JDM LEGENDS (20%) ───
const jdmLegends = [
  { make: "Nissan", model: "Skyline GT-R", years: [1999, 2000, 2001, 2002], engine: "2.6L RB26DETT Twin-Turbo", price: [380000, 550000], grade: "AA" as InvestmentGrade, thesis: "V-Spec II Nür is the holy grail. 718 units with N1 engine. Peak JDM collecting.", trim: "V-Spec II Nür" },
  { make: "Nissan", model: "Skyline GT-R", years: [1995, 1996, 1997, 1998], engine: "2.6L RB26DETT", price: [120000, 200000], grade: "A" as InvestmentGrade, thesis: "R33 undervalued relative to R34. Strong track pedigree. Appreciating asset.", trim: "V-Spec" },
  { make: "Nissan", model: "Skyline GT-R", years: [1989, 1990, 1991, 1992, 1993, 1994], engine: "2.6L RB26DETT", price: [80000, 140000], grade: "A" as InvestmentGrade, thesis: "The car that started the legend. 25-year import rule opens US market.", trim: "V-Spec" },
  { make: "Toyota", model: "Supra", years: [1993, 1994, 1995, 1996, 1997, 1998], engine: "3.0L 2JZ-GTE Twin-Turbo", price: [150000, 220000], grade: "AA" as InvestmentGrade, thesis: "6-speed manual turbo is the collector's choice. Fast & Furious cultural icon.", trim: "Turbo 6-Speed" },
  { make: "Honda", model: "NSX", years: [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005], engine: "3.2L C32B V6 VTEC", price: [100000, 180000], grade: "A" as InvestmentGrade, thesis: "Senna's development input. NA1 with pop-ups most desirable. Daily-driver supercar.", trim: "Type R" },
  { make: "Honda", model: "NSX-R", years: [1992, 2002], engine: "3.2L V6 VTEC", price: [350000, 550000], grade: "AAA" as InvestmentGrade, thesis: "Lightweight homologation special. JDM-only. Championship White is collector spec.", trim: null },
  { make: "Lexus", model: "LFA", years: [2010, 2011, 2012], engine: "4.8L 1LR-GUE V10", price: [650000, 900000], grade: "AAA" as InvestmentGrade, thesis: "Yamaha-designed V10. Only 500 produced. Nürburgring Package is trophy spec.", trim: "Nürburgring Package" },
  { make: "Mazda", model: "RX-7", years: [1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002], engine: "1.3L 13B-REW Twin-Turbo Rotary", price: [50000, 95000], grade: "A" as InvestmentGrade, thesis: "Sequential twin-turbo rotary. Spirit R is final evolution. Lightweight legend.", trim: "Spirit R Type A" },
  { make: "Mitsubishi", model: "Lancer Evolution", years: [2001, 2002, 2003, 2004, 2005, 2006, 2007], engine: "2.0L 4G63T Turbo", price: [45000, 75000], grade: "B+" as InvestmentGrade, thesis: "Rally homologation hero. Evo VI TME and Evo IX MR most collectible.", trim: "IX MR" },
  { make: "Subaru", model: "Impreza WRX STI", years: [2004, 2005, 2006, 2007], engine: "2.5L EJ257 Turbo Boxer", price: [35000, 55000], grade: "B+" as InvestmentGrade, thesis: "Hawkeye generation. S204 and Spec C variants command premium.", trim: "S204" },
  { make: "Toyota", model: "2000GT", years: [1967, 1968, 1969, 1970], engine: "2.0L 3M I6 DOHC", price: [800000, 1200000], grade: "AAA" as InvestmentGrade, thesis: "Japan's first supercar. Bond girl's car in You Only Live Twice. 351 produced.", trim: null },
  { make: "Nissan", model: "Fairlady Z", years: [1969, 1970, 1971, 1972, 1973], engine: "2.4L L24 I6", price: [40000, 80000], grade: "A" as InvestmentGrade, thesis: "The car that launched Japanese sports cars in America. 432 is collector grade.", trim: "432" },
];

// ─── 80s/90s ICONS (20%) ───
const eightyNinetyIcons = [
  { make: "Ferrari", model: "F40", years: [1987, 1988, 1989, 1990, 1991, 1992], engine: "2.9L Twin-Turbo V8", price: [1800000, 2600000], grade: "AAA" as InvestmentGrade, thesis: "Enzo's final project. Twin-turbo V8 with no ABS or power steering. Raw perfection.", trim: null },
  { make: "Ferrari", model: "F50", years: [1995, 1996, 1997], engine: "4.7L F1-derived V12", price: [3500000, 4800000], grade: "AAA" as InvestmentGrade, thesis: "349 produced. F1 engine mounted to chassis. More rare than F40.", trim: null },
  { make: "Porsche", model: "959", years: [1986, 1987, 1988], engine: "2.85L Twin-Turbo Flat-6", price: [1400000, 2000000], grade: "AAA" as InvestmentGrade, thesis: "Most advanced car of its era. All-wheel drive, adjustable suspension. Tech pioneer.", trim: "Sport" },
  { make: "Lamborghini", model: "Countach", years: [1985, 1986, 1987, 1988, 1989, 1990], engine: "5.2L V12", price: [450000, 700000], grade: "AA" as InvestmentGrade, thesis: "Defined the bedroom poster era. 25th Anniversary is the ultimate spec.", trim: "25th Anniversary" },
  { make: "Ferrari", model: "Testarossa", years: [1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991], engine: "4.9L Flat-12", price: [180000, 300000], grade: "A" as InvestmentGrade, thesis: "Miami Vice icon. Single-mirror early cars most desirable. Market bottom passed.", trim: null },
  { make: "Ferrari", model: "288 GTO", years: [1984, 1985, 1986], engine: "2.9L Twin-Turbo V8", price: [3000000, 4200000], grade: "AAA" as InvestmentGrade, thesis: "272 built. Group B homologation. Precursor to F40. Trophy collector car.", trim: null },
  { make: "Porsche", model: "911 Turbo", years: [1989, 1990, 1991, 1992, 1993, 1994], engine: "3.3L Flat-6 Turbo", price: [150000, 250000], grade: "A" as InvestmentGrade, thesis: "964 Turbo is the last air-cooled generation. Strong demand, limited supply.", trim: "3.6" },
  { make: "Porsche", model: "911 Carrera RS", years: [1973], engine: "2.7L Flat-6", price: [1100000, 1600000], grade: "AAA" as InvestmentGrade, thesis: "1,580 produced. Lightweight homologation special. Ducktail is iconic.", trim: "2.7 Lightweight" },
  { make: "BMW", model: "M1", years: [1978, 1979, 1980, 1981], engine: "3.5L M88 I6", price: [600000, 900000], grade: "AAA" as InvestmentGrade, thesis: "BMW's only mid-engine supercar. 453 produced. Procar series legend.", trim: null },
  { make: "Porsche", model: "911 GT2", years: [1993, 1994, 1995, 1996, 1997, 1998], engine: "3.6L Twin-Turbo Flat-6", price: [800000, 1200000], grade: "AAA" as InvestmentGrade, thesis: "The Widowmaker. RWD twin-turbo with no traction control. Raw and collectible.", trim: "993" },
  { make: "Jaguar", model: "XJ220", years: [1992, 1993, 1994], engine: "3.5L Twin-Turbo V6", price: [500000, 750000], grade: "AA" as InvestmentGrade, thesis: "271 built. Once fastest production car. Undervalued relative to Italian rivals.", trim: null },
  { make: "McLaren", model: "F1 GTR", years: [1995, 1996, 1997], engine: "6.1L BMW V12 600HP", price: [12000000, 18000000], grade: "AAA" as InvestmentGrade, thesis: "Le Mans-winning race car. Longtail specification most desirable. Trophy asset.", trim: "Longtail" },
  { make: "Ferrari", model: "550 Maranello", years: [1996, 1997, 1998, 1999, 2000, 2001], engine: "5.5L V12 485HP", price: [180000, 280000], grade: "A" as InvestmentGrade, thesis: "Return to front-engine GT. Manual gearbox cars command 30% premium.", trim: null },
  { make: "Lamborghini", model: "Diablo", years: [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998], engine: "5.7L V12", price: [280000, 450000], grade: "A" as InvestmentGrade, thesis: "Last Lamborghini before Audi. VT and SV variants most collectible.", trim: "SV" },
];

// ─── ODDBALLS & RALLY LEGENDS (10%) ───
const oddballsRally = [
  { make: "Lancia", model: "Delta Integrale", years: [1987, 1988, 1989, 1990, 1991, 1992, 1993], engine: "2.0L Turbo I4", price: [80000, 150000], grade: "A" as InvestmentGrade, thesis: "6-time WRC champion. Evoluzione 2 is the collector spec. Italian rally icon.", trim: "Evoluzione 2" },
  { make: "Audi", model: "Sport Quattro", years: [1984, 1985, 1986], engine: "2.1L Inline-5 Turbo", price: [450000, 650000], grade: "AAA" as InvestmentGrade, thesis: "Only 224 produced. Group B homologation legend. All-wheel drive pioneer.", trim: "S1" },
  { make: "Peugeot", model: "205 T16", years: [1984, 1985, 1986], engine: "1.8L Turbo I4 Mid-Mount", price: [350000, 500000], grade: "AAA" as InvestmentGrade, thesis: "200 homologation units. Mid-engine Group B monster. French rally heritage.", trim: "Evolution 2" },
  { make: "Ford", model: "RS200", years: [1984, 1985, 1986], engine: "1.8L BDT Turbo", price: [280000, 400000], grade: "AA" as InvestmentGrade, thesis: "200 produced. Evolution spec with 600HP. British Group B contender.", trim: "Evolution" },
  { make: "Renault", model: "5 Turbo", years: [1980, 1981, 1982, 1983, 1984, 1985, 1986], engine: "1.4L Turbo Mid-Mount", price: [120000, 200000], grade: "A" as InvestmentGrade, thesis: "Mid-engine pocket rocket. Turbo 2 more accessible, Turbo 1 more pure.", trim: "Turbo 2" },
  { make: "Lancia", model: "Stratos", years: [1973, 1974, 1975, 1976, 1977, 1978], engine: "2.4L Ferrari Dino V6", price: [500000, 750000], grade: "AAA" as InvestmentGrade, thesis: "Purpose-built rally weapon. Ferrari engine, Bertone design. Italian masterpiece.", trim: "HF" },
  { make: "De Tomaso", model: "Pantera", years: [1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991], engine: "5.8L Ford 351 V8", price: [100000, 180000], grade: "A" as InvestmentGrade, thesis: "Italian design, American muscle. GT5-S is the ultimate spec. Undervalued.", trim: "GT5-S" },
  { make: "Maserati", model: "MC12", years: [2004, 2005], engine: "6.0L Ferrari Enzo V12", price: [2200000, 3000000], grade: "AAA" as InvestmentGrade, thesis: "50 produced (25 per year). Ferrari Enzo underneath. Rarer than Enzo.", trim: null },
  { make: "Porsche", model: "550 Spyder", years: [1953, 1954, 1955, 1956], engine: "1.5L Flat-4", price: [4500000, 6500000], grade: "AAA" as InvestmentGrade, thesis: "James Dean's last ride. Porsche's first race car. Ultimate collector item.", trim: null },
  { make: "Alpine", model: "A110", years: [1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977], engine: "1.6L Gordini I4", price: [100000, 180000], grade: "A" as InvestmentGrade, thesis: "Monte Carlo rally champion. Lightweight French sports car. Rising collectibility.", trim: "1600S" },
];

// ─── SUPPORTING DATA ───
const locations = [
  "Beverly Hills, CA", "Miami, FL", "Greenwich, CT", "Scottsdale, AZ", "Monaco",
  "London, UK", "Tokyo, Japan", "Munich, Germany", "Maranello, Italy", "Dubai, UAE",
  "Palm Beach, FL", "Pebble Beach, CA", "Newport Beach, CA", "Austin, TX", "Chicago, IL",
  "New York, NY", "Stuttgart, Germany", "Zurich, Switzerland", "Hong Kong", "Singapore",
  "Melbourne, Australia", "Paris, France", "Barcelona, Spain", "Toronto, Canada", "São Paulo, Brazil"
];

const platforms: Platform[] = [
  "BRING_A_TRAILER", "RM_SOTHEBYS", "GOODING", "BONHAMS", "CARS_AND_BIDS", "COLLECTING_CARS"
];

const historyTemplates = [
  "Single owner since new, meticulously maintained with full service records.",
  "2 owners from new. Previously sold at Pebble Beach Concours 2019.",
  "3 owners, impeccable provenance. Featured in Robb Report.",
  "Matching numbers, recently restored by marque specialist.",
  "Delivery miles only. Time capsule condition.",
  "Concours restoration by Ferrari Classiche. Red Book certified.",
  "Factory press car with documented history.",
  "Originally delivered to European royalty. Exceptional provenance.",
  "Barn find, unrestored survivor with 12,000 original miles.",
  "Known history from new. Winner at Amelia Island 2022.",
  "4 owners, complete tool roll and books. Recent major service.",
  "Race history with period photographs. FIA papers included.",
  "Celebrity provenance (disclosed to winning bidder).",
  "Museum deaccession. Never registered for road use.",
  "Offered from a prominent single-owner collection."
];

// ─── REAL WIKIPEDIA IMAGES BY MAKE/MODEL ───
// High-fidelity images from Wikipedia Commons for authentic presentation
const realCarImages: Record<string, string[]> = {
  // Ferrari
  "Ferrari 250 GTO": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/1962_Ferrari_250_GTO_%28chassis_3851GT%29%2C_Paris_%2810218061915%29.jpg/1280px-1962_Ferrari_250_GTO_%28chassis_3851GT%29%2C_Paris_%2810218061915%29.jpg",
  ],
  "Ferrari 275 GTB/4": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Ferrari_275_GTB-4_-_Flickr_-_edvvc.jpg/1280px-Ferrari_275_GTB-4_-_Flickr_-_edvvc.jpg",
  ],
  "Ferrari 288 GTO": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Ferrari_288_GTO_-_Flickr_-_Alexandre_Pr%C3%A9vot_%284%29.jpg/1280px-Ferrari_288_GTO_-_Flickr_-_Alexandre_Pr%C3%A9vot_%284%29.jpg",
  ],
  "Ferrari F40": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/F40_at_Goodwood_FOS_%28Explored%29_%2832685478067%29.jpg/1280px-F40_at_Goodwood_FOS_%28Explored%29_%2832685478067%29.jpg",
  ],
  "Ferrari F50": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Ferrari_F50_-_Flickr_-_Alexandre_Pr%C3%A9vot_%284%29_%28cropped%29.jpg/1280px-Ferrari_F50_-_Flickr_-_Alexandre_Pr%C3%A9vot_%284%29_%28cropped%29.jpg",
  ],
  "Ferrari Enzo": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Enzo_Ferrari_%281%29.jpg/1280px-Enzo_Ferrari_%281%29.jpg",
  ],
  "Ferrari LaFerrari": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/LaFerrari_Aperta.jpg/1280px-LaFerrari_Aperta.jpg",
  ],
  "Ferrari Testarossa": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Ferrari_Testarossa_%287754556824%29.jpg/1280px-Ferrari_Testarossa_%287754556824%29.jpg",
  ],
  "Ferrari 365 GTB/4 Daytona": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/1969_Ferrari_365_GTB4_Daytona_-_fvr_%284638026619%29.jpg/1280px-1969_Ferrari_365_GTB4_Daytona_-_fvr_%284638026619%29.jpg",
  ],
  "Ferrari 250 GT SWB": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/1962_Ferrari_250_GT_SWB_%289491992979%29.jpg/1280px-1962_Ferrari_250_GT_SWB_%289491992979%29.jpg",
  ],
  "Ferrari 550 Maranello": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Ferrari_550_Maranello_-_Flickr_-_The_Car_Spy_%2824%29.jpg/1280px-Ferrari_550_Maranello_-_Flickr_-_The_Car_Spy_%2824%29.jpg",
  ],

  // Porsche
  "Porsche Carrera GT": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Porsche_Carrera_GT_-_Flickr_-_Alexandre_Pr%C3%A9vot_%2843%29_%28cropped%29.jpg/1280px-Porsche_Carrera_GT_-_Flickr_-_Alexandre_Pr%C3%A9vot_%2843%29_%28cropped%29.jpg",
  ],
  "Porsche 959": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Porsche_959_-_Flickr_-_Alexandre_Pr%C3%A9vot_%282%29_%28cropped%29.jpg/1280px-Porsche_959_-_Flickr_-_Alexandre_Pr%C3%A9vot_%282%29_%28cropped%29.jpg",
  ],
  "Porsche 918 Spyder": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Porsche_918_Spyder_by_Supermac1961_%2815575445661%29.jpg/1280px-Porsche_918_Spyder_by_Supermac1961_%2815575445661%29.jpg",
  ],
  "Porsche 356 Speedster": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/1956_Porsche_356A_1600_Speedster.jpg/1280px-1956_Porsche_356A_1600_Speedster.jpg",
  ],
  "Porsche 911 Carrera RS": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Porsche_911_Carrera_RS_2.7_%2814131392808%29.jpg/1280px-Porsche_911_Carrera_RS_2.7_%2814131392808%29.jpg",
  ],
  "Porsche 911 Turbo": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Porsche_964_Turbo.jpg/1280px-Porsche_964_Turbo.jpg",
  ],
  "Porsche 911 GT2": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Porsche_911_GT2_%28993%29.jpg/1280px-Porsche_911_GT2_%28993%29.jpg",
  ],
  "Porsche 550 Spyder": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Porsche_550_Spyder_-_panoramio.jpg/1280px-Porsche_550_Spyder_-_panoramio.jpg",
  ],

  // Lamborghini
  "Lamborghini Countach": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lamborghini_Countach_LP400S.jpg/1280px-Lamborghini_Countach_LP400S.jpg",
  ],
  "Lamborghini Murciélago": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Lamborghini_Murcielago_LP640.jpg/1280px-Lamborghini_Murcielago_LP640.jpg",
  ],
  "Lamborghini Aventador": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Lamborghini_Aventador_LP700-4_Orange.jpg/1280px-Lamborghini_Aventador_LP700-4_Orange.jpg",
  ],
  "Lamborghini Diablo": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Lamborghini_Diablo_SV.jpg/1280px-Lamborghini_Diablo_SV.jpg",
  ],

  // Mercedes-Benz
  "Mercedes-Benz 300SL": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/1955_Mercedes-Benz_300SL_Gullwing_Coupe_34_right.jpg/1280px-1955_Mercedes-Benz_300SL_Gullwing_Coupe_34_right.jpg",
  ],
  "Mercedes-Benz 300SL Roadster": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Mercedes-Benz_300SL_Roadster_%28W198%29.jpg/1280px-Mercedes-Benz_300SL_Roadster_%28W198%29.jpg",
  ],

  // Aston Martin
  "Aston Martin DB5": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/AM_DB5_-_Langan%27s_Brasserie.jpg/1280px-AM_DB5_-_Langan%27s_Brasserie.jpg",
  ],
  "Aston Martin DB4 GT Zagato": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/1960_Aston_Martin_DB4GT_Zagato_-_Flickr_-_exfordy_%281%29.jpg/1280px-1960_Aston_Martin_DB4GT_Zagato_-_Flickr_-_exfordy_%281%29.jpg",
  ],
  "Aston Martin One-77": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Aston_Martin_One-77_%287274243918%29.jpg/1280px-Aston_Martin_One-77_%287274243918%29.jpg",
  ],

  // McLaren
  "McLaren F1": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/McLaren_F1.jpg/1280px-McLaren_F1.jpg",
  ],
  "McLaren F1 GTR": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/McLaren_F1_GTR_%27Longtail%27_%2834592571851%29.jpg/1280px-McLaren_F1_GTR_%27Longtail%27_%2834592571851%29.jpg",
  ],
  "McLaren P1": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/McLaren_P1_%289833331756%29.jpg/1280px-McLaren_P1_%289833331756%29.jpg",
  ],

  // Bugatti
  "Bugatti Veyron": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Bugatti_Veyron_16.4_%E2%80%93_Frontansicht_%281%29%2C_5._April_2012%2C_D%C3%BCsseldorf.jpg/1280px-Bugatti_Veyron_16.4_%E2%80%93_Frontansicht_%281%29%2C_5._April_2012%2C_D%C3%BCsseldorf.jpg",
  ],
  "Bugatti Chiron": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Bugatti_Chiron_%2834469318560%29_%28cropped%29.jpg/1280px-Bugatti_Chiron_%2834469318560%29_%28cropped%29.jpg",
  ],

  // JDM
  "Nissan Skyline GT-R": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Nissan_Skyline_R34_GT-R_N%C3%BCr_001.jpg/1280px-Nissan_Skyline_R34_GT-R_N%C3%BCr_001.jpg",
  ],
  "Nissan Fairlady Z": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Datsun_240Z_001.jpg/1280px-Datsun_240Z_001.jpg",
  ],
  "Toyota Supra": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Toyota_Supra_JZA80.jpg/1280px-Toyota_Supra_JZA80.jpg",
  ],
  "Toyota 2000GT": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/1967_Toyota_2000GT_01.jpg/1280px-1967_Toyota_2000GT_01.jpg",
  ],
  "Honda NSX": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/NSX_NA1.jpg/1280px-NSX_NA1.jpg",
  ],
  "Honda NSX-R": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Honda_NSX-R_%28NA1%29_front.jpg/1280px-Honda_NSX-R_%28NA1%29_front.jpg",
  ],
  "Lexus LFA": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Lexus_LFA_%28US%29_-_Flickr_-_skinnylawyer.jpg/1280px-Lexus_LFA_%28US%29_-_Flickr_-_skinnylawyer.jpg",
  ],
  "Mazda RX-7": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Mazda_RX-7_%28FD%29_001.JPG/1280px-Mazda_RX-7_%28FD%29_001.JPG",
  ],
  "Mitsubishi Lancer Evolution": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Mitsubishi_Lancer_Evolution_IX_%282005%29.jpg/1280px-Mitsubishi_Lancer_Evolution_IX_%282005%29.jpg",
  ],
  "Subaru Impreza WRX STI": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/2006_Subaru_Impreza_WRX_STI_--_07-07-2011.jpg/1280px-2006_Subaru_Impreza_WRX_STI_--_07-07-2011.jpg",
  ],

  // Rally / Oddballs
  "Lancia Stratos": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Lancia_Stratos_HF_001.JPG/1280px-Lancia_Stratos_HF_001.JPG",
  ],
  "Lancia Delta Integrale": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Lancia_Delta_HF_Integrale_Evoluzione.jpg/1280px-Lancia_Delta_HF_Integrale_Evoluzione.jpg",
  ],
  "Audi Sport Quattro": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Audi_Sport_quattro_1984.jpg/1280px-Audi_Sport_quattro_1984.jpg",
  ],
  "Peugeot 205 T16": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Peugeot_205_Turbo_16_%28T16%29.jpg/1280px-Peugeot_205_Turbo_16_%28T16%29.jpg",
  ],
  "Ford RS200": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Ford_RS200_-_Flickr_-_exfordy.jpg/1280px-Ford_RS200_-_Flickr_-_exfordy.jpg",
  ],
  "Renault 5 Turbo": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Renault_5_Turbo_2_%2810247376066%29.jpg/1280px-Renault_5_Turbo_2_%2810247376066%29.jpg",
  ],

  // Others
  "BMW M1": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/BMW_M1_%2815628653990%29.jpg/1280px-BMW_M1_%2815628653990%29.jpg",
  ],
  "Jaguar E-Type": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Jaguar_E-Type_Series_1_3.8_Roadster_%282%29.jpg/1280px-Jaguar_E-Type_Series_1_3.8_Roadster_%282%29.jpg",
  ],
  "Jaguar XJ220": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/1993_Jaguar_XJ220_%2810629756834%29.jpg/1280px-1993_Jaguar_XJ220_%2810629756834%29.jpg",
  ],
  "Ford GT": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/2005_Ford_GT.jpg/1280px-2005_Ford_GT.jpg",
  ],
  "Pagani Huayra": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Geneva_MotorShow_2013_-_Pagani_Huayra_3.jpg/1280px-Geneva_MotorShow_2013_-_Pagani_Huayra_3.jpg",
  ],
  "Koenigsegg Agera RS": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Koenigsegg_Agera_RS.jpg/1280px-Koenigsegg_Agera_RS.jpg",
  ],
  "De Tomaso Pantera": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/1972_De_Tomaso_Pantera.jpg/1280px-1972_De_Tomaso_Pantera.jpg",
  ],
  "Maserati MC12": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Maserati_MC12_%282005%29_1X7A7915.jpg/1280px-Maserati_MC12_%282005%29_1X7A7915.jpg",
  ],
  "Alpine A110": [
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Alpine_A110_%282019%29%2C_Paris_Motor_Show_2018%2C_IMG_0313.jpg/1280px-Alpine_A110_%282019%29%2C_Paris_Motor_Show_2018%2C_IMG_0313.jpg",
  ],
};

// Fallback images by make (when specific model not found)
const makeImages: Record<string, string> = {
  "Ferrari": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Enzo_Ferrari_%281%29.jpg/1280px-Enzo_Ferrari_%281%29.jpg",
  "Porsche": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Porsche_Carrera_GT_-_Flickr_-_Alexandre_Pr%C3%A9vot_%2843%29_%28cropped%29.jpg/1280px-Porsche_Carrera_GT_-_Flickr_-_Alexandre_Pr%C3%A9vot_%2843%29_%28cropped%29.jpg",
  "Lamborghini": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Lamborghini_Aventador_LP700-4_Orange.jpg/1280px-Lamborghini_Aventador_LP700-4_Orange.jpg",
  "McLaren": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/McLaren_F1.jpg/1280px-McLaren_F1.jpg",
  "Mercedes-Benz": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/1955_Mercedes-Benz_300SL_Gullwing_Coupe_34_right.jpg/1280px-1955_Mercedes-Benz_300SL_Gullwing_Coupe_34_right.jpg",
  "Aston Martin": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/AM_DB5_-_Langan%27s_Brasserie.jpg/1280px-AM_DB5_-_Langan%27s_Brasserie.jpg",
  "BMW": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/BMW_M1_%2815628653990%29.jpg/1280px-BMW_M1_%2815628653990%29.jpg",
  "Nissan": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Nissan_Skyline_R34_GT-R_N%C3%BCr_001.jpg/1280px-Nissan_Skyline_R34_GT-R_N%C3%BCr_001.jpg",
  "Toyota": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Toyota_Supra_JZA80.jpg/1280px-Toyota_Supra_JZA80.jpg",
  "Honda": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/NSX_NA1.jpg/1280px-NSX_NA1.jpg",
  "Lexus": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Lexus_LFA_%28US%29_-_Flickr_-_skinnylawyer.jpg/1280px-Lexus_LFA_%28US%29_-_Flickr_-_skinnylawyer.jpg",
  "Mazda": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Mazda_RX-7_%28FD%29_001.JPG/1280px-Mazda_RX-7_%28FD%29_001.JPG",
  "Bugatti": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Bugatti_Chiron_%2834469318560%29_%28cropped%29.jpg/1280px-Bugatti_Chiron_%2834469318560%29_%28cropped%29.jpg",
  "Pagani": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Geneva_MotorShow_2013_-_Pagani_Huayra_3.jpg/1280px-Geneva_MotorShow_2013_-_Pagani_Huayra_3.jpg",
  "Koenigsegg": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Koenigsegg_Agera_RS.jpg/1280px-Koenigsegg_Agera_RS.jpg",
  "Ford": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/2005_Ford_GT.jpg/1280px-2005_Ford_GT.jpg",
  "Jaguar": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Jaguar_E-Type_Series_1_3.8_Roadster_%282%29.jpg/1280px-Jaguar_E-Type_Series_1_3.8_Roadster_%282%29.jpg",
  "Lancia": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Lancia_Stratos_HF_001.JPG/1280px-Lancia_Stratos_HF_001.JPG",
  "Audi": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Audi_Sport_quattro_1984.jpg/1280px-Audi_Sport_quattro_1984.jpg",
  "Peugeot": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Peugeot_205_Turbo_16_%28T16%29.jpg/1280px-Peugeot_205_Turbo_16_%28T16%29.jpg",
  "Renault": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Renault_5_Turbo_2_%2810247376066%29.jpg/1280px-Renault_5_Turbo_2_%2810247376066%29.jpg",
  "De Tomaso": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/1972_De_Tomaso_Pantera.jpg/1280px-1972_De_Tomaso_Pantera.jpg",
  "Maserati": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Maserati_MC12_%282005%29_1X7A7915.jpg/1280px-Maserati_MC12_%282005%29_1X7A7915.jpg",
  "Alpine": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Alpine_A110_%282019%29%2C_Paris_Motor_Show_2018%2C_IMG_0313.jpg/1280px-Alpine_A110_%282019%29%2C_Paris_Motor_Show_2018%2C_IMG_0313.jpg",
  "Mitsubishi": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Mitsubishi_Lancer_Evolution_IX_%282005%29.jpg/1280px-Mitsubishi_Lancer_Evolution_IX_%282005%29.jpg",
  "Subaru": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/2006_Subaru_Impreza_WRX_STI_--_07-07-2011.jpg/1280px-2006_Subaru_Impreza_WRX_STI_--_07-07-2011.jpg",
};

// ─── UTILITY FUNCTIONS ───
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTrend(): { trend: string; trendValue: number } {
  const value = (Math.random() * 25 - 5); // -5% to +20%
  const sign = value >= 0 ? "+" : "";
  return {
    trend: `${sign}${value.toFixed(1)}% YoY`,
    trendValue: value
  };
}

function generateEndTime(): Date {
  const now = new Date();
  const hoursFromNow = randomInRange(1, 168); // 1 hour to 7 days
  return new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
}

// Unsplash car images by make (verified working)
const unsplashImages: Record<string, string[]> = {
  "Ferrari": [
    "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1280&q=80",
    "https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=1280&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1280&q=80",
  ],
  "Porsche": [
    "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1280&q=80",
    "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1280&q=80",
    "https://images.unsplash.com/photo-1611859266238-4b98091d9d9b?w=1280&q=80",
  ],
  "Lamborghini": [
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1280&q=80",
    "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1280&q=80",
    "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=1280&q=80",
  ],
  "McLaren": [
    "https://images.unsplash.com/photo-1621135802920-133df287f89c?w=1280&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80",
  ],
  "Mercedes-Benz": [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1280&q=80",
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1280&q=80",
  ],
  "Aston Martin": [
    "https://images.unsplash.com/photo-1596917882853-0a1e98d12b8f?w=1280&q=80",
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1280&q=80",
  ],
  "BMW": [
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1280&q=80",
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1280&q=80",
  ],
  "Nissan": [
    "https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=1280&q=80",
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Toyota": [
    "https://images.unsplash.com/photo-1632245889029-e406faaa34cd?w=1280&q=80",
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Honda": [
    "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=1280&q=80",
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Lexus": [
    "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=1280&q=80",
  ],
  "Mazda": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Bugatti": [
    "https://images.unsplash.com/photo-1600712242805-5f78671b24da?w=1280&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80",
  ],
  "Pagani": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80",
  ],
  "Koenigsegg": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&q=80",
  ],
  "Ford": [
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1280&q=80",
    "https://images.unsplash.com/photo-1612544448445-b8232cff3b6c?w=1280&q=80",
  ],
  "Jaguar": [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1280&q=80",
  ],
  "Lancia": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Audi": [
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1280&q=80",
  ],
  "Peugeot": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Renault": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "De Tomaso": [
    "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1280&q=80",
  ],
  "Maserati": [
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=1280&q=80",
  ],
  "Alpine": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Mitsubishi": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1280&q=80",
  ],
  "Subaru": [
    "https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=1280&q=80",
  ],
};

// Default fallback image (verified working)
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1280&q=80";

function getImageUrl(make: string, _model: string, _index: number): string {
  // Use Unsplash images by make (more reliable than Wikipedia)
  const makeImages = unsplashImages[make];
  if (makeImages && makeImages.length > 0) {
    return makeImages[0];
  }
  return DEFAULT_IMAGE;
}

function getMultipleImages(make: string, _model: string, _baseIndex: number): string[] {
  // Use Unsplash images by make
  const makeImgs = unsplashImages[make];
  if (makeImgs && makeImgs.length > 0) {
    // Fill array with available images, cycling if needed
    return Array(5).fill(null).map((_, i) => makeImgs[i % makeImgs.length]);
  }
  return Array(5).fill(DEFAULT_IMAGE);
}

// ─── MAIN GENERATOR ───
interface ModelSpec {
  make: string;
  model: string;
  years: number[];
  engine: string;
  price: number[];
  grade: InvestmentGrade;
  thesis: string;
  trim: string | null;
}

function generateCarFromSpec(spec: ModelSpec, index: number, category: string): CollectorCar {
  const year = randomFromArray(spec.years);
  const basePrice = randomInRange(spec.price[0], spec.price[1]);
  const { trend, trendValue } = generateTrend();
  const status: AuctionStatus = Math.random() > 0.3 ? "ACTIVE" : (Math.random() > 0.5 ? "ENDING_SOON" : "ENDED");
  const bidVariance = randomInRange(-15, 5);
  const currentBid = Math.floor(basePrice * (1 + bidVariance / 100));

  return {
    id: generateUUID(),
    title: `${year} ${spec.make} ${spec.model}${spec.trim ? ` ${spec.trim}` : ""}`,
    year,
    make: spec.make,
    model: spec.model,
    trim: spec.trim,
    price: basePrice,
    trend,
    trendValue,
    investmentGrade: spec.grade,
    thesis: spec.thesis,
    image: getImageUrl(spec.make, spec.model, index),
    images: getMultipleImages(spec.make, spec.model, index),
    engine: spec.engine,
    transmission: Math.random() > 0.3 ? "6-Speed Manual" : "Automatic",
    mileage: randomInRange(1000, 85000),
    mileageUnit: Math.random() > 0.7 ? "km" : "mi",
    location: randomFromArray(locations),
    history: randomFromArray(historyTemplates),
    platform: randomFromArray(platforms),
    status,
    currentBid,
    bidCount: randomInRange(5, 120),
    endTime: generateEndTime(),
    category
  };
}

export function generateCollectorCars(count: number = 120): CollectorCar[] {
  const cars: CollectorCar[] = [];

  // Distribution: Blue Chip 20%, Modern 30%, JDM 20%, 80s/90s 20%, Oddballs 10%
  const blueChipCount = Math.floor(count * 0.20);
  const modernCount = Math.floor(count * 0.30);
  const jdmCount = Math.floor(count * 0.20);
  const iconCount = Math.floor(count * 0.20);
  const oddballCount = count - blueChipCount - modernCount - jdmCount - iconCount;

  let index = 0;

  // Blue Chip Classics
  for (let i = 0; i < blueChipCount; i++) {
    const spec = randomFromArray(blueChipModels);
    cars.push(generateCarFromSpec(spec, index++, "Blue Chip Classic"));
  }

  // Modern Supercars
  for (let i = 0; i < modernCount; i++) {
    const spec = randomFromArray(modernSupercars);
    cars.push(generateCarFromSpec(spec, index++, "Modern Supercar"));
  }

  // JDM Legends
  for (let i = 0; i < jdmCount; i++) {
    const spec = randomFromArray(jdmLegends);
    cars.push(generateCarFromSpec(spec, index++, "JDM Legend"));
  }

  // 80s/90s Icons
  for (let i = 0; i < iconCount; i++) {
    const spec = randomFromArray(eightyNinetyIcons);
    cars.push(generateCarFromSpec(spec, index++, "80s/90s Icon"));
  }

  // Oddballs & Rally
  for (let i = 0; i < oddballCount; i++) {
    const spec = randomFromArray(oddballsRally);
    cars.push(generateCarFromSpec(spec, index++, "Rally Legend"));
  }

  // Shuffle the array for variety
  return cars.sort(() => Math.random() - 0.5);
}

// ─── PRE-GENERATED DATASET ───
export const COLLECTOR_CARS = generateCollectorCars(120);

// ─── UTILITY EXPORTS ───
export function getCarsByCategory(category: string): CollectorCar[] {
  return COLLECTOR_CARS.filter(car => car.category === category);
}

export function getCarsByMake(make: string): CollectorCar[] {
  return COLLECTOR_CARS.filter(car => car.make === make);
}

export function getCarsByGrade(grade: InvestmentGrade): CollectorCar[] {
  return COLLECTOR_CARS.filter(car => car.investmentGrade === grade);
}

export function getLiveAuctions(): CollectorCar[] {
  return COLLECTOR_CARS.filter(car => car.status === "ACTIVE" || car.status === "ENDING_SOON");
}

export function getEndingSoon(): CollectorCar[] {
  return COLLECTOR_CARS.filter(car => car.status === "ENDING_SOON");
}

export function getTopPicks(): CollectorCar[] {
  return COLLECTOR_CARS
    .filter(car => car.investmentGrade === "AAA" || car.investmentGrade === "AA")
    .slice(0, 24);
}

export function searchCars(query: string): CollectorCar[] {
  const q = query.toLowerCase();
  return COLLECTOR_CARS.filter(car =>
    car.title.toLowerCase().includes(q) ||
    car.make.toLowerCase().includes(q) ||
    car.model.toLowerCase().includes(q) ||
    car.category.toLowerCase().includes(q) ||
    car.engine.toLowerCase().includes(q)
  );
}
