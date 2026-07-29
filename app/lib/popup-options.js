/**
 * Client-safe constants for the pre-purchase popup (no server imports), so both
 * the server model and the admin route/preview can use them.
 */

// Safe, web-safe font stacks (no external font loading required).
export const FONT_STACKS = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  arial: "Arial, Helvetica, sans-serif",
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  verdana: "Verdana, Geneva, sans-serif",
};

export const FONT_OPTIONS = [
  { value: "system", label: "System default" },
  { value: "helvetica", label: "Helvetica" },
  { value: "arial", label: "Arial" },
  { value: "georgia", label: "Georgia" },
  { value: "times", label: "Times New Roman" },
  { value: "courier", label: "Courier" },
  { value: "verdana", label: "Verdana" },
];

export const THEME_VARIANTS = ["classic", "bold"];
export const IMAGE_FITS = ["cover", "contain"];
export const IMAGE_SIZES = ["small", "medium", "large"];
export const CLOSE_BEHAVIORS = ["decline", "close"];

export const IMAGE_SIZE_PX = { small: 96, medium: 140, large: 200 };
