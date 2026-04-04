export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface GenesisRiteRequest {
  vision_core: string;
  core_values: string[];
  soul_facets: unknown[];
  human_in_loop: boolean;
  interpretive_boundaries: string[];
  drift_prevention: string;
  enable_morpheus_compute: boolean;
  morpheus: Record<string, unknown>;
  will_directives: string[];
  signing_secret: string;
}

export interface GenesisRiteResult {
  genesis_hash: string;
  signature: string;
  soul_file: Record<string, unknown>;
  [key: string]: unknown;
}

export type WillScope = "user" | "system" | "shared";

export interface WillVector {
  directives: string[];
  intent?: string | null;
  scope?: WillScope | null;
  confidence?: number | null;
  [key: string]: unknown;
}

export interface ActionValidationReport {
  valid: boolean;
  reason: string;
  alignment_score: number;
  matched_directives: string[];
  flags: string[];
  blocked_by: string | null;
}

export interface ComputeOption {
  provider_id: string;
  label?: string;
  is_local?: boolean;
  [key: string]: unknown;
}

export interface ProviderHealthRecord {
  provider_id: string;
  healthy?: boolean;
  [key: string]: unknown;
}

export interface SubSphereRecord {
  sub_sphere_id: string;
  status?: string;
  [key: string]: unknown;
}

export interface CommandResult {
  ok?: boolean;
  [key: string]: unknown;
}

export interface CommunicationStatus {
  agent_bindings: unknown[];
  [key: string]: unknown;
}

export interface MetaCanonNativeBridge {
  genesis_rite(requestJson: string): string;
  validate_action(actionJson: string, willVectorJson: string): boolean;
  validate_action_with_context(actionJson: string, soulFileJson: string): string;
  validate_action_constitutional(actionJson: string, willVectorJson: string): string;
  log_event(traceId: string, eventType: string, payloadJson: string): string;
  get_code_snippet(filePath: string, startLine: number, endLine: number): string;
  get_will_vector(soulFileJson: string): string;
  update_soul_file(soulFileJson: string, patchJson: string, signingSecret: string): string;
  get_compute_options(): string;
  set_global_compute_provider(providerId: string): string;
  set_provider_priority(priorityJson: string): string;
  update_provider_config(providerId: string, configJson: string): string;
  create_task_sub_sphere(name: string, objective: string, hitlRequired: boolean): string;
  get_sub_sphere_list(): string;
  get_sub_sphere_status(subSphereId: string): string;
  pause_sub_sphere(subSphereId: string): string;
  dissolve_sub_sphere(subSphereId: string, reason: string): string;
  submit_sub_sphere_query(subSphereId: string, query: string, providerOverride: string | null): string;
  approve_hitl_action(subSphereId: string, pendingActionId: string): string;
  reject_hitl_action(subSphereId: string, pendingActionId: string, reason: string): string;
  update_telegram_integration(configJson: string): string;
  update_discord_integration(configJson: string): string;
  bind_agent_route(
    agentId: string,
    telegramChatId: string | null,
    discordThreadId: string | null,
    inAppThreadId: string | null,
    isOrchestrator: boolean
  ): string;
  bind_sub_sphere_prism_route(
    subSphereId: string,
    prismAgentId: string,
    telegramChatId: string | null,
    discordThreadId: string | null,
    inAppThreadId: string | null
  ): string;
  send_agent_message(platform: string, agentId: string, message: string): string;
  send_sub_sphere_prism_message(platform: string, subSphereId: string, message: string): string;
  get_communication_status(): string;
}

export interface MetaCanonClient {
  raw: MetaCanonNativeBridge;
  genesisRite(request: GenesisRiteRequest): GenesisRiteResult;
  validateAction(action: Record<string, unknown>, willVector: WillVector): boolean;
  validateActionWithContext(action: Record<string, unknown>, soulFile: Record<string, unknown>): ActionValidationReport;
  validateActionConstitutional(action: Record<string, unknown>, willVector: WillVector): ActionValidationReport;
  logEvent(traceId: string, eventType: string, payload: JsonValue): string;
  getCodeSnippet(filePath: string, startLine: number, endLine: number): string;
  getWillVector(soulFile: Record<string, unknown>): WillVector;
  updateSoulFile(
    soulFile: Record<string, unknown>,
    patch: Record<string, unknown>,
    signingSecret: string
  ): Record<string, unknown>;
  getComputeOptions(): ComputeOption[];
  setGlobalComputeProvider(providerId: string): Record<string, unknown>;
  setProviderPriority(priorityList: string[]): Record<string, unknown>;
  updateProviderConfig(providerId: string, patch: Record<string, unknown>): Record<string, unknown>;
  createTaskSubSphere(name: string, objective: string, hitlRequired?: boolean): SubSphereRecord;
  getSubSphereList(): SubSphereRecord[];
  getSubSphereStatus(subSphereId: string): SubSphereRecord;
  pauseSubSphere(subSphereId: string): CommandResult;
  dissolveSubSphere(subSphereId: string, reason: string): CommandResult;
  submitSubSphereQuery(
    subSphereId: string,
    query: string,
    providerOverride?: string | null
  ): Record<string, unknown>;
  approveHitlAction(subSphereId: string, pendingActionId: string): CommandResult;
  rejectHitlAction(
    subSphereId: string,
    pendingActionId: string,
    reason?: string
  ): CommandResult;
  updateTelegramIntegration(config: Record<string, unknown>): CommandResult;
  updateDiscordIntegration(config: Record<string, unknown>): CommandResult;
  bindAgentRoute(
    agentId: string,
    telegramChatId?: string | null,
    discordThreadId?: string | null,
    inAppThreadId?: string | null,
    isOrchestrator?: boolean
  ): Record<string, unknown>;
  bindSubSpherePrismRoute(
    subSphereId: string,
    prismAgentId: string,
    telegramChatId?: string | null,
    discordThreadId?: string | null,
    inAppThreadId?: string | null
  ): Record<string, unknown>;
  sendAgentMessage(platform: string, agentId: string, message: string): Record<string, unknown>;
  sendSubSpherePrismMessage(
    platform: string,
    subSphereId: string,
    message: string
  ): Record<string, unknown>;
  getCommunicationStatus(): CommunicationStatus;
}

export function createMetaCanonClient(nativeBridge?: MetaCanonNativeBridge): MetaCanonClient;
