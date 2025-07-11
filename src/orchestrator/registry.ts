/**
 * @fileoverview Agent registry for orchestrator
 * Manages agent pool, discovery, and health monitoring
 */

import { pipe } from '../types/index.js';
import { EitherM, Maybe } from '../types/utils.js';
import type { 
  Either, 
  Option,
  ReadonlyRecord 
} from '../types/index.js';
import type {
  Agent,
  AgentType,
  AgentStatus,
  AgentCapability,
  OrchestratorEvent
} from './types.js';
import { SeiAgentKitAdapter } from '../agents/adapters/SeiAgentKitAdapter.js';
import { HiveIntelligenceAdapter } from '../agents/adapters/HiveIntelligenceAdapter.js';
import { SeiMCPAdapter } from '../agents/adapters/SeiMCPAdapter.js';

/**
 * Agent registry state
 */
interface AgentRegistryState {
  readonly agents: ReadonlyRecord<string, Agent>;
  readonly healthChecks: ReadonlyRecord<string, HealthCheckResult>;
  readonly capabilities: ReadonlyRecord<string, ReadonlyArray<AgentCapability>>;
  readonly loadMetrics: ReadonlyRecord<string, LoadMetrics>;
  readonly adapters: ReadonlyRecord<string, AdapterInstance>;
}

/**
 * Adapter instance information
 */
interface AdapterInstance {
  readonly id: string;
  readonly type: 'seiAgentKit' | 'hiveIntelligence' | 'seiMCP';
  readonly instance: SeiAgentKitAdapter | HiveIntelligenceAdapter | SeiMCPAdapter;
  readonly capabilities: ReadonlyArray<string>;
  readonly status: 'active' | 'inactive' | 'error';
  readonly lastHealthCheck: number;
  readonly priority: number;
}

interface HealthCheckResult {
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly lastCheck: number;
  readonly responseTime: number;
  readonly consecutiveFailures: number;
}

interface LoadMetrics {
  readonly agentId: string;
  readonly activeTasks: number;
  readonly completedTasks: number;
  readonly averageResponseTime: number;
  readonly errorRate: number;
  readonly lastUpdated: number;
}

/**
 * Agent registry configuration
 */
export interface AgentRegistryConfig {
  readonly healthCheckInterval: number;
  readonly maxConsecutiveFailures: number;
  readonly responseTimeoutMs: number;
  readonly loadBalancingWeights: ReadonlyRecord<string, number>;
  readonly adapterConfig: {
    enableLoadBalancing: boolean;
    maxAdaptersPerType: number;
    healthCheckTimeoutMs: number;
    failoverEnabled: boolean;
  };
}

/**
 * Agent registry implementation
 */
