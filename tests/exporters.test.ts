import { describe, it, expect } from "vitest";
import { buildExportHeaders } from "../src/exporters/shared";

describe("shared exporter utils", () => {
  describe("buildExportHeaders", () => {
    it("deve substituir Authorization por placeholder", () => {
      const result = buildExportHeaders({
        authorization: "Bearer abc123",
        "content-type": "application/json"
      });
      expect(result["authorization"]).toBe("Bearer <TOKEN>");
      expect(result["content-type"]).toBe("application/json");
    });

    it("deve substituir Cookie por placeholder", () => {
      const result = buildExportHeaders({
        cookie: "session=abc; csrf=xyz"
      });
      expect(result["cookie"]).toBe("<COOKIE>");
    });

    it("deve substituir CSRF por placeholder", () => {
      const result = buildExportHeaders({
        "x-csrf-token": "abc123"
      });
      expect(result["x-csrf-token"]).toBe("<CSRF>");
    });

    it("deve preservar content-type, accept e x-requested-with", () => {
      const result = buildExportHeaders({
        "content-type": "application/json",
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest"
      });
      expect(result["content-type"]).toBe("application/json");
      expect(result["accept"]).toBe("application/json");
      expect(result["x-requested-with"]).toBe("XMLHttpRequest");
    });

    it("deve ignorar headers não relevantes", () => {
      const result = buildExportHeaders({
        "x-custom-header": "value",
        "content-length": "123",
        "user-agent": "Mozilla"
      });
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
