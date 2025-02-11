# CliCli-Helper

## Initialize Project (For new maps only, do not use for old maps!)

1. Click the "CliCli-Helper" icon in the left sidebar, then click "Initialize"
2. Select the map path
3. Done!

## Feature Panel

Includes common features such as "Start Game", "Open in Editor", "View Logs", etc.

When you start the game using this helper, the game will connect to the development helper and provide additional features:

1. One-click hot reload
2. Display a dashboard in the "Custom View" area to monitor game status and quickly restart
3. Use the remote terminal in the "Terminal" area of VSCode to display game logs and execute commands

## Object Editor Support

After opening the map, you can browse and edit object editor data (`.json` files) in `Explorer/CliCli-Helper: Object Editor Data`.

After opening an object editor JSON file, you can view and jump to fields in Chinese in the `Explorer/Outline/CliCli-Helper: Object Editor Fields` view.

### Search

Press `Ctrl+T` to search object editor data, for example, use `#GuanYu` to search for all object editor data with "GuanYu" in the name. Use `#GuanYu.ori_speed` to search for a specific object editor field.

> You can also use numeric keys and English field names to search. Delimiters support `.` and `/`.

## Advanced Applications

### Remote Terminal

After the map is published to the platform, you can use the remote terminal feature to debug the online map.

> This feature should only be enabled on the test server.

1. Embed initialization code in your script, such as:
    ```lua
    y3.game:event('Player-Send Specific Message', 'Link Start', function (trg, data)
        y3.develop.helper.init(11037)
    end)
    -- Allow local code execution on the platform
    y3.config.code.enable_local = true
    ```
2. Change the `CliCli-Helper.ServerPort` in VSCode settings to the same port number `11037`
3. Restart VSCode to ensure the plugin applies the new port number
4. Click the "CliCli Development Helper" icon in the sidebar to ensure the helper is started
5. Execute the initialization code embedded in step 1 to connect to the remote terminal by running `y3.develop.helper.init(11037)`
