import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide1Cover({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 0);
  const title = `${data.listing.year ?? ""} ${data.listing.make ?? ""} ${data.listing.model ?? ""} ${data.listing.trim ?? ""}`.replace(/\s+/g, " ").trim();

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`,
        backgroundSize: "cover", backgroundPosition: "center",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(14,10,12,0.9) 100%)",
      }} />

      <div style={{
        position: "absolute", top: 64, left: 64, zIndex: 2,
        fontSize: 22, fontWeight: 500, letterSpacing: "0.25em",
        textTransform: "uppercase", color: "#D4738A",
      }}>
        New Listing
      </div>
      <div style={{
        position: "absolute", top: 64, right: 64, zIndex: 2,
        fontFamily: "Cormorant, serif", fontWeight: 500, fontSize: 36,
        letterSpacing: "-0.02em", color: "#E8E2DE",
      }}>
        MonzaHaus
      </div>

      <div style={{
        position: "absolute", bottom: 80, left: 64, right: 64, zIndex: 2,
      }}>
        <div style={{
          fontFamily: "Cormorant, serif", fontWeight: 300, fontSize: 96,
          lineHeight: 1.05, letterSpacing: "-0.02em", color: "#E8E2DE",
        }}>
          {title}
        </div>
        <div style={{
          marginTop: 24, fontSize: 22, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "#9A8E88",
        }}>
          via {data.listing.platform?.replace(/_/g, " ").toLowerCase()} · {data.listing.location ?? "location unavailable"}
        </div>
      </div>
    </SlideFrame>
  );
}
