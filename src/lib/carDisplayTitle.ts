type CarIdentity = {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  title?: string | null;
};

function normalized(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function carDisplayTitle(car: CarIdentity): string {
  const canonical = [car.year, car.make, car.model, car.trim && car.trim !== "—" ? car.trim : null]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const title = String(car.title ?? "").replace(/\s+/g, " ").trim();
  const titleWords = new Set(normalized(title).split(" "));
  const informative = normalized(car.model).split(" ").every((word) => titleWords.has(word));
  return informative ? title : canonical;
}
