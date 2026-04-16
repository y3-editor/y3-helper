export enum UserEvent {
  // CodeChat
  CODE_CHAT_COPY = 'CodeChat.copy',
  CODE_CHAT_CODE_INSERT = 'CodeChat.code_insert',
  CODE_CHAT_CODE_MERGE = 'CodeChat.code_merge',
  CODE_CHAT_NEW_SESSION = 'CodeChat.new_session',
  CODE_CHAT_VIEW_SESSIONS = 'CodeChat.view_sessions',
  CODE_CHAT_REMOVE_SESSION = 'CodeChat.remove_session',
  CODE_CHAT_EXPORT_SESSION = 'CodeChat.export_session',
  CODE_CHAT_START_STREAM = 'CodeChat.start_stream',
  CODE_CHAT_STOP_STREAM = 'CodeChat.stop_stream',
  CODE_CHAT_START_BM_STREAM = 'CodeChat.start_bm_stream',
  CODE_CHAT_STOP_BM_STREAM = 'CodeChat.stop_bm_stream',
  CODE_CHAT_START_CODEBASE_STREAM = 'CodeChat.start_codebase_stream',
  CODE_CHAT_UP_VOTE = 'CodeChat.up_vote',
  CODE_CHAT_DOWN_VOTE = 'CodeChat.down_vote',
  CODE_CHAT_CHUNK_TIMEOUT = 'CodeChat.chunk_timeout',
  CODE_CHAT_APPLY_EDIT = 'CodeChat.apply_edit',
  CODE_CHAT_APPLY_EDIT_CONFIRM = 'CodeChat.apply_edit_confirm',
  CODE_CHAT_APPLY_EDIT_SUCCESS = 'CodeChat.apply_edit_success',
  CODE_CHAT_APPLY_EDIT_CANCEL = 'CodeChat.apply_edit_cancel',
  CODE_CHAT_APPLY_EDIT_START = 'CodeChat.apply_edit_start',
  CODE_CHAT_APPLY_EDIT_FAILED = 'CodeChat.apply_edit_failed',
  CODE_CHAT_BATCH_APPLY_EDIT = 'CodeChat.batch_apply_edit',
  CODE_CHAT_SINGLE_APPLY_EDIT = 'CodeChat.single_apply_edit',
  CODE_CHAT_SINGLE_REVERT_EDIT = 'CodeChat.single_revert_edit',
  CODE_CHAT_BATCH_APPLY_SUCCESS = 'CodeChat.batch_apply_success',
  CODE_CHAT_SINGLE_APPLY_SUCCESS = 'CodeChat.single_apply_success',
  CODE_CHAT_SINGLE_REVERT_SUCCESS = 'CodeChat.single_revert_success',
  CODE_CHAT_APPLY_BATCH_FAILED = 'CodeChat.apply_batch_failed',
  CODE_CHAT_ACCEPT_AUTO_MODE = 'CodeChat.accept_auto_mode',
  CODE_CHAT_ACCEPT_AUTO_MODE_BEFORE_CHAT = 'CodeChat.code_chat_accept_auto_mode_before_chat',

  CODE_CHAT_PROMPT_EXPLAIN = 'CodeChat.prompt_explain',
  CODE_CHAT_PROMPT_FIND_PROBLEM = 'CodeChat.prompt_find_problem',
  CODE_CHAT_PROMPT_OPTIMIZE = 'CodeChat.prompt_optimize',
  CODE_CHAT_PROMPT_CUSTOM = 'CodeChat.prompt_custom',
  CODE_CHAT_COMPRESS = 'CodeChat.compress',
  CODE_CHAT_COMPRESS_EMPTY = 'CodeChat.compress_empty',
  CODE_CHAT_COMPRESS_EMPTY_RETRY = 'CodeChat.compress_empty_retry',
  CODE_CHAT_COMPRESS_FAILED = 'CodeChat.compress_failed',
  CODE_CHAT_UNIT_TEST = 'CodeChat.prompt_unit_test',
  CODE_CHAT_CLEAN = 'CodeChat.prompt_clean',
  CODE_CHAT_CODEBASE = 'CodeChat.codebase',
  CHAT_TOOL_CALL_ERROR = 'CodeChat.tool_call_error',

  CODE_CHAT_DEFINE_PROMPT = 'CodeChat.define_prompt',
  CODE_CHAT_TRIGGER_TOKEN_LIMIT = 'CodeChat.trigger_token_limit',
  CODE_CHAT_TOKES_COUNT = 'CodeChat.tokens_count',

  CODE_CHAT_MERMAID_PREVIEW = 'CodeChat.mermaid_preview',
  CODE_CHAT_PLANTUML_PREVIEW = 'CodeChat.plantuml_preview',
  CODE_CHAT_GRAPHVIZ_PREVIEW = 'CodeChat.graphviz_preview',
  CODE_CHAT_MERMAID_TESTING = 'CodeChat.mermaid_testing',
  CODE_CHAT_PLANTUML_TESTING = 'CodeChat.plantuml_testing',
  CODE_CHAT_GRAPHVIZ_TESTING = 'CodeChat.graphviz_testing',
  CODE_CHAT_HTML_PREVIEW = 'CodeChat.html_preview',

  CODE_CHAT_NETWORK_MODEL = 'CodeChat.network_model',
  CODE_CHAT_KNOWLEDGE_AUGMENTATION = 'CodeChat.knowledge_augmentation',
  CODE_CHAT_UPLOAD_IMAGE = 'CodeChat.upload_image',

  // devSpace
  CODE_CHAT_DEV_SPACE_USED = 'CodeChat.dev_space_used',

  // CodeBase
  CODE_BASE_FEEDBACK = 'Codebase.feedback',

  // CodeSearch
  CODE_SEARCH_SEARCH = 'CodeSearch.search',
  CODE_SEARCH_COLLECT = 'CodeSearch.collect',

  // Help
  HELP_SWITCH_MODEL = 'Help.switch_model',
  SWITCH_MODEL_ERROR = 'Help.switch_model_error',

  // setting
  SETTING_SWITCH_THEME = 'setting.switch_theme',

  // LocalReview
  REVIEW_STOP = 'CodeReview.stop',
  REVIEW_DIFF_EXCEED_TOKEN = 'CodeReview.diff_exceed_token',
  LOCAL_REVIEW_CHANGE_STATUS = 'CodeReview.local_view_change_status',

  // TeamReview
  REVIEW_BATCH_OPERATE_ISSUE = 'CodeReview.batch_operate_issue',
  REVIEW_BATCH_DELETE_ISSUE = 'CodeReview.batch_delete_issue',

  // Web vitals
  WEB_VITALS_FCP = 'Webvitals.FCP',
  WEB_VITALS_LCP = 'Webvitals.LCP',
  WEB_VITALS_FID = 'Webvitals.FID',
  WEB_VITALS_CLS = 'Webvitals.CLS',
  WEB_VITALS_INP = 'Webvitals.INP',
  WEB_VITALS_TTFB = 'Webvitals.TTFB',

  // Error collect
  WEB_ERROR = 'Global.error',

  // Coverage
  SEARCH_REPORT = 'CodeCoverage.search_report',
  VIEW_REPORT = 'CodeCoverage.view_report',
  SYNC_REPORT = 'CodeCoverage.sync',
  SHARE_REPORT = 'CodeCoverage.share_report',
  SET_LOCAL_PATH = 'CodeCoverage.set_local_path',

  // CodeScan
  CODE_SCAN_ENTER = 'CodeScan.enter',

  // 回复异常上报
  REPLY_EXCEPTION = 'CodeChat.reply_exception',

  // 异常错误结果
  SESSION_MESSAGE_EXCEPTION = 'CodeChat.session_message_exception',

  // MCP
  CODE_CHAT_MCP_SESSION_TOKEN_USED = 'CodeChat.mcp_session_token_used',
  CODE_CHAT_MCP_MESSAGE_TOKEN_USED = 'CodeChat.mcp_message_token_used',

  // New Apply
  CODE_CHAT_EDIT_FILE = 'CodeChat.edit_file',
  CODE_CHAT_EDIT_FILE_SUCCESS = 'CodeChat.edit_file_success',
  CODE_CHAT_EDIT_FILE_FAILED = 'CodeChat.edit_file_failed',
  CODE_CHAT_REAPPLY = 'CodeChat.reapply',
  CODE_CHAT_REAPPLY_SUCCESS = 'CodeChat.reapply_success',
  CODE_CHAT_REAPPLY_FAILED = 'CodeChat.reapply_failed',
  CODE_CHAT_ACCEPT_EDIT = 'CodeChat.accept_edit',
  CODE_CHAT_REJECT_EDIT = 'CodeChat.reject_edit',
  CODE_CHAT_ACCEPT_EDIT_SUCCESS = 'CodeChat.accept_edit_success',
  CODE_CHAT_ACCEPT_EDIT_FAILED = 'CodeChat.accept_edit_failed',
  CODE_CHAT_SAVE_EDIT = 'CodeChat.save_edit',
  CODE_CHAT_REVERT_EDIT = 'CodeChat.revert_edit',
  CODE_CHAT_REVERT_EDIT_SUCCESS = 'CodeChat.revert_edit_success',
  CODE_CHAT_REVERT_EDIT_FAILED = 'CodeChat.revert_edit_failed',
  CODE_CHAT_CONFIRM_EDIT = 'CodeChat.confirm_edit',
  CODE_CHAT_BATCH_CONFIRM_EDIT = 'CodeChat.batch_confirm_edit',
  CODE_CHAT_BATCH_REVERT_EDIT = 'CodeChat.batch_revert_edit',
  CODE_CHAT_BATCH_ACCEPT_EDIT_SUCCESS = 'CodeChat.batch_accept_edit_success',
  CODE_CHAT_BATCH_ACCEPT_EDIT_FAILED = 'CodeChat.batch_accept_edit_failed',
  CODE_CHAT_BATCH_REVERT_EDIT_SUCCESS = 'CodeChat.batch_revert_edit_success',
  CODE_CHAT_BATCH_REVERT_EDIT_FAILED = 'CodeChat.batch_revert_edit_failed',
  CODE_CHAT_REPLACE_IN_FILE = 'CodeChat.replace_in_file',
  CODE_CHAT_REPLACE_IN_FILE_SUCCESS = 'CodeChat.replace_in_file_success',
  CODE_CHAT_REPLACE_IN_FILE_FAILED = 'CodeChat.replace_in_file_failed',
  CODE_CHAT_REVERT_FILE_SUCCESS = 'CodeChat.revert_file_success',

  MAX_AUTO_APPROVED_REACHED = 'CodeChat.max_auto_approved_reached',

  //mcp相关埋点
  CODE_CHAT_MCP_MANAGE_PANEL = 'CodeChat.mcp_manage_panel',
  CODE_CHAT_SKILL_MANAGE_PANEL = 'CodeChat.skill_manage_panel',
  CODE_CHAT_MCP_INSTALL_BUILTIN_SERVER = 'CodeChat.mcp_install_builtin_server',
  CODE_CHAT_MCP_ADD_CUSTOM_SERVER = 'CodeChat.mcp_add_custom_server',
  CODE_CHAT_MCP_CONFIG_BUTTON = 'CodeChat.mcp_config_button',
  CODE_CHAT_MCP_OPEN_CONFIG_FILE = 'CodeChat.mcp_open_config_file',

  // plan mode
  CODE_CHAT_ENABLE_PLAN_MODE = 'CodeChat.enable_plan_mode',
  CODE_CHAT_DISABLE_PLAN_MODE = 'CodeChat.disable_plan_mode',
  CODE_CHAT_PLAN_MODE_MESSAGE = 'CodeChat.plan_mode_message',
  CODE_CHAT_ADD_TODO = 'CodeChat.add_todo',
  CODE_CHAT_DELETE_TODO = 'CodeChat.delete_todo',
  CODE_CHAT_CHANGE_TODO = 'CodeChat.change_todo',
  CODE_CHAT_PLAN_PARSE_ERROR = 'CodeChat.plan_parse_error',
  CODE_CHAT_PLAN_PARSE_REPORT_ERROR = 'CodeChat.plan_parse_report_error',
  CODE_CHAT_PLAN_TYPE_ERROR = 'CodeChat.plan_type_error',

  CODE_CHAT_TOKEN_USED = 'CodeChat.token_used',

  // rules
  CHAT_WITH_RULES = 'CodeChat.chat_with_rules',

  TOOLCALL_STOP_BY_LENGTH = 'CodeChat.toolcall_stop_by_length',

  CHAT_SUBMIT_ERROR = 'CodeChat.chat_submit_error',
}
