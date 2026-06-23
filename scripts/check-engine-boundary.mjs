import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const engineSrcRoot = path.join(projectRoot, "packages/chart-engine/src");
const appsRoot = path.join(projectRoot, "apps");

const blockedImportPathTerms = [
  "review",
  "strategy",
  "candidate",
  "watchlist",
  "auth",
  "portfolio",
  "trading-review-system"
];

const blockedIdentifierSegments = new Set([
  "review",
  "strategy",
  "candidate",
  "watchlist",
  "ai",
  "auth",
  "portfolio",
  "tradingreviewsystem"
]);

async function collectTypeScriptFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function isInsideDirectory(childPath, parentPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function createLineStarts(source) {
  const starts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}

function getLocation(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (lineStarts[middle] <= index) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: index - lineStarts[lineIndex] + 1
  };
}

function addViolation(violations, filePath, line, column, message) {
  violations.push({
    filePath: path.relative(projectRoot, filePath),
    line,
    column,
    message
  });
}

async function collectAppPackageNames() {
  let entries;

  try {
    entries = await fs.readdir(appsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const packageNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packagePath = path.join(appsRoot, entry.name, "package.json");

    try {
      const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));

      if (typeof packageJson.name === "string") {
        packageNames.push(packageJson.name);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return packageNames;
}

function isAppPackageImport(specifier, appPackageNames) {
  return appPackageNames.some(
    (packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`)
  );
}

function checkImportSpecifier(violations, filePath, line, column, specifier, appPackageNames) {
  const normalizedSpecifier = specifier.replaceAll("\\", "/");
  const lowerSpecifier = normalizedSpecifier.toLowerCase();

  if (isAppPackageImport(specifier, appPackageNames)) {
    addViolation(
      violations,
      filePath,
      line,
      column,
      `import path must not reference app package: ${specifier}`
    );
  }

  if (lowerSpecifier.includes("apps/")) {
    addViolation(violations, filePath, line, column, `import path must not contain apps/: ${specifier}`);
  }

  for (const term of blockedImportPathTerms) {
    if (lowerSpecifier.includes(term)) {
      addViolation(
        violations,
        filePath,
        line,
        column,
        `import path contains blocked business vocabulary "${term}": ${specifier}`
      );
    }
  }

  if (specifier.startsWith(".")) {
    const resolvedImportPath = path.resolve(path.dirname(filePath), specifier);

    if (!isInsideDirectory(resolvedImportPath, engineSrcRoot)) {
      addViolation(
        violations,
        filePath,
        line,
        column,
        `relative import leaves packages/chart-engine/src: ${specifier}`
      );
    }
  }
}

function isIdentifierCharacter(char) {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char);
}

function hasKeywordAt(source, index, keyword) {
  return (
    source.startsWith(keyword, index) &&
    !isIdentifierCharacter(source[index - 1]) &&
    !isIdentifierCharacter(source[index + keyword.length])
  );
}

function skipComment(source, index) {
  if (source[index] === "/" && source[index + 1] === "/") {
    let cursor = index + 2;

    while (cursor < source.length && source[cursor] !== "\n") {
      cursor += 1;
    }

    return cursor;
  }

  if (source[index] === "/" && source[index + 1] === "*") {
    let cursor = index + 2;

    while (cursor < source.length) {
      if (source[cursor] === "*" && source[cursor + 1] === "/") {
        return cursor + 2;
      }

      cursor += 1;
    }

    return cursor;
  }

  return index;
}

function readStringLiteral(source, index) {
  const quote = source[index];

  if (quote !== "\"" && quote !== "'" && quote !== "`") {
    return undefined;
  }

  let cursor = index + 1;
  let value = "";
  let hasTemplateExpression = false;

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === "\\") {
      if (cursor + 1 < source.length) {
        value += source[cursor + 1];
      }
      cursor += 2;
      continue;
    }

    if (quote === "`" && char === "$" && source[cursor + 1] === "{") {
      hasTemplateExpression = true;
    }

    if (char === quote) {
      return {
        value: hasTemplateExpression ? undefined : value,
        valueStart: index + 1,
        end: cursor + 1
      };
    }

    value += char;
    cursor += 1;
  }

  return {
    value: undefined,
    valueStart: index + 1,
    end: cursor
  };
}

function skipStringLiteral(source, index) {
  return readStringLiteral(source, index)?.end ?? index;
}

function skipWhitespaceAndComments(source, index) {
  let cursor = index;

  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }

    const afterComment = skipComment(source, cursor);

    if (afterComment !== cursor) {
      cursor = afterComment;
      continue;
    }

    break;
  }

  return cursor;
}

