import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateLogin,
  validatePassword,
  validationResult,
} from "../shared/auth-validation.ts";

function data(values = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

test("Login: missing fields, format, whitespace normalization and existing short passwords", () => {
  assert.deepEqual(Object.keys(validateLogin(data())), ["email", "password"]);
  for (const email of ["bad", "x@", "x@y", "x y@z.test", "@z.test"])
    assert.ok(validateLogin(data({ email, password: "x" })).email);
  assert.deepEqual(
    validateLogin(data({ email: " User@Example.test ", password: "x" })),
    {}
  );
  assert.ok(validateLogin(data({ email: "   ", password: "x" })).email);
});

test("new passwords: required fields and 7/8 character boundary, without trimming passwords", () => {
  assert.deepEqual(Object.keys(validatePassword(data(), true)), [
    "currentPassword",
    "password",
    "confirmation",
  ]);
  assert.deepEqual(Object.keys(validatePassword(data())), [
    "password",
    "confirmation",
  ]);
  assert.ok(
    validatePassword(data({ password: "1234567", confirmation: "1234567" }))
      .password
  );
  assert.deepEqual(
    validatePassword(data({ password: "12345678", confirmation: "12345678" })),
    {}
  );
  assert.deepEqual(
    validatePassword(data({ password: " 123456 ", confirmation: " 123456 " })),
    {}
  );
});

test("mismatch, correction and repeated validation return stable field keys, not input values", () => {
  const form = data({
    currentPassword: "current",
    password: "12345678",
    confirmation: "different",
  });
  const invalid = validatePassword(form, true);
  assert.deepEqual(Object.keys(invalid), ["confirmation"]);
  assert.equal(validationResult(invalid).kind, "validation");
  assert.deepEqual(validatePassword(form, true), invalid);
  assert.ok(!JSON.stringify(invalid).includes("different"));
  form.set("confirmation", "12345678");
  assert.equal(validationResult(validatePassword(form, true)), null);
});

test("file values are rejected as missing, including matching non-string passwords", () => {
  const form = data();
  const file = new File(["synthetic"], "synthetic.txt");
  form.set("email", file);
  form.set("password", file);
  form.set("confirmation", file);
  assert.deepEqual(Object.keys(validateLogin(form)), ["email", "password"]);
  assert.deepEqual(Object.keys(validatePassword(form)), [
    "password",
    "confirmation",
  ]);
});