export class AgentRegistry {
  private state: AgentRegistryState;
  private config: AgentRegistryConfig;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: AgentRegistryConfig) {
    this.config = config;
    this.state = {
      agents: {},
      healthChecks: {},
      capabilities: {},
      loadMetrics: {},
      adapters: {}
    };
  }

  /**
   * Register a new agent
   */
  public registerAgent = (agent: Agent): Either<string, void> =>
    pipe(
      this.validateAgent(agent),
      EitherM.map(() => {
        this.state = {
          ...this.state,
          agents: { ...this.state.agents, [agent.id]: agent },
          capabilities: { 
            ...this.state.capabilities, 
            [agent.id]: agent.capabilities 
          },
          loadMetrics: {
            ...this.state.loadMetrics,
            [agent.id]: this.createInitialLoadMetrics(agent.id)
          }
        };
      })
    );

  /**
   * Unregister an agent
   */
  public unregisterAgent = (agentId: string): Either<string, void> =>
    this.getAgent(agentId)._tag === 'None'
      ? EitherM.left(`Agent ${agentId} not found`)
      : EitherM.right((() => {
          const { [agentId]: removed, ...remainingAgents } = this.state.agents;
          const { [agentId]: removedHealth, ...remainingHealth } = this.state.healthChecks;
          const { [agentId]: removedCaps, ...remainingCaps } = this.state.capabilities;
          const { [agentId]: removedMetrics, ...remainingMetrics } = this.state.loadMetrics;
          
          this.state = {
            agents: remainingAgents,
            healthChecks: remainingHealth,
            capabilities: remainingCaps,
            loadMetrics: remainingMetrics
          };
        })());

  /**
   * Get agent by ID
   */
  public getAgent = (agentId: string): Option<Agent> =>
    Maybe.fromNullable(this.state.agents[agentId]);

  /**
   * Get all agents
   */
  public getAllAgents = (): ReadonlyArray<Agent> =>
    Object.values(this.state.agents);

  /**
   * Get agents by type
   */
  public getAgentsByType = (type: AgentType): ReadonlyArray<Agent> =>
    this.getAllAgents().filter(agent => agent.type === type);

  /**
   * Get healthy agents
   */
  public getHealthyAgents = (): ReadonlyArray<Agent> =>
    this.getAllAgents().filter(agent => 
      this.isAgentHealthy(agent.id)
    );

  /**
   * Get agents by capability
   */
  public getAgentsByCapability = (action: string): ReadonlyArray<Agent> =>
    this.getAllAgents().filter(agent =>
      this.state.capabilities[agent.id]?.some(cap => cap.action === action) ?? false
    );

  /**
   * Find best agent for task
   */
  public findBestAgent = (
    type: AgentType,
    action: string,
    parameters: ReadonlyRecord<string, unknown>
  ): Option<Agent> => {
    const candidates = this.getHealthyAgents()
      .filter(agent => agent.type === type)
      .filter(agent => this.hasCapability(agent.id, action))
      .filter(agent => this.canHandleParameters(agent.id, action, parameters));

    if (candidates.length === 0) {
      return Maybe.none();
    }

    // Select based on load balancing strategy
    const best = candidates.reduce((best, current) => 
      this.compareAgentLoad(best.id, current.id) <= 0 ? best : current
    );

    return Maybe.some(best);
  };

  /**
   * Update agent status
   */
  public updateAgentStatus = (agentId: string, status: AgentStatus): Either<string, void> =>
    pipe(
      this.getAgent(agentId),
      Maybe.fold(
        () => EitherM.left(`Agent ${agentId} not found`),
        (agent) => EitherM.right((() => {
          this.state = {
            ...this.state,
            agents: {
              ...this.state.agents,
              [agentId]: { ...agent, status }
            }
          };
        })())
      )
    );

  /**
   * Start health monitoring
   */
  public startHealthMonitoring = (): void => {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckInterval
    );
  };

  /**
   * Stop health monitoring
   */
  public stopHealthMonitoring = (): void => {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  };

  /**
   * Get agent load metrics
   */
  public getLoadMetrics = (agentId: string): Option<LoadMetrics> =>
    Maybe.fromNullable(this.state.loadMetrics[agentId]);

  /**
   * Update load metrics
   */
  public updateLoadMetrics = (
    agentId: string, 
    update: Partial<LoadMetrics>
  ): Either<string, void> =>
    pipe(
      this.getLoadMetrics(agentId),
      Maybe.fold(
        () => EitherM.left(`Load metrics not found for agent ${agentId}`),
        (metrics) => EitherM.right((() => {
          this.state = {
            ...this.state,
            loadMetrics: {
              ...this.state.loadMetrics,
              [agentId]: { ...metrics, ...update, lastUpdated: Date.now() }
            }
          };
        })())
      )
    );

  // ============================================================================
  // Adapter Management Methods
  // ============================================================================

  /**
   * Register an adapter instance
   */
  public registerAdapter = (
    id: string,
    type: 'seiAgentKit' | 'hiveIntelligence' | 'seiMCP',
    instance: SeiAgentKitAdapter | HiveIntelligenceAdapter | SeiMCPAdapter,
    capabilities: ReadonlyArray<string>,
    priority: number = 1
  ): Either<string, void> => {
    try {
      if (this.state.adapters[id]) {
        return EitherM.left(`Adapter ${id} already registered`);
      }

      // Check if we've reached max adapters of this type
      const adaptersOfType = Object.values(this.state.adapters)
        .filter(adapter => adapter.type === type);
      
      if (adaptersOfType.length >= this.config.adapterConfig.maxAdaptersPerType) {
        return EitherM.left(`Maximum number of ${type} adapters reached`);
      }

      const adapterInstance: AdapterInstance = {
        id,
        type,
        instance,
        capabilities,
        status: 'active',
        lastHealthCheck: Date.now(),
        priority
      };

      this.state = {
        ...this.state,
        adapters: { ...this.state.adapters, [id]: adapterInstance }
      };

      return EitherM.right(undefined);
    } catch (error) {
      return EitherM.left(`Failed to register adapter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  /**
   * Unregister an adapter
   */
  public unregisterAdapter = (id: string): Either<string, void> => {
    if (!this.state.adapters[id]) {
      return EitherM.left(`Adapter ${id} not found`);
    }

    const { [id]: removed, ...remainingAdapters } = this.state.adapters;
    this.state = {
      ...this.state,
      adapters: remainingAdapters
    };

    return EitherM.right(undefined);
  };

  /**
   * Get adapter by ID
   */
  public getAdapter = (id: string): Option<AdapterInstance> =>
    Maybe.fromNullable(this.state.adapters[id]);

  /**
   * Get all adapters
   */
  public getAllAdapters = (): ReadonlyArray<AdapterInstance> =>
    Object.values(this.state.adapters);

  /**
   * Get adapters by type
   */
  public getAdaptersByType = (type: 'seiAgentKit' | 'hiveIntelligence' | 'seiMCP'): ReadonlyArray<AdapterInstance> =>
    this.getAllAdapters().filter(adapter => adapter.type === type);

  /**
   * Get healthy adapters
   */
  public getHealthyAdapters = (): ReadonlyArray<AdapterInstance> =>
    this.getAllAdapters().filter(adapter => adapter.status === 'active');

  /**
   * Get adapters by capability
   */
  public getAdaptersByCapability = (capability: string): ReadonlyArray<AdapterInstance> =>
    this.getAllAdapters().filter(adapter =>
      adapter.capabilities.includes(capability)
    );

  /**
   * Find best adapter for capability with load balancing
   */
  public findBestAdapter = (
    capability: string,
    preferredType?: 'seiAgentKit' | 'hiveIntelligence' | 'seiMCP'
  ): Option<AdapterInstance> => {
    let candidates = this.getHealthyAdapters()
      .filter(adapter => adapter.capabilities.includes(capability));

    // Filter by preferred type if specified
    if (preferredType) {
      const preferredCandidates = candidates.filter(adapter => adapter.type === preferredType);
      if (preferredCandidates.length > 0) {
        candidates = preferredCandidates;
      }
    }

    if (candidates.length === 0) {
      return Maybe.none();
    }

    // Load balancing: select based on priority and last usage
    if (this.config.adapterConfig.enableLoadBalancing) {
      candidates.sort((a, b) => {
        // Higher priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by least recently used
        return a.lastHealthCheck - b.lastHealthCheck;
      });
    }

    return Maybe.some(candidates[0]);
  };

  /**
   * Update adapter status
   */
  public updateAdapterStatus = (
    id: string,
    status: 'active' | 'inactive' | 'error'
  ): Either<string, void> =>
    pipe(
      this.getAdapter(id),
      Maybe.fold(
        () => EitherM.left(`Adapter ${id} not found`),
        (adapter) => EitherM.right((() => {
          this.state = {
            ...this.state,
            adapters: {
              ...this.state.adapters,
              [id]: { ...adapter, status, lastHealthCheck: Date.now() }
            }
          };
        })())
      )
    );

  /**
   * Get adapter load balancing information
   */
  public getAdapterLoadInfo = (): ReadonlyRecord<string, {
    adaptersCount: number;
    healthyCount: number;
    capabilities: ReadonlyArray<string>;
  }> => {
    const loadInfo: Record<string, {
      adaptersCount: number;
      healthyCount: number;
      capabilities: ReadonlyArray<string>;
    }> = {};

    const adapterTypes = ['seiAgentKit', 'hiveIntelligence', 'seiMCP'] as const;
    
    adapterTypes.forEach(type => {
      const adapters = this.getAdaptersByType(type);
      const healthy = adapters.filter(a => a.status === 'active');
      const allCapabilities = [...new Set(adapters.flatMap(a => a.capabilities))];
      
      loadInfo[type] = {
        adaptersCount: adapters.length,
        healthyCount: healthy.length,
        capabilities: allCapabilities
      };
    });

    return loadInfo;
  };

  /**
   * Perform health checks on adapters
   */
  public performAdapterHealthChecks = async (): Promise<void> => {
    const adapters = this.getAllAdapters();
    
    for (const adapter of adapters) {
      try {
        const isHealthy = await this.checkAdapterHealth(adapter);
        const newStatus = isHealthy ? 'active' : 'error';
        
        if (adapter.status !== newStatus) {
          this.updateAdapterStatus(adapter.id, newStatus);
        }
      } catch (error) {
        console.error(`Health check failed for adapter ${adapter.id}:`, error);
        this.updateAdapterStatus(adapter.id, 'error');
      }
    }
  };

  // Private helper methods

  private validateAgent = (agent: Agent): Either<string, Agent> => {
    if (!agent.id || agent.id.trim() === '') {
      return EitherM.left('Agent ID is required');
    }
    if (this.state.agents[agent.id]) {
      return EitherM.left(`Agent ${agent.id} already registered`);
    }
    if (agent.capabilities.length === 0) {
      return EitherM.left('Agent must have at least one capability');
    }
    return EitherM.right(agent);
  };

  private createInitialLoadMetrics = (agentId: string): LoadMetrics => ({
    agentId,
    activeTasks: 0,
    completedTasks: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastUpdated: Date.now()
  });

  private isAgentHealthy = (agentId: string): boolean => {
    const healthCheck = this.state.healthChecks[agentId];
    if (!healthCheck) return true; // Assume healthy if no health check yet
    
    return healthCheck.status !== 'error' && 
           healthCheck.status !== 'offline' &&
           healthCheck.consecutiveFailures < this.config.maxConsecutiveFailures;
  };

  private hasCapability = (agentId: string, action: string): boolean =>
    this.state.capabilities[agentId]?.some(cap => cap.action === action) ?? false;

  private canHandleParameters = (
    agentId: string, 
    action: string, 
    parameters: ReadonlyRecord<string, unknown>
  ): boolean => {
    const capability = this.state.capabilities[agentId]
      ?.find(cap => cap.action === action);
    
    if (!capability) return false;

    // Validate required parameters are present
    const requiredParams = capability.parameters.filter(p => p.required);
    return requiredParams.every(param => 
      parameters[param.name] !== undefined && parameters[param.name] !== null
    );
  };

  private compareAgentLoad = (agentId1: string, agentId2: string): number => {
    const metrics1 = this.state.loadMetrics[agentId1];
    const metrics2 = this.state.loadMetrics[agentId2];
    
    if (!metrics1 || !metrics2) return 0;

    // Simple load comparison: fewer active tasks is better
    const loadDiff = metrics1.activeTasks - metrics2.activeTasks;
    if (loadDiff !== 0) return loadDiff;

    // Secondary: better response time is better
    return metrics1.averageResponseTime - metrics2.averageResponseTime;
  };

  private performHealthChecks = async (): Promise<void> => {
    // Check agents
    const agents = this.getAllAgents();
    
    for (const agent of agents) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.checkAgentHealth(agent);
        const responseTime = Date.now() - startTime;
        
        const previousCheck = this.state.healthChecks[agent.id];
        const consecutiveFailures = isHealthy 
          ? 0 
          : (previousCheck?.consecutiveFailures ?? 0) + 1;
        
        this.state = {
          ...this.state,
          healthChecks: {
            ...this.state.healthChecks,
            [agent.id]: {
              agentId: agent.id,
              status: isHealthy ? 'idle' : 'error',
              lastCheck: Date.now(),
              responseTime,
              consecutiveFailures
            }
          }
        };

        // Update agent status if health changed
        if (!isHealthy && consecutiveFailures >= this.config.maxConsecutiveFailures) {
          this.updateAgentStatus(agent.id, 'offline');
        }
      } catch (error) {
        // Health check failed
        const previousCheck = this.state.healthChecks[agent.id];
        this.state = {
          ...this.state,
          healthChecks: {
            ...this.state.healthChecks,
            [agent.id]: {
              agentId: agent.id,
              status: 'error',
              lastCheck: Date.now(),
              responseTime: this.config.responseTimeoutMs,
              consecutiveFailures: (previousCheck?.consecutiveFailures ?? 0) + 1
            }
          }
        };
      }
    }

    // Check adapters
    await this.performAdapterHealthChecks();
  };

  private checkAgentHealth = async (agent: Agent): Promise<boolean> => {
    // In a real implementation, this would ping the agent's health endpoint
    // For now, we'll simulate based on agent status
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(agent.status !== 'error' && agent.status !== 'offline');
      }, Math.random() * 100); // Simulate network delay
    });
  };

  /**
   * Check adapter health
   */
  private checkAdapterHealth = async (adapter: AdapterInstance): Promise<boolean> => {
    try {
      // Attempt a simple health check based on adapter type
      switch (adapter.type) {
        case 'seiAgentKit':
          // Check if SAK adapter is responsive
          const sakAdapter = adapter.instance as SeiAgentKitAdapter;
          // In a real implementation, this would call a health check method
          return sakAdapter.getConfig() !== undefined;
          
        case 'hiveIntelligence':
          // Check if Hive adapter is responsive
          const hiveAdapter = adapter.instance as HiveIntelligenceAdapter;
          // In a real implementation, this would ping the API
          return hiveAdapter.getConfig() !== undefined;
          
        case 'seiMCP':
          // Check if MCP adapter connection is active
          const mcpAdapter = adapter.instance as SeiMCPAdapter;
          // In a real implementation, this would check WebSocket connection
          return mcpAdapter.getConfig() !== undefined;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`Health check failed for adapter ${adapter.id}:`, error);
      return false;
    }
  };
}