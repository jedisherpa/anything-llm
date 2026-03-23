import { PROVIDER_OPTIONS_COMPONENTS } from "@/components/LLMSelection/providerOptions";

export default function renderProviderOptions(
  provider,
  settings,
  extraProps = {}
) {
  if (!provider) return null;

  if (typeof provider.options === "function") {
    return provider.options(settings, extraProps);
  }

  const OptionsComponent = PROVIDER_OPTIONS_COMPONENTS[provider.value];
  if (!OptionsComponent) return null;

  return <OptionsComponent settings={settings} {...extraProps} />;
}
