import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dollarTagAt = (sql, index) => {
  const match = sql
    .slice(index)
    .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
  return match?.[0] ?? null;
};

const encodeDollarBody = (body) =>
  body
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "''")
    .replaceAll(';', '\\073');

export const splitLikeHostedNeon = (sql) =>
  sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

export function buildParserSafeMigration(sql) {
  let output = '';
  let index = 0;

  while (index < sql.length) {
    if (sql.startsWith('--', index)) {
      const newline = sql.indexOf('\n', index + 2);
      if (newline === -1) break;
      output += '\n';
      index = newline + 1;
      continue;
    }

    if (sql.startsWith('/*', index)) {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql.startsWith('/*', index)) {
          depth += 1;
          index += 2;
        } else if (sql.startsWith('*/', index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth !== 0) throw new Error('Unterminated SQL block comment');
      output += ' ';
      continue;
    }

    const dollarTag = sql[index] === '$' ? dollarTagAt(sql, index) : null;
    if (dollarTag) {
      const bodyStart = index + dollarTag.length;
      const bodyEnd = sql.indexOf(dollarTag, bodyStart);
      if (bodyEnd === -1) throw new Error(`Unterminated dollar quote ${dollarTag}`);
      output += `E'${encodeDollarBody(sql.slice(bodyStart, bodyEnd))}'`;
      index = bodyEnd + dollarTag.length;
      continue;
    }

    if (sql[index] === "'") {
      const start = index;
      index += 1;
      while (index < sql.length) {
        if (sql.startsWith("''", index)) {
          index += 2;
          continue;
        }
        if (sql[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
      if (sql[index - 1] !== "'") throw new Error('Unterminated ordinary quoted string');
      const quoted = sql.slice(start, index);
      if (quoted.includes(';')) {
        throw new Error(
          'Unsafe ordinary quoted string contains a semicolon for the hosted Neon splitter',
        );
      }
      output += quoted;
      continue;
    }

    if (sql[index] === '"') {
      const start = index;
      index += 1;
      while (index < sql.length) {
        if (sql.startsWith('""', index)) {
          index += 2;
          continue;
        }
        if (sql[index] === '"') {
          index += 1;
          break;
        }
        index += 1;
      }
      if (sql[index - 1] !== '"') throw new Error('Unterminated quoted identifier');
      const quoted = sql.slice(start, index);
      if (quoted.includes(';')) {
        throw new Error(
          'Unsafe quoted identifier contains a semicolon for the hosted Neon splitter',
        );
      }
      output += quoted;
      continue;
    }

    output += sql[index];
    index += 1;
  }

  return output.trim();
}

export function buildParserSafeMigrationBundle(migrations) {
  const statements = migrations.flatMap((migration) =>
    splitLikeHostedNeon(buildParserSafeMigration(migration)).filter(
      (statement) => !/^(BEGIN|COMMIT)$/i.test(statement),
    ),
  );

  if (statements.length === 0) {
    throw new Error('No SQL statements were generated');
  }

  return `${statements.join(';\n\n')};\n`;
}

export async function buildParserSafeMigrationDirectory(inputDir, outputFile) {
  const filenames = (await readdir(inputDir))
    .filter((filename) => /^\d{4}[a-z]?_.+\.sql$/.test(filename))
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length === 0) {
    throw new Error(`No migration SQL files found in ${inputDir}`);
  }

  const migrations = await Promise.all(
    filenames.map((filename) => readFile(resolve(inputDir, filename), 'utf8')),
  );
  const output = buildParserSafeMigrationBundle(migrations);

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, output, 'utf8');

  return {
    files: filenames.length,
    statements: splitLikeHostedNeon(output).length,
    outputFile,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const inputDir = resolve(process.argv[2] ?? 'db/migrations');
  const outputFile = resolve(process.argv[3] ?? 'db/production-bootstrap.sql');
  const result = await buildParserSafeMigrationDirectory(inputDir, outputFile);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
