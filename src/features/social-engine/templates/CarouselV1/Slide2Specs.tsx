import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 8,
      paddingBottom: 28, borderBottom: "1px solid #2A2226",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 500, letterSpacing: "0.25em",
        textTransform: "uppercase", color: "#9A8E88",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 38,
        letterSpacing: "-0.01em", color: "#E8E2DE",
      }}>
        {value}
      </div>
    </div>
  );
}

export function Slide2Specs({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 1);
  const l = data.listing;
  const price = l.final_price ?? l.current_bid;

  return (
    <SlideFrame theme="dark">
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{
          flex: "0 0 50%",
          backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(14,10,12,0) 70%, rgba(14,10,12,0.9) 100%)",
          }} />
        </div>
        <div style={{
          flex: 1, padding: "72px 56px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div style={{
            fontSize: 20, fontWeight: 500, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#D4738A",
          }}>The Car</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <SpecRow label="Engine" value={l.engine} />
            <SpecRow label="Gearbox" value={l.transmission} />
            <SpecRow label="Mileage" value={l.mileage != null ? `${l.mileage.toLocaleString()} mi` : null} />
            <SpecRow label="Exterior" value={l.color_exterior} />
            {price != null && <SpecRow label="Price" value={`$${price.toLocaleString()}`} />}
          </div>
          <div style={{
            fontSize: 18, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "#9A8E88",
          }}>
            Live on {l.platform?.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
