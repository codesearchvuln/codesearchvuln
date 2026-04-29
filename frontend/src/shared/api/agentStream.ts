export type StreamEventType =
    | 'thinking'
  | 'thinking_start'
  | 'thinking_token'
  | 'thinking_end'
    | 'tool_call_start'
  | 'tool_call_input'
  | 'tool_call_output'
  | 'tool_call_end'
  | 'tool_call_error'
  | 'tool_call'
  | 'tool_result'
    | 'node_start'
  | 'node_end'
    | 'phase_start'
  | 'phase_end'
  | 'phase_complete'
    | 'finding'
  | 'finding_new'
  | 'finding_update'
  | 'finding_verified'
    | 'progress'
  | 'info'
  | 'warning'
  | 'error'
    | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'task_cancel'
  | 'task_end'
    | 'heartbeat';

export interface ToolCallDetail {
  name: string;
  input?: Record<string, unknown>;
  output?: unknown;
  duration_ms?: number;
}

export interface StreamEventData {
  id?: string;
  type: StreamEventType;
  phase?: string;
  message?: string;
  sequence?: number;
  timestamp?: string;
  tool?: ToolCallDetail;
  metadata?: Record<string, unknown>;
  tokens_used?: number;
    token?: string;
  accumulated?: string;
  status?: string;
  error?: string;
  findings_count?: number;
  security_score?: number;
    tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: unknown;
  tool_duration_ms?: number;
  agent_name?: string;
}

export type StreamEventCallback = (event: StreamEventData) => void;

export interface StreamErrorContext {
  source: 'event' | 'transport' | 'stream_end';
  terminal: boolean;
  eventType?: 'error' | 'task_error';
  metadata?: Record<string, unknown>;
}

export interface StreamOptions {
  includeThinking?: boolean;
  includeToolCalls?: boolean;
  afterSequence?: number;
  onThinkingStart?: () => void;
  onThinkingToken?: (token: string, accumulated: string) => void;
  onThinkingEnd?: (fullResponse: string) => void;
  onToolStart?: (toolName: string, input: Record<string, unknown>) => void;
  onToolEnd?: (toolName: string, output: unknown, durationMs: number) => void;
  onNodeStart?: (nodeName: string, phase: string) => void;
  onNodeEnd?: (nodeName: string, summary: Record<string, unknown>) => void;
  onFinding?: (finding: Record<string, unknown>, isVerified: boolean) => void;
  onProgress?: (current: number, total: number, message: string) => void;
  onComplete?: (data: { findingsCount: number; securityScore: number }) => void;
  onError?: (error: string, context: StreamErrorContext) => void;
  onHeartbeat?: () => void;
  onEvent?: StreamEventCallback;
  onConnectionStateChange?: (
    connected: boolean,
    context: { reason: "connected" | "transport_error" | "stream_end" | "disconnect" },
  ) => void;
}

export class AgentStreamHandler {
  private taskId: string;
  private eventSource: EventSource | null = null;
  private options: StreamOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private thinkingBuffer: string[] = [];
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private abortController: AbortController | null = null;
  private isDisconnecting = false;
  private terminalEventReceived = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(taskId: string, options: StreamOptions = {}) {
    this.taskId = taskId;
    this.options = {
      includeThinking: true,
      includeToolCalls: true,
      afterSequence: 0,
      ...options,
    };
  }

    connect(): void {
        this.isDisconnecting = false;
    this.terminalEventReceived = false;
    this.clearReconnectTimeout();

        if (this.isConnected) {
      return;
    }

    const params = new URLSearchParams({
      include_thinking: String(this.options.includeThinking),
      include_tool_calls: String(this.options.includeToolCalls),
      after_sequence: String(this.options.afterSequence),
    });

    this.connectWithFetch(params);
  }

