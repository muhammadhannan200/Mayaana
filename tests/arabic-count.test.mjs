import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayCountLabel,
  mealCountLabel,
  visitCountLabel,
} from "../shared/arabic-count.ts";

test("uses correct Arabic forms for counts", () => {
  assert.equal(dayCountLabel(1), "يوم واحد");
  assert.equal(dayCountLabel(2), "يومان");
  assert.equal(dayCountLabel(7), "7 أيام");
  assert.equal(dayCountLabel(14), "14 يوماً");
  assert.equal(mealCountLabel(1), "وجبة واحدة");
  assert.equal(mealCountLabel(5), "5 وجبات");
  assert.equal(mealCountLabel(21), "21 وجبة");
  assert.equal(visitCountLabel(0), "لا توجد زيارات سابقة");
  assert.equal(visitCountLabel(1), "زيارة سابقة واحدة");
  assert.equal(visitCountLabel(3), "3 زيارات سابقة");
});
