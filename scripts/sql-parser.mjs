// Parse INSERT VALUES as data. Never execute a supplied SQL dump.
export function parseSqlDump(sql) {
  const tables = {};
  const header = /INSERT\s+INTO\s+`([^`]+)`\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let match;
  while ((match = header.exec(sql))) {
    const [, name, columnText] = match;
    const columns = [...columnText.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!columns.length) throw new Error(`Missing column list for ${name}`);
    let i = header.lastIndex;
    const skip = () => {
      while (/\s/.test(sql[i] ?? "") && i < sql.length) i++;
    };
    const read = () => {
      skip();
      if (sql[i] === "'") {
        i++;
        let value = "",
          closed = false;
        while (i < sql.length) {
          const c = sql[i++];
          if (c === "\\") {
            const n = sql[i++];
            value += { n: "\n", r: "\r", t: "\t", 0: "\0", Z: "\x1a" }[n] ?? n;
          } else if (c === "'") {
            if (sql[i] === "'") {
              value += "'";
              i++;
            } else {
              closed = true;
              break;
            }
          } else value += c;
        }
        if (!closed) throw new Error(`Unterminated string in ${name}`);
        return value;
      }
      const start = i;
      while (i < sql.length && sql[i] !== "," && sql[i] !== ")") i++;
      const value = sql.slice(start, i).trim();
      if (/^NULL$/i.test(value)) return null;
      if (!/^-?\d+(?:\.\d+)?$/.test(value))
        throw new Error(`Unsupported SQL value in ${name}`);
      return Number(value);
    };
    const rows = (tables[name] ??= []);
    for (;;) {
      skip();
      if (sql[i++] !== "(") throw new Error(`Expected row in ${name}`);
      const row = [];
      for (;;) {
        row.push(read());
        skip();
        const delimiter = sql[i++];
        if (delimiter === ")") break;
        if (delimiter !== ",") throw new Error(`Invalid delimiter in ${name}`);
      }
      if (row.length !== columns.length)
        throw new Error(`Column mismatch in ${name}`);
      rows.push(
        Object.fromEntries(
          columns.map((column, index) => [column, row[index]]),
        ),
      );
      skip();
      const delimiter = sql[i++];
      if (delimiter === ";") break;
      if (delimiter !== ",")
        throw new Error(`Invalid end of INSERT in ${name}`);
    }
    header.lastIndex = i;
  }
  return tables;
}
