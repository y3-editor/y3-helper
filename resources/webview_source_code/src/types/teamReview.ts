
export interface CodeReviewLabel {
    title: string;
    color: string;
    description: string;
    severity: string;
}
interface ReviewUser {
    name: string;
    fullname: string;
}

export enum ReviewerStatus {
    Init = 'init',
    Approve = 'approve',
    Unresolved = 'unresolved',
    AiFailure = 'ai_failure'
}

export interface ReviewRequestDiff {
    addedSum?: number;
    deletedSum?: number;
    extra?: {
        renamed_file: boolean;
        old_path: string;
        new_path: string;
    };
    hash: string;
    index: string;
    leftPhrase: string[];
    rightPhrase: string[];
}

export interface ReviewIssue {
    code_removed: boolean;
    creator: ReviewUser;
    editor: ReviewUser;
    create_time: number;
    update_time: number;
    _id: string;
    reviewer: string;
    description: string;
    location: {
        fileIndex: string;
        fileRevision: string;
        filePhraseRevision: string;
        lineIndex: number;
        lineNums: number;
    };
    publishStatus: string;
    status: string;
    comments: string[];
    isRead: boolean;
    reviewRequestId: string;
    reviewRequest: null | ReviewRequest;
    fileContent: null | string;
    labels?: CodeReviewLabel[];
    positive: boolean;
    issue_type?: 'code_smell' | 'bug' | 'security';
    severity?: 'suggestion' | 'warning' | 'critical';
    source?: string;
}

export interface ReviewRequest {
    address: string;
    assignee: string[];
    create_time: number;
    creator: ReviewUser;
    diff: ReviewRequestDiff[];
    editor: ReviewUser;
    project: string;
    releaseData: null;
    aiExplain?: string;
    fileList?: string[];
    reviewers: {
        name: string;
        fullname: string;
        isRead: boolean;
        reviewStatus: ReviewerStatus;
        detail: string;
    }[];
    revisions: number[];
    sequenceId: string;
    status: string;
    svnUrl: string;
    title: string;
    update_time: number;
    _id: string;
    issues?: ReviewIssue[];
    redmineDomain?: string;
    redmineIssueId?: number;
    mergeRequestIid?: number;
    gitSourceBranch?: string;
    gitTargetBranch?: string;
    review_description_details?: {
        description: string;
        issue_id: string;
        subject: string;
        summary: string;
        summary_en: string;
    };
    review_description?: string;
    review_redmine_issues?: {
        assigned_to: string;
        redmine_issue_id: number;
        redmine_parent_issue_id: number;
        redmine_url: string;
    }[];
    ai_review_history?: {
        progress: {
            rate: number;
            total: number;
            completed: number;
            progress_msg: string;
        };
    }[];
    aiAction?: string[];
    remark?: string;
    failed_reason?: string;
    user_review_description?: string;
    use_ai_explain_for_review?: boolean;
    file_ids?: string[];
}

