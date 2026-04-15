## ADDED Requirements

### Requirement: Auto-migrate .codemaker directory to .y3maker
The system SHALL automatically detect and migrate the legacy `.codemaker` directory to `.y3maker` when the extension activates. This ensures existing user configurations (rules, skills, MCP settings, codewiki) are preserved seamlessly after the brand rename.

#### Scenario: Successful automatic migration
- **WHEN** the extension activates and `projectUri/.y3maker` does NOT exist but `projectUri/.codemaker` EXISTS
- **THEN** the system SHALL rename `projectUri/.codemaker` to `projectUri/.y3maker` automatically, and subsequent rules/skills/MCP loading SHALL read from `.y3maker`

#### Scenario: No migration needed - new directory already exists
- **WHEN** the extension activates and `projectUri/.y3maker` already EXISTS
- **THEN** the system SHALL NOT attempt any migration and SHALL use `.y3maker` as-is, regardless of whether `.codemaker` also exists

#### Scenario: No migration needed - neither directory exists
- **WHEN** the extension activates and neither `projectUri/.y3maker` nor `projectUri/.codemaker` EXISTS
- **THEN** the system SHALL proceed normally without migration (a fresh project with no prior configuration)

#### Scenario: Migration fails due to filesystem error
- **WHEN** the extension activates and `.codemaker` exists but rename to `.y3maker` FAILS (e.g., permission denied, directory in use, target name occupied by a file)
- **THEN** the system SHALL display a `vscode.window.showWarningMessage` informing the user to manually rename `.codemaker` to `.y3maker`, and SHALL NOT crash or block extension activation

### Requirement: Auto-migrate .codemaker.codebase.md to .y3maker.codebase.md
The system SHALL automatically detect and migrate the legacy `.codemaker.codebase.md` file to `.y3maker.codebase.md` following the same strategy as the directory migration.

#### Scenario: Successful file migration
- **WHEN** the extension activates and `projectUri/.y3maker.codebase.md` does NOT exist but `projectUri/.codemaker.codebase.md` EXISTS
- **THEN** the system SHALL rename `.codemaker.codebase.md` to `.y3maker.codebase.md` automatically

#### Scenario: File migration fails
- **WHEN** the extension activates and `.codemaker.codebase.md` rename FAILS
- **THEN** the system SHALL log a warning but SHALL NOT block extension activation

### Requirement: Migration timing
The migration logic SHALL execute AFTER the map environment initialization is complete but BEFORE the Y3Maker (CodeMaker) module initializes and loads rules/skills/MCP configurations. This ensures the webview reads from the correct `.y3maker` directory.

#### Scenario: Correct execution order
- **WHEN** the extension activation sequence runs
- **THEN** the directory migration SHALL complete before `initCodeMaker(context)` is called, so that all subsequent `.y3maker/rules`, `.y3maker/skills`, and `.y3maker/mcp_settings.json` reads target the migrated directory

### Requirement: y3-lualib source directory uses .y3maker
The extension's initialization code that copies resources from y3-lualib SHALL reference `.y3maker` instead of `.codemaker` as both the source and target directory names.

#### Scenario: New project initialization copies .y3maker
- **WHEN** a new project is initialized and y3-lualib contains a `.y3maker` directory
- **THEN** the system SHALL copy `y3-lualib/.y3maker` to `projectUri/.y3maker` and delete the source copy, matching the current behavior but with the new directory name
