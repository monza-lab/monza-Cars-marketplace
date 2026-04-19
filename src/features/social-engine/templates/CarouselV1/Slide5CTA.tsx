import { SlideFrame } from "./SlideFrame";
import { pickPhoto, type SlideData } from "./templateData";

export function Slide5CTA({ data }: { data: SlideData }) {
  const photo = pickPhoto(data, 3);

  return (
    <SlideFrame theme="dark">
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.45,
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, rgba(14,10,12,0.3) 0%, rgba(14,10,12,0.92) 100%)",
      }} />
      <div style={{
        position: "relative", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
        <div>
          <div style={{
            fontSize: 22, fontWeight: 500, letterSpacing: "0.3em",
            textTransform: "uppercase", color: "#D4738A",
          }}>
            Visítanos
          </div>
          <div style={{
            fontFamily: "Cormorant, serif", fontWeight: 300, fontSize: 116,
            letterSpacing: "-0.02em", color: "#E8E2DE", marginTop: 48, lineHeight: 1.05,
          }}>
            Full report on<br/>MonzaHaus
          </div>
          <div style={{
            fontFamily: "Geist Mono, monospace", fontSize: 28,
            color: "#D4738A", marginTop: 48, letterSpacing: "0.05em",
          }}>
            monzahaus.com
          </div>
        </div>
      </div>
      <div style={{
        position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
        fontFamily: "Cormorant, serif", fontWeight: 600, fontSize: 64,
        color: "#E8E2DE", letterSpacing: "-0.04em",
      }}>
        M
      </div>
    </SlideFrame>
  );
}
