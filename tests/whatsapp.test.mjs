import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dietPlanMessage,
  whatsappPhone,
  whatsappUrl,
} from "../lib/whatsapp.ts";

test("normalizes phone numbers for wa.me", () => {
  assert.equal(whatsappPhone("0944 123 456"), "963944123456");
  assert.equal(whatsappPhone("+963 944-123-456"), "963944123456");
  assert.equal(whatsappPhone("00963944123456"), "963944123456");
  assert.equal(whatsappPhone("+12025550102"), "12025550102");
  assert.equal(whatsappPhone("123"), null);
});

test("builds a message with only the plan and appointment", () => {
  const message = dietPlanMessage({
    patientName: "ريم",
    appointment: "2026-11-18",
    days: [
      {
        id: "1",
        meals: [{ id: "a", type: "فطور", description: "بيض مسلوق" }],
      },
    ],
  });
  assert.match(message, /مرحباً ريم/);
  assert.match(message, /اليوم 1\nفطور: بيض مسلوق/);
  assert.match(message, /موعد المراجعة: 2026-11-18/);
});

test("builds an encoded wa.me link and hides invalid numbers", () => {
  const url = whatsappUrl("0944123456", "مرحباً");
  assert.ok(url.startsWith("https://wa.me/963944123456?text=%D9%85"));
  assert.equal(whatsappUrl("abc", "مرحباً"), null);
});
