const NHTSA_BATCH_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/";
const MAX_BATCH_SIZE = 50;

export interface NhtsaDecodedVin {
  VIN: string;
  Make: string;
  Model: string;
  ModelYear: string;
  BodyClass: string;
  DriveType: string;
  DisplacementL: string;
  EngineCylinders: string;
  EngineConfiguration: string;
  FuelTypePrimary: string;
  TransmissionStyle: string;
  Doors: string;
  ErrorCode: string;
  ErrorText: string;
}

export interface VinEnrichmentFields {
  engine: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  driveType: string | null;
}

export async function decodeVinBatch(vins: string[]): Promise<NhtsaDecodedVin[]> {
  if (vins.length === 0) return [];
  if (vins.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size ${vins.length} exceeds max ${MAX_BATCH_SIZE}`);
  }

  const body = new URLSearchParams();
  body.set("format", "json");
  body.set("data", vins.join(";"));

  try {
    const res = await fetch(NHTSA_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`[NHTSA] HTTP ${res.status}: ${await res.text().catch(() => "(unreadable)")}`);
      return [];
    }

    const payload = (await res.json()) as { Count: number; Results: NhtsaDecodedVin[] };
    return (payload.Results ?? []).filter(
      (r) => r.ErrorCode === "0" && r.Make && r.Make.length > 0
    );
  } catch (err) {
    console.error(`[NHTSA] Batch decode failed:`, err);
    return [];
  }
}

/** Shorten verbose NHTSA BodyClass values to fit varchar(50) */
function shortenBodyClass(raw: string): string {
  // "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)" → "SUV"
  // "Convertible/Cabriolet" → "Convertible"
  const BODY_MAP: Record<string, string> = {
    "Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)": "SUV",
    "Sport Utility Vehicle (SUV)": "SUV",
    "Multi-Purpose Vehicle (MPV)": "MPV",
    "Convertible/Cabriolet": "Convertible",
    "Hatchback/Liftback/Notchback": "Hatchback",
    "Sedan/Saloon": "Sedan",
    "Station Wagon (Wagon)/Sport Utility Vehicle (SUV)": "Wagon",
  };
  return BODY_MAP[raw] ?? (raw.length > 50 ? raw.slice(0, 50) : raw);
}

export function mapNhtsaToListingFields(decoded: NhtsaDecodedVin): VinEnrichmentFields {
  const engineParts: string[] = [];
  if (decoded.DisplacementL && decoded.DisplacementL !== "0") {
    engineParts.push(`${decoded.DisplacementL}L`);
  }
  if (decoded.EngineConfiguration) {
    engineParts.push(decoded.EngineConfiguration);
  }
  if (decoded.EngineCylinders && decoded.EngineCylinders !== "0") {
    engineParts.push(`${decoded.EngineCylinders}-Cylinder`);
  }
  const engine = engineParts.length > 0 ? engineParts.join(" ") : null;

  const rawBody = decoded.BodyClass || null;

  return {
    engine,
    transmission: decoded.TransmissionStyle || null,
    bodyStyle: rawBody ? shortenBodyClass(rawBody) : null,
    driveType: decoded.DriveType || null,
  };
}

export async function decodeVinsInBatches(
  vins: string[],
  opts?: { delayMs?: number; onBatch?: (batch: number, total: number) => void }
): Promise<Map<string, VinEnrichmentFields>> {
  const delayMs = opts?.delayMs ?? 1000;
  const result = new Map<string, VinEnrichmentFields>();
  const batches = Math.ceil(vins.length / MAX_BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batchVins = vins.slice(i * MAX_BATCH_SIZE, (i + 1) * MAX_BATCH_SIZE);
    opts?.onBatch?.(i + 1, batches);

    const decoded = await decodeVinBatch(batchVins);
    for (const d of decoded) {
      result.set(d.VIN, mapNhtsaToListingFields(d));
    }

    if (i < batches - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return result;
}