function scanForFromSpecifier(source, index) {
  let cursor = index;

  while (cursor < source.length) {
    const afterComment = skipComment(source, cursor);

    if (afterComment !== cursor) {
      cursor = afterComment;
      continue;
    }

    if (source[cursor] === "\"" || source[cursor] === "'" || source[cursor] === "`") {
      cursor = skipStringLiteral(source, cursor);
      continue;
    }

    if (source[cursor] === ";") {
      return { end: cursor + 1 };
    }

    if (hasKeywordAt(source, cursor, "from")) {
      const specifierStart = skipWhitespaceAndComments(source, cursor + "from".length);
      const literal = readStringLiteral(source, specifierStart);

      if (literal?.value !== undefined) {
        return {
          specifier: literal.value,
          specifierIndex: literal.valueStart,
          end: literal.end
        };
      }

      return { end: literal?.end ?? specifierStart };
    }

    cursor += 1;
  }

  return { end: cursor };
}

function checkResolvedSpecifier(
  violations,
  filePath,
  lineStarts,
  specifier,
  specifierIndex,
  appPackageNames
) {
  const location = getLocation(lineStarts, specifierIndex);
  checkImportSpecifier(
    violations,
    filePath,
    location.line,
    location.column,
    specifier,
    appPackageNames
  );
}

function handleImport(violations, filePath, source, lineStarts, index, appPackageNames) {
  const cursor = skipWhitespaceAndComments(source, index + "import".length);

  if (source[cursor] === ".") {
    return cursor + 1;
  }

  if (source[cursor] === "(") {
    const specifierStart = skipWhitespaceAndComments(source, cursor + 1);
    const literal = readStringLiteral(source, specifierStart);

    if (literal?.value !== undefined) {
      checkResolvedSpecifier(
        violations,
        filePath,
        lineStarts,
        literal.value,
        literal.valueStart,
        appPackageNames
      );
    }

    return literal?.end ?? cursor + 1;
  }

  const sideEffectLiteral = readStringLiteral(source, cursor);

  if (sideEffectLiteral?.value !== undefined) {
    checkResolvedSpecifier(
      violations,
      filePath,
      lineStarts,
      sideEffectLiteral.value,
      sideEffectLiteral.valueStart,
      appPackageNames
    );
    return sideEffectLiteral.end;
  }

  const fromSpecifier = scanForFromSpecifier(source, cursor);

  if (fromSpecifier.specifier !== undefined) {
    checkResolvedSpecifier(
      violations,
      filePath,
      lineStarts,
      fromSpecifier.specifier,
      fromSpecifier.specifierIndex,
      appPackageNames
    );
  }

  return fromSpecifier.end;
}

function handleExport(violations, filePath, source, lineStarts, index, appPackageNames) {
  let cursor = skipWhitespaceAndComments(source, index + "export".length);

  if (hasKeywordAt(source, cursor, "type")) {
    cursor = skipWhitespaceAndComments(source, cursor + "type".length);
  }

  if (source[cursor] !== "*" && source[cursor] !== "{") {
    return cursor;
  }

  const fromSpecifier = scanForFromSpecifier(source, cursor);

  if (fromSpecifier.specifier !== undefined) {
    checkResolvedSpecifier(
      violations,
      filePath,
      lineStarts,
      fromSpecifier.specifier,
      fromSpecifier.specifierIndex,
      appPackageNames
    );
  }

  return fromSpecifier.end;
}

function checkImportPaths(violations, filePath, source, lineStarts, appPackageNames) {
  let index = 0;

  while (index < source.length) {
    const afterComment = skipComment(source, index);

    if (afterComment !== index) {
      index = afterComment;
      continue;
    }

    if (source[index] === "\"" || source[index] === "'" || source[index] === "`") {
      index = skipStringLiteral(source, index);
      continue;
    }

    if (hasKeywordAt(source, index, "import")) {
      index = handleImport(violations, filePath, source, lineStarts, index, appPackageNames);
      continue;
    }

    if (hasKeywordAt(source, index, "export")) {
      index = handleExport(violations, filePath, source, lineStarts, index, appPackageNames);
      continue;
    }

    index += 1;
  }
}

function maskCommentsAndStrings(source) {
  const output = source.split("");
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      index = maskLineComment(source, output, index);
      continue;
    }

    if (char === "/" && next === "*") {
      index = maskBlockComment(source, output, index);
      continue;
    }

    if (char === "\"" || char === "'") {
      index = maskQuotedString(source, output, index);
      continue;
    }

    if (char === "`") {
      index = maskTemplateLiteral(source, output, index);
      continue;
    }

    index += 1;
  }

  return output.join("");
}

