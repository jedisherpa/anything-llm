import OpenAiOptions from "@/components/LLMSelection/OpenAiOptions";
import GenericOpenAiOptions from "@/components/LLMSelection/GenericOpenAiOptions";
import AzureAiOptions from "@/components/LLMSelection/AzureAiOptions";
import AnthropicAiOptions from "@/components/LLMSelection/AnthropicAiOptions";
import LMStudioOptions from "@/components/LLMSelection/LMStudioOptions";
import LocalAiOptions from "@/components/LLMSelection/LocalAiOptions";
import GeminiLLMOptions from "@/components/LLMSelection/GeminiLLMOptions";
import OllamaLLMOptions from "@/components/LLMSelection/OllamaLLMOptions";
import NovitaLLMOptions from "@/components/LLMSelection/NovitaLLMOptions";
import CometApiLLMOptions from "@/components/LLMSelection/CometApiLLMOptions";
import TogetherAiOptions from "@/components/LLMSelection/TogetherAiOptions";
import FireworksAiOptions from "@/components/LLMSelection/FireworksAiOptions";
import MistralOptions from "@/components/LLMSelection/MistralOptions";
import HuggingFaceOptions from "@/components/LLMSelection/HuggingFaceOptions";
import PerplexityOptions from "@/components/LLMSelection/PerplexityOptions";
import OpenRouterOptions from "@/components/LLMSelection/OpenRouterOptions";
import GroqAiOptions from "@/components/LLMSelection/GroqAiOptions";
import CohereAiOptions from "@/components/LLMSelection/CohereAiOptions";
import KoboldCPPOptions from "@/components/LLMSelection/KoboldCPPOptions";
import TextGenWebUIOptions from "@/components/LLMSelection/TextGenWebUIOptions";
import LiteLLMOptions from "@/components/LLMSelection/LiteLLMOptions";
import AWSBedrockLLMOptions from "@/components/LLMSelection/AwsBedrockLLMOptions";
import DeepSeekOptions from "@/components/LLMSelection/DeepSeekOptions";
import ApiPieLLMOptions from "@/components/LLMSelection/ApiPieOptions";
import XAILLMOptions from "@/components/LLMSelection/XAiLLMOptions";
import ZAiLLMOptions from "@/components/LLMSelection/ZAiLLMOptions";
import NvidiaNimOptions from "@/components/LLMSelection/NvidiaNimOptions";
import PPIOLLMOptions from "@/components/LLMSelection/PPIOLLMOptions";
import DellProAiStudioOptions from "@/components/LLMSelection/DPAISOptions";
import MoonshotAiOptions from "@/components/LLMSelection/MoonshotAiOptions";
import FoundryOptions from "@/components/LLMSelection/FoundryOptions";
import GiteeAIOptions from "@/components/LLMSelection/GiteeAIOptions/index.jsx";
import DockerModelRunnerOptions from "@/components/LLMSelection/DockerModelRunnerOptions";
import PrivateModeOptions from "@/components/LLMSelection/PrivateModeOptions";
import SambaNovaOptions from "@/components/LLMSelection/SambaNovaOptions";
import LemonadeOptions from "@/components/LLMSelection/LemonadeOptions";

export const PROVIDER_OPTIONS_COMPONENTS = {
  openai: OpenAiOptions,
  azure: AzureAiOptions,
  anthropic: AnthropicAiOptions,
  gemini: GeminiLLMOptions,
  "nvidia-nim": NvidiaNimOptions,
  huggingface: HuggingFaceOptions,
  ollama: OllamaLLMOptions,
  dpais: DellProAiStudioOptions,
  lmstudio: LMStudioOptions,
  "docker-model-runner": DockerModelRunnerOptions,
  lemonade: LemonadeOptions,
  sambanova: SambaNovaOptions,
  localai: LocalAiOptions,
  togetherai: TogetherAiOptions,
  fireworksai: FireworksAiOptions,
  mistral: MistralOptions,
  perplexity: PerplexityOptions,
  openrouter: OpenRouterOptions,
  groq: GroqAiOptions,
  koboldcpp: KoboldCPPOptions,
  textgenwebui: TextGenWebUIOptions,
  cohere: CohereAiOptions,
  litellm: LiteLLMOptions,
  deepseek: DeepSeekOptions,
  ppio: PPIOLLMOptions,
  bedrock: AWSBedrockLLMOptions,
  apipie: ApiPieLLMOptions,
  moonshotai: MoonshotAiOptions,
  privatemode: PrivateModeOptions,
  novita: NovitaLLMOptions,
  cometapi: CometApiLLMOptions,
  foundry: FoundryOptions,
  xai: XAILLMOptions,
  zai: ZAiLLMOptions,
  giteeai: GiteeAIOptions,
  "generic-openai": GenericOpenAiOptions,
};
