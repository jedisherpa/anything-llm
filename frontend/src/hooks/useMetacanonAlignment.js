import { useEffect, useState } from "react";
import {
  ACTIVE_METACANON_ALIGNMENT,
  getActiveMetacanonAlignment,
  METACANON_ALIGNMENT_EVENT,
} from "@/utils/metacanonAlignment";

export default function useMetacanonAlignment() {
  const [alignment, setAlignment] = useState(getActiveMetacanonAlignment());

  useEffect(() => {
    function syncAlignment(event) {
      if (event?.type === "storage") {
        if (event.key && event.key !== ACTIVE_METACANON_ALIGNMENT) return;
      }
      setAlignment(event?.detail ?? getActiveMetacanonAlignment());
    }

    window.addEventListener(METACANON_ALIGNMENT_EVENT, syncAlignment);
    window.addEventListener("storage", syncAlignment);
    return () => {
      window.removeEventListener(METACANON_ALIGNMENT_EVENT, syncAlignment);
      window.removeEventListener("storage", syncAlignment);
    };
  }, []);

  return alignment;
}
