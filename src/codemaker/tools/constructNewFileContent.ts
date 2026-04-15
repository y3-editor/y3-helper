/**
 * 源码版 replaceInFile 的核心匹配引擎
 * 移植自 CodemakerOpenSource/packages/extension/src/utils/replaceInFile/contstructNewFileContent.ts
 * 
 * 三层匹配策略：精确匹配 -> 行级 trim 匹配 -> 块锚点匹配
 */

export const SEARCH_BLOCK_START = "------- SEARCH";
export const SEARCH_BLOCK_END = "=======";
export const REPLACE_BLOCK_END = "+++++++ REPLACE";

export const SEARCH_BLOCK_CHAR = "-";
export const REPLACE_BLOCK_CHAR = "+";
export const LEGACY_SEARCH_BLOCK_CHAR = "<";
export const LEGACY_REPLACE_BLOCK_CHAR = ">";

export const SEARCH_BLOCK_START_REGEX = /^[-]{3,} SEARCH>?$/;
export const LEGACY_SEARCH_BLOCK_START_REGEX = /^[<]{3,} SEARCH>?$/;
export const SEARCH_BLOCK_END_REGEX = /^[=]{3,}$/;
export const REPLACE_BLOCK_END_REGEX = /^[+]{3,} REPLACE>?$/;
export const LEGACY_REPLACE_BLOCK_END_REGEX = /^[>]{3,} REPLACE>?$/;

export function isSearchBlockStart(line: string): boolean {
    return SEARCH_BLOCK_START_REGEX.test(line) || LEGACY_SEARCH_BLOCK_START_REGEX.test(line);
}

export function isSearchBlockEnd(line: string): boolean {
    return SEARCH_BLOCK_END_REGEX.test(line);
}

export function isReplaceBlockEnd(line: string): boolean {
    return REPLACE_BLOCK_END_REGEX.test(line) || LEGACY_REPLACE_BLOCK_END_REGEX.test(line);
}

/**
 * 行级 trim 匹配
 */
export function lineTrimmedFallbackMatch(originalContent: string, searchContent: string, startIndex: number): [number, number] | false {
    const originalLines = originalContent.split("\n");
    const searchLines = searchContent.split("\n");

    if (searchLines[searchLines.length - 1] === "") {
        searchLines.pop();
    }

    let startLineNum = 0;
    let currentIndex = 0;
    while (currentIndex < startIndex && startLineNum < originalLines.length) {
        currentIndex += originalLines[startLineNum].length + 1;
        startLineNum++;
    }

    for (let i = startLineNum; i <= originalLines.length - searchLines.length; i++) {
        let matches = true;
        for (let j = 0; j < searchLines.length; j++) {
            const originalTrimmed = originalLines[i + j].trim();
            const searchTrimmed = searchLines[j].trim();
            if (originalTrimmed !== searchTrimmed) {
                matches = false;
                break;
            }
        }
        if (matches) {
            let matchStartIndex = 0;
            for (let k = 0; k < i; k++) {
                matchStartIndex += originalLines[k].length + 1;
            }
            let matchEndIndex = matchStartIndex;
            for (let k = 0; k < searchLines.length; k++) {
                matchEndIndex += originalLines[i + k].length + 1;
            }
            return [matchStartIndex, matchEndIndex];
        }
    }
    return false;
}

/**
 * 块锚点匹配（首尾行匹配）
 */
export function blockAnchorFallbackMatch(originalContent: string, searchContent: string, startIndex: number): [number, number] | false {
    const originalLines = originalContent.split("\n");
    const searchLines = searchContent.split("\n");

    if (searchLines.length < 3) {
        return false;
    }

    if (searchLines[searchLines.length - 1] === "") {
        searchLines.pop();
    }

    const firstLineSearch = searchLines[0].trim();
    const lastLineSearch = searchLines[searchLines.length - 1].trim();
    const searchBlockSize = searchLines.length;

    let startLineNum = 0;
    let currentIndex = 0;
    while (currentIndex < startIndex && startLineNum < originalLines.length) {
        currentIndex += originalLines[startLineNum].length + 1;
        startLineNum++;
    }

    for (let i = startLineNum; i <= originalLines.length - searchBlockSize; i++) {
        if (originalLines[i].trim() !== firstLineSearch) {
            continue;
        }
        if (originalLines[i + searchBlockSize - 1].trim() !== lastLineSearch) {
            continue;
        }
        let matchStartIndex = 0;
        for (let k = 0; k < i; k++) {
            matchStartIndex += originalLines[k].length + 1;
        }
        let matchEndIndex = matchStartIndex;
        for (let k = 0; k < searchBlockSize; k++) {
            matchEndIndex += originalLines[i + k].length + 1;
        }
        return [matchStartIndex, matchEndIndex];
    }
    return false;
}

