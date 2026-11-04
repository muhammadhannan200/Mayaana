// Test-process preload only: pin calendar reads before Next loads application
// modules, without freezing Date.now(), performance, timeouts or the event loop.
const NativeDate = Date;
const instant = Date.parse("2024-02-28T23:30:00.000Z");
global.Date = new Proxy(NativeDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [instant], newTarget);
  },
  apply() {
    return new NativeDate(instant).toString();
  },
});
