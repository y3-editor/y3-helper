import * as assert from 'assert';
import { buildKillAllScript } from '../../launchAgent/killAllScript';

suite('Launch agent kill-all script', () => {
    test('matches the current project and escapes single quotes', () => {
        const script = buildKillAllScript("C:\\游戏\\it's", 'C:\\engine');
        assert.ok(script.includes("editor_map_path@C:\\游戏\\it''s"));
        assert.ok(script.includes("Name='game_x64h.exe'"));
        assert.ok(script.includes('taskkill /PID $p.ProcessId /T /F'));
    });

    test('falls back to allowDir and python launcher without a project path', () => {
        const script = buildKillAllScript(undefined, "C:\\engine's");
        assert.ok(script.includes("ExecutablePath -like '*C:\\engine''s*'"));
        assert.ok(script.includes("CommandLine -like '*--start=Python*'"));
    });
});
