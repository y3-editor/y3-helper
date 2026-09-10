-- Loaded at main.lua entry after checking the host debugger prerequisites.
return function(debugger_path, control_pipe)
    local dbg = assert(loadfile(debugger_path))(debugger_path)
    dbg:start({ address = "127.0.0.1:12306" })

    -- Editor launches do not wait. Helper opens this pipe before a debug launch;
    -- regular launches receive 'continue' immediately. Missing Helper means no wait.
    local control = io.open(control_pipe, "r")
    if not control then return end
    local ok, err = pcall(function()
        for command in control:lines() do
            -- Process debugger configuration between blocking pipe reads.
            dbg:event("update")
            if command == "continue" then break end
        end
    end)
    control:close()
    if not ok then error(err) end
end
