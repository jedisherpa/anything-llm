import React from "react";
import { usePrismHoverTarget } from "@/PrismContext";

function composeEventHandlers(existingHandler, nextHandler) {
  return (event) => {
    existingHandler?.(event);
    nextHandler?.(event);
  };
}

export default function PrismHoverTarget({
  targetId,
  children,
  disabled = false,
}) {
  const { activate, deactivate } = usePrismHoverTarget(targetId);

  if (disabled || !React.isValidElement(children)) return children;

  return React.cloneElement(children, {
    onMouseEnter: composeEventHandlers(children.props.onMouseEnter, activate),
    onMouseLeave: composeEventHandlers(children.props.onMouseLeave, deactivate),
    onFocus: composeEventHandlers(children.props.onFocus, activate),
    onBlur: composeEventHandlers(children.props.onBlur, deactivate),
  });
}
