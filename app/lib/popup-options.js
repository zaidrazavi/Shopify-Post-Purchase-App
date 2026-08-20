/**
 * Client-safe constants for the pre-purchase popup (no server imports), so both
 * the server model and the admin route/preview can use them.
 */

// Web-safe font stacks (no external font loading required — keeps the storefront
// popup fast and avoids FOUT). "system" = the OS default; "inherit store font"
// is handled separately (it ignores this value and uses the theme's font).
export const FONT_STACKS = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  arial: "Arial, Helvetica, sans-serif",
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  trebuchet: '"Trebuchet MS", Helvetica, sans-serif',
  gillsans: '"Gill Sans", "Gill Sans MT", Calibri, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  garamond: 'Garamond, "Times New Roman", serif',
  courier: '"Courier New", Courier, monospace',
  lucida: '"Lucida Console", Monaco, monospace',
  comicsans: '"Comic Sans MS", "Comic Sans", cursive',
  impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
};

export const FONT_OPTIONS = [
  { value: "system", label: "System default" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "verdana", label: "Verdana" },
  { value: "tahoma", label: "Tahoma" },
  { value: "trebuchet", label: "Trebuchet MS" },
  { value: "gillsans", label: "Gill Sans" },
  { value: "georgia", label: "Georgia" },
  { value: "times", label: "Times New Roman" },
  { value: "palatino", label: "Palatino" },
  { value: "garamond", label: "Garamond" },
  { value: "courier", label: "Courier New" },
  { value: "lucida", label: "Lucida Console" },
  { value: "comicsans", label: "Comic Sans MS" },
  { value: "impact", label: "Impact" },
];

export const THEME_VARIANTS = ["classic", "bold"];
export const IMAGE_FITS = ["cover", "contain"];
export const IMAGE_SIZES = ["small", "medium", "large"];
export const CLOSE_BEHAVIORS = ["decline", "close"];

// OCU-parity additions.
export const DISCOUNT_TYPES = ["none", "percentage", "fixed"];
// Card/image arrangement presets (the 4 layout icons in OCU's General section).
export const POPUP_LAYOUTS = [
  "media-left", // image left, details right (default)
  "media-right", // image right, details left
  "media-top", // image on top, details below (centered)
  "text-only", // no image, text/buttons only
];

export const IMAGE_SIZE_PX = { small: 96, medium: 140, large: 200 };