function blankOutputChar(source, output, index) {
  if (index >= source.length) {
    return;
  }

  if (source[index] !== "\n") {
    output[index] = " ";
  }
}

function maskLineComment(source, output, index) {
  blankOutputChar(source, output, index);
  blankOutputChar(source, output, index + 1);

  let cursor = index + 2;

  while (cursor < source.length && source[cursor] !== "\n") {
    blankOutputChar(source, output, cursor);
    cursor += 1;
  }

  return cursor;
}

function maskBlockComment(source, output, index) {
  blankOutputChar(source, output, index);
  blankOutputChar(source, output, index + 1);

  let cursor = index + 2;

  while (cursor < source.length) {
    blankOutputChar(source, output, cursor);

    if (source[cursor] === "*" && source[cursor + 1] === "/") {
      blankOutputChar(source, output, cursor + 1);
      return cursor + 2;
    }

    cursor += 1;
  }

  return cursor;
}

function maskQuotedString(source, output, index) {
  const quote = source[index];
  blankOutputChar(source, output, index);

  let cursor = index + 1;

  while (cursor < source.length) {
    blankOutputChar(source, output, cursor);

    if (source[cursor] === "\\") {
      cursor += 1;

      if (cursor < source.length) {
        blankOutputChar(source, output, cursor);
      }
    } else if (source[cursor] === quote) {
      return cursor + 1;
    }

    cursor += 1;
  }

  return cursor;
}

function maskTemplateLiteral(source, output, index) {
  blankOutputChar(source, output, index);

  let cursor = index + 1;

  while (cursor < source.length) {
    if (source[cursor] === "\\") {
      blankOutputChar(source, output, cursor);
      cursor += 1;

      if (cursor < source.length) {
        blankOutputChar(source, output, cursor);
      }

      cursor += 1;
      continue;
    }

    if (source[cursor] === "`") {
      blankOutputChar(source, output, cursor);
      return cursor + 1;
    }

    if (source[cursor] === "$" && source[cursor + 1] === "{") {
      blankOutputChar(source, output, cursor);
      blankOutputChar(source, output, cursor + 1);
      cursor = maskTemplateExpression(source, output, cursor + 2);
      continue;
    }

    blankOutputChar(source, output, cursor);
    cursor += 1;
  }

  return cursor;
}

function maskTemplateExpression(source, output, index) {
  let cursor = index;
  let depth = 1;

  while (cursor < source.length && depth > 0) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (char === "/" && next === "/") {
      cursor = maskLineComment(source, output, cursor);
      continue;
    }

    if (char === "/" && next === "*") {
      cursor = maskBlockComment(source, output, cursor);
      continue;
    }

    if (char === "\"" || char === "'") {
      cursor = maskQuotedString(source, output, cursor);
      continue;
    }

    if (char === "`") {
      cursor = maskTemplateLiteral(source, output, cursor);
      continue;
    }

    if (char === "{") {
      depth += 1;
      cursor += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        blankOutputChar(source, output, cursor);
      }

      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return cursor;
}

function splitIdentifier(identifier) {
  return identifier
    .split(/[_$]+/)
    .filter(Boolean)
    .flatMap((part) => part.match(/[A-Z]+(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|[0-9]+/g) ?? [part]);
}

function checkIdentifierVocabulary(violations, filePath, source, lineStarts) {
  const maskedSource = maskCommentsAndStrings(source);
  const identifierPattern = /[A-Za-z_$][A-Za-z0-9_$]*/g;

  for (const match of maskedSource.matchAll(identifierPattern)) {
    const identifier = match[0];
    const segments = splitIdentifier(identifier);
    const blockedSegment = segments.find((segment) =>
      blockedIdentifierSegments.has(segment.toLowerCase())
    );

    if (blockedSegment) {
      const location = getLocation(lineStarts, match.index);
      addViolation(
        violations,
        filePath,
        location.line,
        location.column,
        `source identifier contains blocked business vocabulary "${blockedSegment}": ${identifier}`
      );
    }
  }
}

async function main() {
  const violations = [];
  const files = await collectTypeScriptFiles(engineSrcRoot);
  const appPackageNames = await collectAppPackageNames();

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    const lineStarts = createLineStarts(source);

    checkImportPaths(violations, filePath, source, lineStarts, appPackageNames);
    checkIdentifierVocabulary(violations, filePath, source, lineStarts);
  }

  if (violations.length > 0) {
    console.error("Engine boundary guard failed:");

    for (const violation of violations) {
      console.error(
        `${violation.filePath}:${violation.line}:${violation.column} - ${violation.message}`
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log(`Engine boundary guard passed (${files.length} files scanned).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