  private bumpAfterSequence(sequence: unknown): void {
    const seq = typeof sequence === 'number' ? sequence : Number(sequence);
    if (!Number.isFinite(seq)) return;
    const normalized = Math.floor(seq);
    const current =
      typeof this.options.afterSequence === 'number'
        ? this.options.afterSequence
        : Number(this.options.afterSequence || 0);
    if (!Number.isFinite(current) || normalized > current) {
      this.options.afterSequence = normalized;
    }
  }

  private scheduleReconnect(
    source: 'transport' | 'stream_end',
    failureMessage: string
  ): void {
    if (this.isDisconnecting || this.terminalEventReceived) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts += 1;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      this.isConnected = false;
      this.options.onConnectionStateChange?.(false, {
        reason: source === "transport" ? "transport_error" : "stream_end",
      });
      if (source === 'stream_end') {
        console.info('[AgentStream] stream_done_reconnect', {
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
          delayMs: delay,
        });
      } else {
        console.warn('[AgentStream] transport_reconnect', {
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
          delayMs: delay,
        });
      }
      this.clearReconnectTimeout();
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null;
        if (!this.isDisconnecting && !this.terminalEventReceived) {
          this.connect();
        }
      }, delay);
      return;
    }

    this.isConnected = false;
    this.options.onConnectionStateChange?.(false, {
      reason: source === "transport" ? "transport_error" : "stream_end",
    });
    if (source === 'transport') {
      console.error('[AgentStream] transport_reconnect_exhausted', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
    } else {
      console.error('[AgentStream] stream_end_reconnect_exhausted', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
    }
    this.options.onError?.(failureMessage, {
      source,
      terminal: false,
    });
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId === null) {
      return;
    }
    clearTimeout(this.reconnectTimeoutId);
    this.reconnectTimeoutId = null;
  }

    private async connectWithFetch(params: URLSearchParams): Promise<void> {
        if (this.isDisconnecting) {
      return;
    }

    const url = `/api/v1/agent-tasks/${this.taskId}/stream?${params}`;

        this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/event-stream',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.isConnected = true;
      this.options.onConnectionStateChange?.(true, { reason: 'connected' });
      this.reconnectAttempts = 0;

      this.reader = response.body?.getReader() || null;
      if (!this.reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
                if (this.isDisconnecting) {
          console.log('[AgentStream] Disconnecting, breaking loop');
          break;
        }

        const { done, value } = await this.reader.read();

        if (done) {
          console.log('[AgentStream] Reader done, stream ended');
          this.isConnected = false;
          this.options.onConnectionStateChange?.(false, { reason: 'stream_end' });
          this.scheduleReconnect(
            'stream_end',
            '事件流连接中断，自动重连失败'
          );
          break;
        }

        buffer += decoder.decode(value, { stream: true });

                const events = this.parseSSE(buffer);
        buffer = events.remaining;

                if (events.parsed.length > 0) {
          const eventTypes = events.parsed.map(e => e.type);
          console.log(`[AgentStream] Received ${events.parsed.length} events:`, eventTypes);
        }

                for (const event of events.parsed) {
          this.bumpAfterSequence(event.sequence);
          this.handleEvent(event);
                    if (event.type === 'thinking_token') {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
      }

            if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    } catch (error: any) {
            if (error.name === 'AbortError') {
        return;
      }

      this.isConnected = false;
      this.options.onConnectionStateChange?.(false, { reason: 'transport_error' });
      console.error('Stream connection error:', error);
      const message = error instanceof Error ? error.message : String(error);
      this.scheduleReconnect('transport', `连接失败: ${message}`);
    } finally {
            if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
                  }
        this.reader = null;
      }
    }
  }

    private parseSSE(buffer: string): { parsed: StreamEventData[]; remaining: string } {
    const parsed: StreamEventData[] = [];
    const lines = buffer.split('\n');
    let remaining = '';
    let currentEvent: Partial<StreamEventData> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

            if (line === '') {
        if (currentEvent.type) {
          parsed.push(currentEvent as StreamEventData);
          currentEvent = {};
        }
        continue;
      }

            if (i === lines.length - 1 && !buffer.endsWith('\n')) {
        remaining = line;
        break;
      }

            if (line.startsWith('event:')) {
        currentEvent.type = line.slice(6).trim() as StreamEventType;
      }
            else if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          currentEvent = { ...currentEvent, ...data };
        } catch {
                  }
      }
    }

    return { parsed, remaining };
  }

    private handleEvent(event: StreamEventData): void {
        if (event.metadata?.agent_name && !event.agent_name) {
      event.agent_name = event.metadata.agent_name as string;
    }

        this.options.onEvent?.(event);

        switch (event.type) {
            case 'thinking_start':
        this.thinkingBuffer = [];
        this.options.onThinkingStart?.();
        break;

      case 'thinking_token':
                const token = event.token || (event.metadata?.token as string);
        const accumulated = event.accumulated || (event.metadata?.accumulated as string);

        if (token) {
          this.thinkingBuffer.push(token);
          this.options.onThinkingToken?.(
            token,
            accumulated || this.thinkingBuffer.join('')
          );
        }
        break;

      case 'thinking_end':
        const fullResponse = event.accumulated || (event.metadata?.accumulated as string) || this.thinkingBuffer.join('');
        this.thinkingBuffer = [];
        this.options.onThinkingEnd?.(fullResponse);
        break;

            case 'tool_call_start':
        if (event.tool) {
          this.options.onToolStart?.(
            event.tool.name,
            event.tool.input || {}
          );
        }
        break;

      case 'tool_call_end':
        if (event.tool) {
          this.options.onToolEnd?.(
            event.tool.name,
            event.tool.output,
            event.tool.duration_ms || 0
          );
        }
        break;

            case 'tool_call':
        this.options.onToolStart?.(
          event.tool_name || 'unknown',
          event.tool_input || {}
        );
        break;

      case 'tool_result':
        this.options.onToolEnd?.(
          event.tool_name || 'unknown',
          event.tool_output,
          event.tool_duration_ms || 0
        );
        break;

            case 'node_start':
        this.options.onNodeStart?.(
          event.metadata?.node as string || 'unknown',
          event.phase || ''
        );
        break;

      case 'node_end':
        this.options.onNodeEnd?.(
          event.metadata?.node as string || 'unknown',
          event.metadata?.summary as Record<string, unknown> || {}
        );
        break;

            case 'finding':
      case 'finding_new':
      case 'finding_update':
      case 'finding_verified':
        this.options.onFinding?.(
          event.metadata || {},
          event.type === 'finding_verified' || event.metadata?.is_verified === true
        );
        break;

            case 'progress':
        this.options.onProgress?.(
          event.metadata?.current as number || 0,
          event.metadata?.total as number || 100,
          event.message || ''
        );
        break;

            case 'task_complete':
      case 'task_end':
        if (event.status !== 'cancelled' && event.status !== 'failed') {
          this.options.onComplete?.({
            findingsCount: event.findings_count || event.metadata?.findings_count as number || 0,
            securityScore: event.security_score || event.metadata?.security_score as number || 100,
          });
        }
        this.disconnect();
        break;

            case 'task_error': {
        const errorMessage = event.error || event.message || '未知错误';
        this.terminalEventReceived = true;
        console.error('[AgentStream] terminal_error', {
          eventType: 'task_error',
          message: errorMessage,
          metadata: event.metadata,
        });
        this.options.onError?.(errorMessage, {
          source: 'event',
          terminal: true,
          eventType: 'task_error',
          metadata: event.metadata,
        });
        this.disconnect();
        break;
      }

      case 'error': {
        const errorMessage = event.error || event.message || '未知错误';
        const terminalFromMetadata =
          event.metadata?.is_terminal === true ||
          String(event.metadata?.is_terminal || '').toLowerCase() === 'true';
        if (terminalFromMetadata) {
          this.terminalEventReceived = true;
          console.error('[AgentStream] terminal_error', {
            eventType: 'error',
            message: errorMessage,
            metadata: event.metadata,
          });
          this.options.onError?.(errorMessage, {
            source: 'event',
            terminal: true,
            eventType: 'error',
            metadata: event.metadata,
          });
          this.disconnect();
          break;
        }
        console.warn('[AgentStream] non_terminal_error', {
          eventType: 'error',
          message: errorMessage,
          metadata: event.metadata,
        });
        this.options.onError?.(errorMessage, {
          source: 'event',
          terminal: false,
          eventType: 'error',
          metadata: event.metadata,
        });
        break;
      }

            case 'heartbeat':
        this.options.onHeartbeat?.();
        break;
    }
  }

    disconnect(): void {
        this.isDisconnecting = true;
    this.isConnected = false;
    this.options.onConnectionStateChange?.(false, { reason: 'disconnect' });
    this.clearReconnectTimeout();

        if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
              }
      this.abortController = null;
    }

        if (this.reader) {
      const reader = this.reader;
      this.reader = null;

                  Promise.resolve().then(() => {
        try {
                    reader.cancel().catch(() => {
                      }).finally(() => {
            try {
              reader.releaseLock();
            } catch {
                          }
          });
        } catch {
                  }
      });
    }

        if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

        this.reconnectAttempts = 0;
  }

    get connected(): boolean {
    return this.isConnected;
  }
}

