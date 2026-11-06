import { Icon } from "./icon";
import "./weight-change.css";

// A weight change as an arrow and an unsigned value. A minus sign moves to the
// wrong side in Arabic text, so the arrow carries the direction instead.
export function WeightChange({
  value,
  goal,
  good: towardsGoal,
  unit = "كغ",
}: {
  value: number;
  goal?: string;
  good?: boolean;
  unit?: string;
}) {
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const good =
    direction !== "flat" &&
    (towardsGoal ?? (goal === "زيادة وزن" ? value > 0 : value < 0));
  return (
    <span
      className={`weight-change ${direction} ${good ? "good" : direction === "flat" ? "" : "away"}`}
      aria-label={`${direction === "up" ? "زيادة" : direction === "down" ? "نزول" : "ثابت"} ${Math.abs(value).toFixed(1)} ${unit}`}
    >
      {direction !== "flat" && <Icon name="down" size={14} />}
      <bdi>
        {Math.abs(value).toFixed(1)} {unit}
      </bdi>
    </span>
  );
}
