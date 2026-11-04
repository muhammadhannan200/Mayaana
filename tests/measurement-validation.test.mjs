import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeMeasurement,
  validateMeasurement,
} from "../lib/measurement-validation.ts";

test("normalizes Arabic and Persian digits and separators", () => {
  assert.equal(normalizeMeasurement(" ٨٢٫٥ "), "82.5");
  assert.equal(normalizeMeasurement("۶۵,۲"), "65.2");
});

test("accepts values within the field range and precision", () => {
  assert.equal(validateMeasurement("82.75", "weight"), null);
  assert.equal(validateMeasurement("٨٢٫٧", "weight"), null);
  assert.equal(validateMeasurement("100", "fat"), null);
});

test("accepts 200 kg and rejects 200.01 kg at the UI validation boundary", () => {
  for (const value of ["200", "200.00", "٢٠٠٫٠٠"])
    assert.equal(validateMeasurement(value, "weight"), null);
  for (const value of ["200.01", "٢٠٠٫٠١", "500"])
    assert.match(validateMeasurement(value, "weight"), /الوزن.*200/);
});

test("rejects empty, zero, negative and out-of-range values", () => {
  for (const value of ["", "   ", "0", "-5", "abc", "501"])
    assert.match(validateMeasurement(value, "weight"), /الوزن/);
  assert.match(validateMeasurement("101", "fat"), /نسبة الدهون/);
});

test("rejects more than two decimal places", () => {
  assert.match(validateMeasurement("82.755", "weight"), /منزلتين/);
});

test("falls back to the weight limit for a field without metadata", () => {
  assert.equal(validateMeasurement("99", "bmi"), null);
  assert.match(validateMeasurement("501", "bmi"), /500/);
});
