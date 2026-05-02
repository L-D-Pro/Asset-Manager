import type { ThemeDefinition } from "../theme/theme-types";

export function ThemeEditor({
  themes,
  activeThemeId,
  onSelectTheme,
}: {
  themes: ThemeDefinition[];
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}) {
  return (
    <div className="ui-theme-editor">
      {themes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => onSelectTheme(theme.id)}
          data-active={theme.id === activeThemeId}
          className="ui-theme-chip"
        >
          {theme.name}
        </button>
      ))}
    </div>
  );
}
