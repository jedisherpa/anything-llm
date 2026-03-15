import { toast } from "react-toastify";
import { signalPrismError } from "@/utils/prism/events";

const LIGHT_THEMES = new Set(["light"]);

// Additional Configs (opts)
// You can also pass valid ReactToast params to override the defaults.
// clear: false, // Will dismiss all visible toasts before rendering next toast
const showToast = (message, type = "default", opts = {}) => {
  const storedTheme = localStorage?.getItem("theme") || "dark";
  const resolvedTheme =
    storedTheme === "system"
      ? window?.matchMedia?.("(prefers-color-scheme: light)")?.matches
        ? "light"
        : "dark"
      : storedTheme === "sanctuary"
        ? "light"
        : storedTheme;
  const options = {
    position: "bottom-center",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: LIGHT_THEMES.has(resolvedTheme) ? "light" : "dark",
    ...opts,
  };

  if (opts?.clear === true) toast.dismiss();

  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      signalPrismError({ source: "toast", message });
      toast.error(message, options);
      break;
    case "info":
      toast.info(message, options);
      break;
    case "warning":
      toast.warn(message, options);
      break;
    default:
      toast(message, options);
  }
};

export default showToast;