export function createAgentStream(
  taskId: string,
  options: StreamOptions = {}
): AgentStreamHandler {
  return new AgentStreamHandler(taskId, options);
}

export interface AgentStreamState {
  events: StreamEventData[];
  thinking: string;
  isThinking: boolean;
  thinkingAgent?: string;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
    status: 'running' | 'success' | 'error';
  }>;
  currentPhase: string;
  progress: { current: number; total: number; percentage: number };
  findings: Array<Record<string, unknown>>;
  isComplete: boolean;
  error: string | null;
}

export function createAgentStreamWithState(
  taskId: string,
  onStateChange: (state: AgentStreamState) => void
): AgentStreamHandler {
  const state: AgentStreamState = {
    events: [],
    thinking: '',
    isThinking: false,
    thinkingAgent: undefined,
    toolCalls: [],
    currentPhase: '',
    progress: { current: 0, total: 100, percentage: 0 },
    findings: [],
    isComplete: false,
    error: null,
  };

  const updateState = (updates: Partial<AgentStreamState>) => {
    Object.assign(state, updates);
    onStateChange({ ...state });
  };

  return new AgentStreamHandler(taskId, {
    onEvent: (event) => {
      const updates: Partial<AgentStreamState> = {
        events: [...state.events, event].slice(-500),
      };

            if (event.agent_name && (event.type === 'thinking' || event.type === 'thinking_start' || event.type === 'thinking_token')) {
        updates.thinkingAgent = event.agent_name;
      }

      updateState(updates);
    },
    onThinkingStart: () => {
      updateState({ isThinking: true, thinking: '' });
    },
    onThinkingToken: (_, accumulated) => {
      updateState({ thinking: accumulated });
    },
    onThinkingEnd: (response) => {
      updateState({ isThinking: false, thinking: response });
    },
    onToolStart: (name, input) => {
      updateState({
        toolCalls: [
          ...state.toolCalls,
          { name, input, status: 'running' },
        ],
      });
    },
    onToolEnd: (name, output, durationMs) => {
      updateState({
        toolCalls: state.toolCalls.map((tc) =>
          tc.name === name && tc.status === 'running'
            ? { ...tc, output, durationMs, status: 'success' as const }
            : tc
        ),
      });
    },
    onNodeStart: (_, phase) => {
      updateState({ currentPhase: phase });
    },
    onProgress: (current, total, _) => {
      updateState({
        progress: {
          current,
          total,
          percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        },
      });
    },
    onFinding: (finding, _) => {
      updateState({
        findings: [...state.findings, finding],
      });
    },
    onComplete: () => {
      updateState({ isComplete: true });
    },
    onError: (error, context) => {
      const updates: Partial<AgentStreamState> = { error };
      if (context.terminal) {
        updates.isComplete = true;
      }
      updateState(updates);
    },
  });
}
