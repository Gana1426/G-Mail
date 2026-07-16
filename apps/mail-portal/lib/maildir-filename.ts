const WIN32_FLAG_DELIM = ";2,";
const UNIX_FLAG_DELIM = ":2,";

function isWindowsPlatform(): boolean {
  return process.platform === "win32";
}

/** Maildir flag suffix delimiter — colon is invalid in Windows filenames. */
export function getMaildirFlagDelimiter(): string {
  return isWindowsPlatform() ? WIN32_FLAG_DELIM : UNIX_FLAG_DELIM;
}

/** Normalize legacy Unix-style flag suffixes for the current platform. */
export function normalizeMaildirFilename(filename: string): string {
  if (!isWindowsPlatform()) return filename;
  return filename.replace(/:2,/g, WIN32_FLAG_DELIM);
}

export function buildMaildirFilename(
  baseName: string,
  flagString: string
): string {
  const safeBase = isWindowsPlatform() ? baseName.replace(/:/g, "_") : baseName;
  return `${safeBase}${getMaildirFlagDelimiter()}${flagString}`;
}

export function splitMaildirFilename(filename: string): {
  baseName: string;
  flagString: string;
} {
  const unixIdx = filename.lastIndexOf(UNIX_FLAG_DELIM);
  const winIdx = filename.lastIndexOf(WIN32_FLAG_DELIM);
  const idx = Math.max(unixIdx, winIdx);

  if (idx === -1) {
    return { baseName: filename, flagString: "" };
  }

  const delim =
    unixIdx >= winIdx ? UNIX_FLAG_DELIM.length : WIN32_FLAG_DELIM.length;

  return {
    baseName: filename.slice(0, idx),
    flagString: filename.slice(idx + delim),
  };
}
