import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const receiptDirectory = path.join(os.tmpdir(), 'y3-helper-generated-gmp');

function normalizedPath(file: string): string {
    const absolute = path.resolve(file);
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

function receiptPath(file: string): string {
    return path.join(receiptDirectory, crypto.createHash('sha256').update(normalizedPath(file)).digest('hex') + '.json');
}

function fileVersion(file: string): string {
    const stat = fs.statSync(file, { bigint: true });
    return [stat.dev, stat.ino, stat.size, stat.mtimeNs].join(':');
}

function digest(data: Uint8Array): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/** Match the exact generated file version, including events delivered by another process. */
export function isGeneratedGmpWrite(file: string): boolean {
    try {
        const receipt = JSON.parse(fs.readFileSync(receiptPath(file), 'utf8')) as {
            file: string;
            version: string;
            sha256: string;
        };
        return receipt.file === normalizedPath(file)
            && receipt.version === fileVersion(file)
            && receipt.sha256 === digest(fs.readFileSync(file));
    } catch {
        return false;
    }
}

/** Publish the write origin before renaming so create/change events cannot outrun it. */
export function writeGeneratedGmp(file: string, data: Uint8Array): void {
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    const marker = receiptPath(file);
    const temporaryMarker = marker + '.' + crypto.randomUUID() + '.tmp';
    let previousReceipt: Buffer | undefined;
    let receipt: string | undefined;
    let marked = false;
    try {
        fs.writeFileSync(temporary, data);
        fs.mkdirSync(receiptDirectory, { recursive: true });
        if (fs.existsSync(marker)) {
            previousReceipt = fs.readFileSync(marker);
        }
        receipt = JSON.stringify({ file: normalizedPath(file), version: fileVersion(temporary), sha256: digest(data) });
        fs.writeFileSync(temporaryMarker, receipt);
        fs.renameSync(temporaryMarker, marker);
        marked = true;
        fs.renameSync(temporary, file);
    } catch (error) {
        if (marked && fs.readFileSync(marker, 'utf8') === receipt) {
            if (previousReceipt) {
                fs.writeFileSync(temporaryMarker, previousReceipt);
                fs.renameSync(temporaryMarker, marker);
            } else {
                fs.rmSync(marker, { force: true });
            }
        }
        throw error;
    } finally {
        fs.rmSync(temporary, { force: true });
        fs.rmSync(temporaryMarker, { force: true });
    }
}
