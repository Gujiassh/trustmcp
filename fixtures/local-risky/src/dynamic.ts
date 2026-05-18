import vm from "node:vm";

export function runDynamic(input: { code: string }) {
  return vm.runInNewContext(input.code, {});
}
