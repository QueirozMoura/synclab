import { describe, expect, it, vi } from "vitest";
import { MigrationRunner } from "@infrastructure/persistence/migrations/MigrationRunner.js";
function poolWithClient(client) {
    return { connect: vi.fn().mockResolvedValue(client) };
}
describe("MigrationRunner", () => {
    it("executa migrations ordenadas apenas uma vez", async () => {
        const queries = [];
        const client = { query: vi.fn(async (sql) => {
                queries.push(sql);
                if (sql.startsWith("SELECT id"))
                    return { rows: [{ id: "001" }] };
                return { rows: [] };
            }), release: vi.fn() };
        const runner = new MigrationRunner(poolWithClient(client), [{ id: "002", up: vi.fn() }, { id: "001", up: vi.fn() }]);
        const result = await runner.run();
        expect(result).toEqual(["002"]);
        expect(client.release).toHaveBeenCalledOnce();
    });
});
