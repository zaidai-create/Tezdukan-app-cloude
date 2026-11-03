import { describe, expect, it } from "vitest";
import { plain } from "./text";

describe("Munshi replies", () => {
  it("are plain text: no markdown marks, list stars become bullets", () => {
    expect(plain("Aaj ki sale **Rs 0** hai.\n* Tapal (2 baqi)\n- Olper's (4 baqi)")).toBe(
      "Aaj ki sale Rs 0 hai.\n• Tapal (2 baqi)\n• Olper's (4 baqi)",
    );
  });
});
