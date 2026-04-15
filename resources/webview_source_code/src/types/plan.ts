import { ChatMessage } from "../services";

// === 基础联合类型定义 ===
export type PlanStatus =
	| 'off'
	| 'draft'
	| 'pending_approval'
	| 'approved'
	| 'executing'
	| 'completed'
	| 'rejected'
	| 'cancelled';

type PlanMode = 'auto' | 'manual' | 'strict';

export type Priority = 'high' | 'medium' | 'low';

export type TaskStatus =
	| 'pending'
	| 'in_progress'
	| 'completed'
	| 'failed'
	| 'skipped';

// type RiskLevel = 'low' | 'medium' | 'high' | 'critical'; // 暂时注释掉，简化前期实现

// === 基础值类型 ===
type ToolParameterValue = string | number | boolean | ReadonlyArray<string>;

type TaskOutput = string | {
	readonly content: string;
	readonly type: 'text' | 'json' | 'file';
	readonly metadata?: Record<string, string | number | boolean>;
};

// === 工具调用相关接口 ===
interface ToolParameter {
	readonly name: string;
	readonly value: ToolParameterValue;
	readonly type: 'string' | 'number' | 'boolean' | 'array';
	readonly description?: string;
}

interface PlannedToolCall {
	readonly toolName: string;
	readonly parameters: ReadonlyArray<ToolParameter>;
	readonly requiredApproval: boolean;
	// readonly riskLevel: RiskLevel; // 暂时注释掉，简化前期实现
	readonly alternativeActions: ReadonlyArray<string>;
	// readonly estimatedDuration?: number; // 暂时注释掉，简化前期实现
	readonly description?: string;
}

// === 任务执行结果 ===
interface TaskResult {
	readonly toolCallId: string;
	readonly success: boolean;
	readonly output: TaskOutput;
	readonly error?: string;
	readonly duration?: number;
	readonly timestamp: Date;
	readonly metadata: Record<string, string | number | boolean>;
}

interface RollbackInfo {
	readonly canRollback: boolean;
	readonly checkpointId?: string;
	readonly affectedFiles: ReadonlyArray<string>;
	readonly createdAt: Date;
}

// === 主要任务接口 ===
interface PlanTask {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly status: TaskStatus;
	// readonly estimatedDuration?: number; // 暂时注释掉，简化前期实现
	// readonly actualDuration?: number; // 暂时注释掉，简化前期实现
	readonly toolCalls: ReadonlyArray<PlannedToolCall>;
	readonly results: ReadonlyArray<TaskResult>;
	readonly rollbackInfo?: RollbackInfo;
	readonly priority: Priority; // 任务优先级
	readonly tags: ReadonlyArray<string>;
}

// === 主要的ExtendedPlanData接口 ===
export interface ExtendedPlanData {
	// 基本信息
	readonly id: string;
	readonly version: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly lastModifiedBy: string;

	// 计划内容
	readonly title: string;
	readonly description: string;
	readonly originalPrompt: ChatMessage['content'];
	readonly summary: string;
	readonly tags: ReadonlyArray<string>;

	// 状态管理
	readonly status: PlanStatus;
	readonly mode: PlanMode;

	// 任务分解
	readonly tasks: ReadonlyArray<PlanTask>;
	readonly currentTaskIndex: number;
	readonly totalTasks: number;
	readonly completedTasks: number;

}