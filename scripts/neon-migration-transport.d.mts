export function splitLikeHostedNeon(sql: string): string[];

export function buildParserSafeMigration(sql: string): string;

export function buildParserSafeMigrationBundle(
  migrations: readonly string[],
): string;

export function buildParserSafeMigrationDirectory(
  inputDir: string,
  outputFile: string,
): Promise<{
  files: number;
  statements: number;
  outputFile: string;
}>;