/**
 * 三段式匹配策略：精确匹配 -> 行匹配 -> 锚点匹配
 */
export function performThreeTierMatch(originalContent: string, searchContent: string, startIndex: number): [number, number] | false {
    // 策略1：精确匹配
    const exactIndex = originalContent.indexOf(searchContent, startIndex);
    if (exactIndex !== -1) {
        return [exactIndex, exactIndex + searchContent.length];
    }
    // 策略2：行级 trim 匹配
    const lineMatch = lineTrimmedFallbackMatch(originalContent, searchContent, startIndex);
    if (lineMatch) {
        return lineMatch;
    }
    // 策略3：块锚点匹配
    const blockMatch = blockAnchorFallbackMatch(originalContent, searchContent, startIndex);
    if (blockMatch) {
        return blockMatch;
    }
    return false;
}

export enum ProcessingState {
    Idle = 0,
    StateSearch = 1 << 0,
    StateReplace = 1 << 1,
}

class FileContentConstructor {
    private originalContent: string;
    private state: number;
    private pendingNonStandardLines: string[];
    private result: string;
    private lastProcessedIndex: number;
    private currentSearchContent: string;
    private currentReplaceContent: string;
    private searchMatchIndex: number;
    private searchEndIndex: number;
    private replacements: Array<{ start: number; end: number; content: string }>;
    private pendingOutOfOrderReplacement: boolean;

    constructor(originalContent: string) {
        this.originalContent = originalContent;
        this.pendingNonStandardLines = [];
        this.result = "";
        this.lastProcessedIndex = 0;
        this.state = ProcessingState.Idle;
        this.currentSearchContent = "";
        this.currentReplaceContent = "";
        this.searchMatchIndex = -1;
        this.searchEndIndex = -1;
        this.replacements = [];
        this.pendingOutOfOrderReplacement = false;
    }

    private resetForNextBlock() {
        this.state = ProcessingState.Idle;
        this.currentSearchContent = "";
        this.currentReplaceContent = "";
        this.searchMatchIndex = -1;
        this.searchEndIndex = -1;
        this.pendingOutOfOrderReplacement = false;
    }

    private finishReplacement() {
        if (this.searchMatchIndex === -1) {
            throw new Error(`The SEARCH block:\n${this.currentSearchContent.trimEnd()}\n...is malformatted.`);
        }
        this.replacements.push({
            start: this.searchMatchIndex,
            end: this.searchEndIndex,
            content: this.currentReplaceContent,
        });
        if (!this.pendingOutOfOrderReplacement) {
            this.lastProcessedIndex = this.searchEndIndex;
        }
        this.resetForNextBlock();
    }

    private findLastMatchingLineIndex(regx: RegExp, lineLimit: number) {
        for (let i = lineLimit; i > 0;) {
            i--;
            if (this.pendingNonStandardLines[i].match(regx)) {
                return i;
            }
        }
        return -1;
    }

    private updateProcessingState(newState: ProcessingState) {
        const isValidTransition =
            (this.state === ProcessingState.Idle && newState === ProcessingState.StateSearch) ||
            (this.state === ProcessingState.StateSearch && newState === ProcessingState.StateReplace);
        if (!isValidTransition) {
            throw new Error(
                `Invalid state transition.\nValid transitions are:\n- Idle → StateSearch\n- StateSearch → StateReplace`,
            );
        }
        this.state |= newState;
    }

    private isStateActive(state: ProcessingState): boolean {
        return (this.state & state) === state;
    }

    private activateReplaceState() {
        this.updateProcessingState(ProcessingState.StateReplace);
    }

    private activateSearchState() {
        this.updateProcessingState(ProcessingState.StateSearch);
        this.currentSearchContent = "";
        this.currentReplaceContent = "";
    }

    private isSearchingActive(): boolean {
        return this.isStateActive(ProcessingState.StateSearch);
    }

    private isReplacingActive(): boolean {
        return this.isStateActive(ProcessingState.StateReplace);
    }

    private hasPendingNonStandardLines(pendingNonStandardLineLimit: number): boolean {
        return this.pendingNonStandardLines.length - pendingNonStandardLineLimit < this.pendingNonStandardLines.length;
    }

    public processLine(line: string) {
        this.internalProcessLine(line, true, this.pendingNonStandardLines.length);
    }

