import { describe, it, expect } from "vitest";
import { classifyMetric, formatMetric, isUsable } from "./metric-value";

const linked = { providerConnected: true, personLinked: true };

describe("metric-value (§6: 0 vs sin datos)", () => {
  it("un 0 real es 'value', no 'sin datos'", () => {
    const mv = classifyMetric(0, linked);
    expect(mv.state).toBe("value");
    expect(mv.value).toBe(0);
  });

  it("null NO se convierte en 0: es 'no_data'", () => {
    expect(classifyMetric(null, linked).state).toBe("no_data");
    expect(classifyMetric(undefined, linked).value).toBeNull();
  });

  it("provider desconectado => no_data (aunque el raw sea 0)", () => {
    expect(classifyMetric(0, { providerConnected: false, personLinked: true }).state).toBe(
      "no_data",
    );
  });

  it("persona sin cuenta => not_linked (no se castiga con 0)", () => {
    expect(classifyMetric(0, { providerConnected: true, personLinked: false }).state).toBe(
      "not_linked",
    );
  });

  it("error de sync tiene prioridad", () => {
    expect(classifyMetric(5, { ...linked, syncError: true }).state).toBe("sync_error");
  });

  it("na cuando no aplica", () => {
    expect(classifyMetric(3, { ...linked, applicable: false }).state).toBe("na");
  });

  it("partial conserva el valor pero marca el estado", () => {
    const mv = classifyMetric(4, { ...linked, partial: true });
    expect(mv.state).toBe("partial");
    expect(mv.value).toBe(4);
    expect(isUsable(mv)).toBe(true);
  });

  it("formatMetric muestra etiqueta traducida para estados sin número", () => {
    const t = (k: string) => k;
    expect(formatMetric(classifyMetric(0, linked), t)).toBe("0");
    expect(formatMetric(classifyMetric(null, linked), t)).toBe("ws.metric.noData");
    expect(
      formatMetric(classifyMetric(0, { providerConnected: true, personLinked: false }), t),
    ).toBe("ws.metric.notLinked");
  });
});
