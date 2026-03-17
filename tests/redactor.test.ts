import { describe, it, expect } from "vitest";
import { NetworkRedactor } from "../src/network/redactor";
import type { AppConfig } from "../src/types/config";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    outputDirectory: "/tmp/logs",
    sessionDirectory: "/tmp/sessions",
    sessionFile: "/tmp/sessions/default.json",
    persistSession: false,
    clearSessionOnStart: false,
    debug: false,
    allowlistDomains: [],
    ignoredResourceTypes: [],
    ignoredUrlPatterns: [],
    includeGetKeywords: [],
    relevanceKeywords: [],
    mediumThreshold: 40,
    highThreshold: 70,
    flowTimeWindowMs: 12000,
    requestBodyPreviewLimit: 512,
    responseBodyPreviewLimit: 768,
    maxBodyBytesToStore: 16384,
    customSensitiveFields: ["authorization", "cookie", "token", "password", "cpf", "email"],
    redactionRules: [
      { keyPattern: "authorization", replacement: "Bearer ***REDACTED***", applyTo: "headers" },
      { keyPattern: "cookie", replacement: "***REDACTED***", applyTo: "headers" },
      { keyPattern: "password", replacement: "***REDACTED***", applyTo: "body" },
      { keyPattern: "cpf", replacement: "***REDACTED***", applyTo: "body" },
      { keyPattern: "token", replacement: "***REDACTED***", applyTo: "all" }
    ],
    domainFlowDefinitions: [],
    domainSequenceRules: [],
    exportFormats: ["axios"],
    ...overrides
  };
}

describe("NetworkRedactor", () => {
  describe("sanitizeHeaders", () => {
    it("deve redactar header Authorization", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.sanitizeHeaders({
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "content-type": "application/json"
      });
      expect(result["authorization"]).toBe("Bearer ***REDACTED***");
      expect(result["content-type"]).toBe("application/json");
    });

    it("deve redactar header Cookie", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.sanitizeHeaders({
        cookie: "session=abc123; csrf=xyz"
      });
      expect(result["cookie"]).toBe("***REDACTED***");
    });

    it("deve filtrar valores undefined", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.sanitizeHeaders({
        "content-type": "text/html",
        "x-custom": undefined
      });
      expect(Object.keys(result)).toEqual(["content-type"]);
    });
  });

  describe("sanitizeQuery", () => {
    it("deve redactar parâmetros sensíveis por token", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.sanitizeQuery({
        access_token: "secret123",
        page: "1"
      });
      expect(result["access_token"]).toBe("***REDACTED***");
      expect(result["page"]).toBe("1");
    });

    it("deve lidar com arrays de valores", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.sanitizeQuery({
        ids: ["1", "2", "3"]
      });
      expect(result["ids"]).toEqual(["1", "2", "3"]);
    });
  });

  describe("redactBody", () => {
    it("deve retornar vazio para body undefined", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.redactBody(undefined, undefined, 512, 16384);
      expect(result.data).toBeNull();
      expect(result.sizeBytes).toBe(0);
    });

    it("deve omitir multipart/form-data", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.redactBody("boundary=---abc", "multipart/form-data; boundary=---abc", 512, 16384);
      expect(result.notes).toContain("multipart/form-data omitted for safety");
    });

    it("deve redactar campos sensíveis em JSON body", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const body = JSON.stringify({ name: "João", password: "s3cret", cpf: "123.456.789-00" });
      const result = redactor.redactBody(body, "application/json", 512, 16384);
      const data = result.data as Record<string, unknown>;
      expect(data["password"]).toBe("***REDACTED***");
      expect(data["cpf"]).toBe("***REDACTED***");
      expect(data["name"]).toBe("João");
    });

    it("deve redactar campos em URL-encoded body", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const body = "password=s3cret&user=joao";
      const result = redactor.redactBody(body, "application/x-www-form-urlencoded", 512, 16384);
      const data = result.data as Record<string, unknown>;
      expect(data["password"]).toBe("***REDACTED***");
      expect(data["user"]).toBe("joao");
    });

    it("deve truncar body grande", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const largeText = Array.from({ length: 500 }, (_, i) => `item ${i}: valor do campo`).join(", ");
      const body = JSON.stringify({ description: largeText });
      const result = redactor.redactBody(body, "application/json", 512, 100);
      expect(result.truncated).toBe(true);
    });

    it("deve redactar padrões de email em strings", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const body = JSON.stringify({ note: "Contato: user@example.com para info" });
      const result = redactor.redactBody(body, "application/json", 512, 16384);
      const data = result.data as Record<string, unknown>;
      expect(data["note"]).not.toContain("user@example.com");
      expect(data["note"]).toContain("***REDACTED***");
    });

    it("deve redactar padrões de CPF em strings", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const body = JSON.stringify({ info: "CPF do cliente: 123.456.789-00" });
      const result = redactor.redactBody(body, "application/json", 512, 16384);
      const data = result.data as Record<string, unknown>;
      expect(data["info"]).toContain("***REDACTED***");
    });

    it("deve redactar tokens Bearer em strings", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const body = JSON.stringify({ auth: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0Ijp0cnVlfQ.abc123" });
      const result = redactor.redactBody(body, "application/json", 512, 16384);
      const data = result.data as Record<string, unknown>;
      expect(data["auth"]).toContain("Bearer ***REDACTED***");
    });

    it("deve lidar com Buffer binário", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const result = redactor.redactBody(buf, "image/png", 512, 16384);
      expect(result.notes).toContain("Binary body omitted from persisted artifacts.");
    });
  });

  describe("redactStructured", () => {
    it("deve redactar valores estruturados aninhados", () => {
      const redactor = new NetworkRedactor(makeConfig());
      const result = redactor.redactStructured(
        { user: { password: "secret", name: "João" }, items: [{ token: "abc" }] },
        "body",
        512,
        16384
      );
      const data = result.data as Record<string, unknown>;
      const user = data["user"] as Record<string, unknown>;
      expect(user["password"]).toBe("***REDACTED***");
      expect(user["name"]).toBe("João");
    });
  });
});
