import { describe, it, expect } from "vitest";
import { safeJsonParse, stableStringify, truncateString, byteLength, isPlainObject } from "../src/utils/json";
import { nowIso, toTimestampId, formatDuration, toSafeFileSegment } from "../src/utils/time";
import { AppError, toError } from "../src/utils/errors";
import { toIdSet, parseKeyValueEntries } from "../src/cli/args";

describe("json utils", () => {
  describe("safeJsonParse", () => {
    it("deve fazer parse de JSON válido", () => {
      const result = safeJsonParse<{ name: string }>('{"name": "test"}');
      expect(result).toEqual({ name: "test" });
    });

    it("deve retornar undefined para JSON inválido", () => {
      expect(safeJsonParse("not json")).toBeUndefined();
    });

    it("deve retornar undefined para string vazia", () => {
      expect(safeJsonParse("")).toBeUndefined();
    });
  });

  describe("stableStringify", () => {
    it("deve serializar com indentação de 2 espaços", () => {
      const result = stableStringify({ a: 1, b: 2 });
      expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
    });

    it("deve lidar com null", () => {
      expect(stableStringify(null)).toBe("null");
    });
  });

  describe("truncateString", () => {
    it("não deve truncar strings curtas", () => {
      const result = truncateString("hello", 100);
      expect(result.value).toBe("hello");
      expect(result.truncated).toBe(false);
    });

    it("deve truncar strings longas", () => {
      const result = truncateString("a".repeat(200), 50);
      expect(result.value.length).toBeLessThanOrEqual(70);
      expect(result.truncated).toBe(true);
      expect(result.value).toContain("<truncated>");
    });
  });

  describe("byteLength", () => {
    it("deve calcular bytes para ASCII", () => {
      expect(byteLength("hello")).toBe(5);
    });

    it("deve calcular bytes para UTF-8 multibyte", () => {
      expect(byteLength("café")).toBeGreaterThan(4);
    });
  });

  describe("isPlainObject", () => {
    it("deve retornar true para objetos simples", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it("deve retornar false para arrays", () => {
      expect(isPlainObject([])).toBe(false);
    });

    it("deve retornar false para null", () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it("deve retornar false para primitivos", () => {
      expect(isPlainObject("string")).toBe(false);
      expect(isPlainObject(42)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
    });
  });
});

describe("time utils", () => {
  describe("nowIso", () => {
    it("deve retornar string ISO válida", () => {
      const iso = nowIso();
      expect(new Date(iso).toISOString()).toBe(iso);
    });
  });

  describe("toTimestampId", () => {
    it("deve gerar ID sem : ou .", () => {
      const id = toTimestampId();
      expect(id).not.toContain(":");
      expect(id).not.toContain(".");
    });

    it("deve usar data fornecida", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const id = toTimestampId(date);
      expect(id).toBe("2024-01-15T10-30-00-000Z");
    });
  });

  describe("formatDuration", () => {
    it("deve formatar duração em milissegundos", () => {
      expect(formatDuration(1234)).toBe("1234ms");
    });

    it("deve retornar 0ms para valores negativos", () => {
      expect(formatDuration(-5)).toBe("0ms");
    });

    it("deve arredondar valores decimais", () => {
      expect(formatDuration(1.7)).toBe("2ms");
    });
  });

  describe("toSafeFileSegment", () => {
    it("deve converter para lowercase e substituir caracteres especiais", () => {
      expect(toSafeFileSegment("Hello World!")).toBe("hello-world");
    });

    it("deve remover hífens iniciais e finais", () => {
      expect(toSafeFileSegment("--test--")).toBe("test");
    });

    it("deve retornar 'default' para string vazia", () => {
      expect(toSafeFileSegment("")).toBe("default");
      expect(toSafeFileSegment("!!!")).toBe("default");
    });
  });
});

describe("error utils", () => {
  describe("AppError", () => {
    it("deve criar erro com código e contexto", () => {
      const error = new AppError("CONFIG_ERROR", "Invalid config", { field: "x" });
      expect(error.code).toBe("CONFIG_ERROR");
      expect(error.message).toBe("Invalid config");
      expect(error.context).toEqual({ field: "x" });
      expect(error.name).toBe("AppError");
    });
  });

  describe("toError", () => {
    it("deve retornar Error diretamente", () => {
      const original = new Error("test");
      expect(toError(original)).toBe(original);
    });

    it("deve converter string para Error", () => {
      const result = toError("error message");
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe("error message");
    });

    it("deve converter objeto para Error via JSON", () => {
      const result = toError({ code: 123 });
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain("123");
    });
  });
});

describe("cli args", () => {
  describe("toIdSet", () => {
    it("deve criar Set a partir de array", () => {
      const result = toIdSet(["id1", "id2", "id3"]);
      expect(result.size).toBe(3);
      expect(result.has("id1")).toBe(true);
    });

    it("deve retornar Set vazio para undefined", () => {
      expect(toIdSet(undefined).size).toBe(0);
    });

    it("deve ignorar strings vazias e whitespace", () => {
      const result = toIdSet(["id1", "", "  ", "id2"]);
      expect(result.size).toBe(2);
    });
  });

  describe("parseKeyValueEntries", () => {
    it("deve parsear key:value corretamente", () => {
      const result = parseKeyValueEntries(["id1:nota importante", "id2:outra nota"]);
      expect(result.get("id1")).toBe("nota importante");
      expect(result.get("id2")).toBe("outra nota");
    });

    it("deve ignorar entradas sem separador", () => {
      const result = parseKeyValueEntries(["invalido", "id1:valido"]);
      expect(result.size).toBe(1);
    });

    it("deve retornar Map vazio para undefined", () => {
      expect(parseKeyValueEntries(undefined).size).toBe(0);
    });

    it("deve lidar com valor contendo :", () => {
      const result = parseKeyValueEntries(["id1:valor:com:dois:pontos"]);
      expect(result.get("id1")).toBe("valor:com:dois:pontos");
    });
  });
});