    public getResult() {
        if (this.state !== ProcessingState.Idle) {
            throw new Error("File processing incomplete - SEARCH/REPLACE operations still active during finalization");
        }
        if (this.replacements.length > 0) {
            this.replacements.sort((a, b) => a.start - b.start);
            let finalResult = "";
            let currentPos = 0;
            for (const replacement of this.replacements) {
                finalResult += this.originalContent.slice(currentPos, replacement.start);
                finalResult += replacement.content;
                currentPos = replacement.end;
            }
            finalResult += this.originalContent.slice(currentPos);
            return finalResult;
        }
        if (this.lastProcessedIndex < this.originalContent.length) {
            this.result += this.originalContent.slice(this.lastProcessedIndex);
        }
        return this.result;
    }

    private internalProcessLine(
        line: string,
        canWritependingNonStandardLines: boolean,
        pendingNonStandardLineLimit: number,
    ): number {
        let removeLineCount = 0;
        if (isSearchBlockStart(line)) {
            removeLineCount = this.trimPendingNonStandardTrailingEmptyLines(pendingNonStandardLineLimit);
            if (removeLineCount > 0) {
                pendingNonStandardLineLimit = pendingNonStandardLineLimit - removeLineCount;
            }
            if (this.hasPendingNonStandardLines(pendingNonStandardLineLimit)) {
                this.tryFixSearchReplaceBlock(pendingNonStandardLineLimit);
                canWritependingNonStandardLines && (this.pendingNonStandardLines.length = 0);
            }
            this.activateSearchState();
        } else if (isSearchBlockEnd(line)) {
            if (!this.isSearchingActive()) {
                this.tryFixSearchBlock(pendingNonStandardLineLimit);
                canWritependingNonStandardLines && (this.pendingNonStandardLines.length = 0);
            }
            this.activateReplaceState();
            this.beforeReplace();
        } else if (isReplaceBlockEnd(line)) {
            if (!this.isReplacingActive()) {
                this.tryFixReplaceBlock(pendingNonStandardLineLimit);
                canWritependingNonStandardLines && (this.pendingNonStandardLines.length = 0);
            }
            this.finishReplacement();
        } else {
            if (this.isReplacingActive()) {
                this.currentReplaceContent += line + "\n";
                if (this.searchMatchIndex !== -1 && !this.pendingOutOfOrderReplacement) {
                    this.result += line + "\n";
                }
            } else if (this.isSearchingActive()) {
                this.currentSearchContent += line + "\n";
            } else {
                let appendToPendingNonStandardLines = canWritependingNonStandardLines;
                if (appendToPendingNonStandardLines) {
                    this.pendingNonStandardLines.push(line);
                }
            }
        }
        return removeLineCount;
    }

    private beforeReplace() {
        if (!this.currentSearchContent) {
            if (this.originalContent.length === 0) {
                // 空文件：在开头插入
                this.searchMatchIndex = 0;
                this.searchEndIndex = 0;
            } else {
                // ERROR: Empty search block with non-empty file indicates malformed SEARCH marker
                throw new Error(
                    "Empty SEARCH block detected with non-empty file. This usually indicates a malformed SEARCH marker.\n" +
                        "Please ensure your SEARCH marker follows the correct format:\n" +
                        "- Use '------- SEARCH' (7+ dashes + space + SEARCH)\n",
                );
            }
        } else {
            const sequentialMatch = performThreeTierMatch(
                this.originalContent,
                this.currentSearchContent,
                this.lastProcessedIndex
            );
            if (sequentialMatch) {
                [this.searchMatchIndex, this.searchEndIndex] = sequentialMatch;
            } else {
                const fullFileMatch = performThreeTierMatch(
                    this.originalContent,
                    this.currentSearchContent,
                    0
                );
                if (fullFileMatch) {
                    [this.searchMatchIndex, this.searchEndIndex] = fullFileMatch;
                    if (this.searchMatchIndex < this.lastProcessedIndex) {
                        this.pendingOutOfOrderReplacement = true;
                    }
                } else {
                    throw new Error(
                        `The SEARCH block:\n${this.currentSearchContent.trimEnd()}\n...does not match anything in the file.`,
                    );
                }
            }
        }
        if (this.searchMatchIndex < this.lastProcessedIndex) {
            this.pendingOutOfOrderReplacement = true;
        }
        if (!this.pendingOutOfOrderReplacement) {
            this.result += this.originalContent.slice(this.lastProcessedIndex, this.searchMatchIndex);
        }
    }

