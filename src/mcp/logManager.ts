import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tools from '../tools';

/**
 * 日志管理器
 * 支持日志文件轮转，最多保留 5 个日志文件
 */
export class LogManager {
    private static readonly MAX_LOG_FILES = 5;
    private static readonly LOG_DIR = path.join(os.tmpdir(), 'y3-helper-logs');

    private logFilePath: string;
    private writeStream: fs.WriteStream;
    private maxLines: number = 10000;  // 单个文件最大行数

    constructor(sessionId: string) {
        // 确保日志目录存在
        if (!fs.existsSync(LogManager.LOG_DIR)) {
            fs.mkdirSync(LogManager.LOG_DIR, { recursive: true });
        }

        // 清理旧日志文件
        this.cleanupOldLogs();

        // 创建新日志文件
        const timestamp = Date.now();
        this.logFilePath = path.join(
            LogManager.LOG_DIR,
            `session-${sessionId}-${timestamp}.log`
        );
        this.writeStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    }

    /**
     * 清理超过上限的旧日志文件
     */
    private cleanupOldLogs(): void {
        try {
            const files = fs.readdirSync(LogManager.LOG_DIR)
                .filter(f => f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(LogManager.LOG_DIR, f),
                    mtime: fs.statSync(path.join(LogManager.LOG_DIR, f)).mtime.getTime()
                }))
                .sort((a, b) => b.mtime - a.mtime);  // 按修改时间降序

            // 删除超过上限的文件
            if (files.length >= LogManager.MAX_LOG_FILES) {
                const filesToDelete = files.slice(LogManager.MAX_LOG_FILES - 1);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        tools.log.info(`[LogManager] Deleted old log: ${file.name}`);
                    } catch (err) {
                        tools.log.error(`[LogManager] Failed to delete old log: ${file.path}`, err);
                    }
                });
            }
        } catch (err) {
            tools.log.error('[LogManager] Failed to cleanup old logs:', err);
        }
    }

    /**
     * 写入日志
     */
    appendLog(message: string): void {
        try {
            const timestamp = new Date().toISOString();
            this.writeStream.write(`[${timestamp}] ${message}\n`);
        } catch (err) {
            tools.log.error('[LogManager] Failed to append log:', err);
        }
    }

    /**
     * 读取最近 N 行日志
     */
    async readLogs(limit: number = 100): Promise<string[]> {
        try {
            const content = await fs.promises.readFile(this.logFilePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            return lines.slice(-limit);
        } catch (err) {
            tools.log.error('[LogManager] Failed to read logs:', err);
            return [];
        }
    }

    /**
     * 清理当前日志文件
     */
    cleanup(): void {
        try {
            this.writeStream.close();
            // 注意：不删除文件，保留用于调试
        } catch (err) {
            tools.log.error('[LogManager] Failed to cleanup:', err);
        }
    }

    /**
     * 静态方法：获取所有日志文件列表
     */
    static getAllLogFiles(): string[] {
        try {
            if (!fs.existsSync(LogManager.LOG_DIR)) {
                return [];
            }
            return fs.readdirSync(LogManager.LOG_DIR)
                .filter(f => f.endsWith('.log'))
                .map(f => path.join(LogManager.LOG_DIR, f));
        } catch (err) {
            tools.log.error('[LogManager] Failed to get log files:', err);
            return [];
        }
    }
}
