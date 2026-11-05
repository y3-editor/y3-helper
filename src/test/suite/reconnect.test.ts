import * as assert from 'assert';
import { selectReconnectedClient } from '../../mcp/reconnect';

suite('Multi-player reconnect selection', () => {
    test('selects by role id when the whole group reconnects', () => {
        const clients = [{roleId: 2}, {roleId: 1}];
        assert.strictEqual(selectReconnectedClient(clients, 1)?.roleId, 1);
        assert.strictEqual(selectReconnectedClient(clients, 2)?.roleId, 2);
    });

    test('does not fall back to another role when the target is missing', () => {
        assert.strictEqual(selectReconnectedClient([{roleId: 2}], 1), undefined);
    });

    test('keeps single-player behavior of taking the first client', () => {
        const clients = [{roleId: undefined}, {roleId: 1}];
        assert.strictEqual(selectReconnectedClient(clients), clients[0]);
    });
});
