import { describe, expect, it } from 'vitest';

import {
  buildParserSafeMigration,
  buildParserSafeMigrationBundle,
  splitLikeHostedNeon,
} from '../../scripts/neon-migration-transport.mjs';

describe('Neon migration transport', () => {
  it('keeps procedural SQL intact under the hosted Neon semicolon splitter', () => {
    const source = `
CREATE OR REPLACE FUNCTION demo()
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1;
END;
$$;

CREATE TABLE demo_table(id integer);
`;

    const output = buildParserSafeMigration(source);
    const statements = splitLikeHostedNeon(output);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("AS E'");
    expect(statements[0]).toContain('\\073');
    expect(statements[0]).not.toContain('$$');
    expect(statements[1]).toBe('CREATE TABLE demo_table(id integer)');
  });

  it('removes comments so comment semicolons cannot confuse the hosted splitter', () => {
    const source = `
-- note; this semicolon must not split
CREATE TABLE alpha(id integer);
/* another; comment */
CREATE TABLE beta(id integer);
`;

    expect(splitLikeHostedNeon(buildParserSafeMigration(source))).toEqual([
      'CREATE TABLE alpha(id integer)',
      'CREATE TABLE beta(id integer)',
    ]);
  });

  it('refuses unsafe ordinary quoted strings containing semicolons', () => {
    expect(() =>
      buildParserSafeMigration("INSERT INTO notes(body) VALUES ('alpha;beta');"),
    ).toThrow(/ordinary quoted string/i);
  });

  it('removes per-file transaction wrappers because Neon supplies the outer transaction', () => {
    const output = buildParserSafeMigrationBundle([
      'BEGIN; CREATE TABLE alpha(id integer); COMMIT;',
      'BEGIN; CREATE TABLE beta(id integer); COMMIT;',
    ]);

    expect(splitLikeHostedNeon(output)).toEqual([
      'CREATE TABLE alpha(id integer)',
      'CREATE TABLE beta(id integer)',
    ]);
  });
});
