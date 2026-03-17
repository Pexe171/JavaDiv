import { createCli } from "./cli/commands";
import { toError } from "./utils/errors";

async function main(): Promise<void> {
  await createCli().parseAsync(process.argv);
}

void main().catch((error) => {
  const normalizedError = toError(error);
  console.error(`[FATAL] ${normalizedError.message}`);
  process.exitCode = 1;
});