    private tryFixSearchBlock(lineLimit: number): number {
        let removeLineCount = 0;
        if (lineLimit < 0) {
            lineLimit = this.pendingNonStandardLines.length;
        }
        if (!lineLimit) {
            throw new Error("Invalid SEARCH/REPLACE block structure - no lines available to process");
        }
        let searchTagRegexp = /^([-]{3,}|[<]{3,}) SEARCH$/;
        const searchTagIndex = this.findLastMatchingLineIndex(searchTagRegexp, lineLimit);
        if (searchTagIndex !== -1) {
            let fixLines = this.pendingNonStandardLines.slice(searchTagIndex, lineLimit);
            fixLines[0] = SEARCH_BLOCK_START;
            for (const line of fixLines) {
                removeLineCount += this.internalProcessLine(line, false, searchTagIndex);
            }
        } else {
            throw new Error(
                `Invalid REPLACE marker detected - could not find matching SEARCH block starting from line ${searchTagIndex + 1}`,
            );
        }
        return removeLineCount;
    }

    private tryFixReplaceBlock(lineLimit: number): number {
        let removeLineCount = 0;
        if (lineLimit < 0) {
            lineLimit = this.pendingNonStandardLines.length;
        }
        if (!lineLimit) {
            throw new Error();
        }
        let replaceBeginTagRegexp = /^[=]{3,}$/;
        const replaceBeginTagIndex = this.findLastMatchingLineIndex(replaceBeginTagRegexp, lineLimit);
        if (replaceBeginTagIndex !== -1) {
            let fixLines = this.pendingNonStandardLines.slice(replaceBeginTagIndex - removeLineCount, lineLimit - removeLineCount);
            fixLines[0] = SEARCH_BLOCK_END;
            for (const line of fixLines) {
                removeLineCount += this.internalProcessLine(line, false, replaceBeginTagIndex - removeLineCount);
            }
        } else {
            throw new Error(`Malformed REPLACE block - missing valid separator after line ${replaceBeginTagIndex + 1}`);
        }
        return removeLineCount;
    }

    private tryFixSearchReplaceBlock(lineLimit: number): number {
        let removeLineCount = 0;
        if (lineLimit < 0) {
            lineLimit = this.pendingNonStandardLines.length;
        }
        if (!lineLimit) {
            throw new Error();
        }
        let replaceEndTagRegexp = /^([+]{3,}|[>]{3,}) REPLACE$/;
        const replaceEndTagIndex = this.findLastMatchingLineIndex(replaceEndTagRegexp, lineLimit);
        const likeReplaceEndTag = replaceEndTagIndex === lineLimit - 1;
        if (likeReplaceEndTag) {
            let fixLines = this.pendingNonStandardLines.slice(replaceEndTagIndex - removeLineCount, lineLimit - removeLineCount);
            fixLines[fixLines.length - 1] = REPLACE_BLOCK_END;
            for (const line of fixLines) {
                removeLineCount += this.internalProcessLine(line, false, replaceEndTagIndex - removeLineCount);
            }
        } else {
            throw new Error("Malformed SEARCH/REPLACE block structure: Missing valid closing REPLACE marker");
        }
        return removeLineCount;
    }

    private trimPendingNonStandardTrailingEmptyLines(lineLimit: number): number {
        let removedCount = 0;
        let i = Math.min(lineLimit, this.pendingNonStandardLines.length) - 1;
        while (i >= 0 && this.pendingNonStandardLines[i].trim() === "") {
            this.pendingNonStandardLines.pop();
            removedCount++;
            i--;
        }
        return removedCount;
    }
}

/**
 * 使用源码版的三层匹配策略重建文件内容
 * 
 * diff 格式:
 *   ------- SEARCH
 *   [要查找的精确内容]
 *   =======
 *   [替换内容]
 *   +++++++ REPLACE
 */
export function constructNewFileContent(diffContent: string, originalContent: string): string {
    let fileContentConstructor = new FileContentConstructor(originalContent);
    let lines = diffContent.split("\n");

    const lastLine = lines[lines.length - 1];
    if (
        lines.length > 0 &&
        (lastLine.startsWith(SEARCH_BLOCK_CHAR) ||
            lastLine.startsWith(LEGACY_SEARCH_BLOCK_CHAR) ||
            lastLine.startsWith("=") ||
            lastLine.startsWith(REPLACE_BLOCK_CHAR) ||
            lastLine.startsWith(LEGACY_REPLACE_BLOCK_CHAR)) &&
        !isSearchBlockStart(lastLine) &&
        !isSearchBlockEnd(lastLine) &&
        !isReplaceBlockEnd(lastLine)
    ) {
        lines.pop();
    }

    for (const line of lines) {
        fileContentConstructor.processLine(line);
    }

    let result = fileContentConstructor.getResult();
    return result;
}
