// Local type definitions for @opencode-ai/plugin
// These mirror the official plugin types for standalone compilation

export type ProviderContext = {
  source: "env" | "config" | "custom" | "api";
  info: Provider;
  options: Record<string, any>;
};

export type PluginInput = {
  client: any;
  project: Project;
  directory: string;
  worktree: string;
  serverUrl: URL;
  $: any;
};

export type Plugin = (input: PluginInput) => Promise<Hooks>;

export type Auth =
  | {
      type: "oauth";
      refresh: string;
      access: string;
      expires: number;
      enterpriseUrl?: string;
    }
  | {
      type: "api";
      key: string;
    }
  | {
      type: "wellknown";
      key: string;
      token: string;
    };

export type AuthOuathResult = {
  url: string;
  instructions: string;
} & (
  | {
      method: "auto";
      callback(): Promise<
        | ({
            type: "success";
            provider?: string;
          } & (
            | {
                refresh: string;
                access: string;
                expires: number;
              }
            | {
                key: string;
              }
          ))
        | {
            type: "failed";
          }
      >;
    }
  | {
      method: "code";
      callback(code: string): Promise<
        | ({
            type: "success";
            provider?: string;
          } & (
            | {
                refresh: string;
                access: string;
                expires: number;
              }
            | {
                key: string;
              }
          ))
        | {
            type: "failed";
          }
      >;
    }
);

export type AuthHook = {
  provider: string;
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>;
  methods: Array<
    | {
        type: "oauth";
        label: string;
        prompts?: Array<{
          type: "text";
          key: string;
          message: string;
          placeholder?: string;
          validate?: (value: string) => string | undefined;
          condition?: (inputs: Record<string, string>) => boolean;
        }>;
        authorize(inputs?: Record<string, string>): Promise<AuthOuathResult>;
      }
    | {
        type: "api";
        label: string;
        prompts?: Array<{
          type: "text";
          key: string;
          message: string;
          placeholder?: string;
          validate?: (value: string) => string | undefined;
          condition?: (inputs: Record<string, string>) => boolean;
        }>;
        authorize?(inputs?: Record<string, string>): Promise<
          | {
              type: "success";
              key: string;
              provider?: string;
            }
          | {
              type: "failed";
            }
        >;
      }
  >;
};

export type Message = {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: {
    created: number;
    completed?: number;
  };
  [key: string]: any;
};

export type Part = {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  [key: string]: any;
};

export type UserMessage = Message & {
  role: "user";
  summary?: {
    title?: string;
    body?: string;
    diffs: any[];
  };
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
  system?: string;
  tools?: Record<string, boolean>;
};

export type Project = {
  id: string;
  worktree: string;
  vcsDir?: string;
  vcs?: "git";
  time: {
    created: number;
    initialized?: number;
  };
};

export type Provider = {
  id: string;
  name: string;
  source: "env" | "config" | "custom" | "api";
  env: string[];
  key?: string;
  options: Record<string, any>;
  models: Record<string, any>;
};

export type Config = Record<string, any>;

export type Permission = {
  id: string;
  type: string;
  pattern?: string | string[];
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: Record<string, any>;
  time: {
    created: number;
  };
};

export type Model = {
  id: string;
  providerID: string;
  api: {
    id: string;
    url: string;
    npm: string;
  };
  name: string;
  capabilities: {
    temperature: boolean;
    reasoning: boolean;
    attachment: boolean;
    toolcall: boolean;
    input: Record<string, boolean>;
    output: Record<string, boolean>;
  };
  cost: {
    input: number;
    output: number;
    cache: {
      read: number;
      write: number;
    };
  };
  limit: {
    context: number;
    output: number;
  };
  status: "alpha" | "beta" | "deprecated" | "active";
  options: Record<string, any>;
  headers: Record<string, string>;
};

export interface Hooks {
  event?: (input: { event: any }) => Promise<void>;
  config?: (input: Config) => Promise<void>;
  tool?: Record<string, any>;
  auth?: AuthHook;
  "chat.message"?: (
    input: {
      sessionID: string;
      agent?: string;
      model?: {
        providerID: string;
        modelID: string;
      };
      messageID?: string;
      variant?: string;
    },
    output: {
      message: UserMessage;
      parts: Part[];
    },
  ) => Promise<void>;
  "chat.params"?: (
    input: {
      sessionID: string;
      agent: string;
      model: Model;
      provider: ProviderContext;
      message: UserMessage;
    },
    output: {
      temperature: number;
      topP: number;
      topK: number;
      options: Record<string, any>;
    },
  ) => Promise<void>;
  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>;
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>;
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>;
  "experimental.chat.messages.transform"?: (
    input: {},
    output: {
      messages: Array<{
        info: Message;
        parts: Part[];
      }>;
    },
  ) => Promise<void>;
  "experimental.chat.system.transform"?: (
    input: {},
    output: { system: string[] },
  ) => Promise<void>;
  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>;
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>;
}
