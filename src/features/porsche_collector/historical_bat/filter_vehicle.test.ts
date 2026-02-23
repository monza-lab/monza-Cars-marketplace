import { describe, expect, it } from "vitest";

import { vehicleFilter } from "./filter_vehicle";

describe("historical bat vehicle filter", () => {
  it("keeps Porsche vehicle listing", () => {
    const result = vehicleFilter({ title: "1998 Porsche 911 Carrera 4S" as string, id: 1 });
    expect(result).toEqual({ keep: true });
  });

  it("rejects wheels listing", () => {
    const result = vehicleFilter({ title: "Porsche wheels set" as string, id: 2 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects fuchs wheels listing", () => {
    const result = vehicleFilter({ title: "15×8″ and 15×9″ Fuchs Wheels for Porsche" as string, id: 3 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects engine listing even with year", () => {
    const result = vehicleFilter({ title: "1971 Porsche 911T Type 911/03 Engine" as string, id: 4 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects transaxle listing", () => {
    const result = vehicleFilter({ title: "1973 Porsche 911S Type 911/53 Engine and Five-Speed Transaxle" as string, id: 5 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects magazines listing", () => {
    const result = vehicleFilter({ title: "1975-2018 Porsche Panorama Magazines" as string, id: 6 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects manuals listing", () => {
    const result = vehicleFilter({ title: "1978 Porsche 935 Operating and Parts Manuals" as string, id: 7 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects toolkit listing", () => {
    const result = vehicleFilter({ title: "Porsche Tool Kit" as string, id: 8 });
    expect(result).toEqual({ keep: false, reason: "non_vehicle_accessory" });
  });

  it("rejects non-Porsche listing", () => {
    const result = vehicleFilter({ title: "1998 Ferrari 355" as string, id: 9 });
    expect(result).toEqual({ keep: false, reason: "non_porsche" });
  });

  it("keeps vehicle with S/T designation (not seat)", () => {
    const result = vehicleFilter({ title: "2024 Porsche 911 S/T Heritage Design" as string, id: 10 });
    expect(result).toEqual({ keep: true });
  });

  it("rejects sign listing but does not confuse with design", () => {
    const signResult = vehicleFilter({ title: "Porsche Dealership Sign" as string, id: 12 });
    const designResult = vehicleFilter({ title: "2024 Porsche 911 S/T Heritage Design" as string, id: 13 });

    expect(signResult).toEqual({ keep: false, reason: "non_vehicle_accessory" });
    expect(designResult).toEqual({ keep: true });
  });

  it("keeps vehicle with GT3 designation", () => {
    const result = vehicleFilter({ title: "2024 Porsche 911 GT3 RS" as string, id: 11 });
    expect(result).toEqual({ keep: true });
  });
});
