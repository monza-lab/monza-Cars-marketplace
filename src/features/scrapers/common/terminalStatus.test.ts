import { describe, expect, it, vi } from "vitest";

import { fetchTerminalStatusSourceIds } from "./terminalStatus";

describe("fetchTerminalStatusSourceIds", () => {
  it("queries listings once for all requested source ids and returns only terminal matches", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { source_id: "bat-1", status: "sold" },
        { source_id: "bat-2", status: "active" },
        { source_id: "bat-3", status: "delisted" },
      ],
      error: null,
    });
    const inFilter = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));

    const sourceIds = await fetchTerminalStatusSourceIds({
      from,
    } as never, ["bat-1", "bat-2", "bat-3"]);

    expect(from).toHaveBeenCalledWith("listings");
    expect(select).toHaveBeenCalledWith("source_id,status");
    expect(inFilter).toHaveBeenCalledWith("source_id", ["bat-1", "bat-2", "bat-3"]);
    expect(limit).toHaveBeenCalledWith(3);
    expect(sourceIds).toEqual(new Set(["bat-1", "bat-3"]));
  });

  it("returns an empty set when nothing is requested", async () => {
    const from = vi.fn();

    const sourceIds = await fetchTerminalStatusSourceIds({ from } as never, []);

    expect(from).not.toHaveBeenCalled();
    expect(sourceIds.size).toBe(0);
  });
});
