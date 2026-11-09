/**
 * The few things the app remembers between runs (settings.json in the user data folder). For now only
 * the path of the last project. Parsing never throws: any trouble gives the defaults.
 */
export interface Settings {
  /** The project to reopen at start, or null. */
  lastProject: string | null;
}

export const DEFAULT_SETTINGS: Settings = { lastProject: null };

const MAX_PATH = 4096;

function usablePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_PATH && !value.includes('\0');
}

export function parseSettings(text: string | null): Settings {
  if (text === null) return { ...DEFAULT_SETTINGS };
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
    const lastProject = (raw as Record<string, unknown>).lastProject;
    return { lastProject: usablePath(lastProject) ? lastProject : null };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}
