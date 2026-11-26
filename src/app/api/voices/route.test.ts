import { expect, it, vi } from 'vitest';
const bridge = vi.hoisted(() => vi.fn());
vi.mock('@/lib/intelligence-server', () => ({ intelligenceResponse: bridge }));
import { GET } from './route';
it('aliases the expert voices entry to the durable wind source', async () => { const response = Response.json({ok:true}); bridge.mockResolvedValue(response); expect(await GET()).toBe(response); expect(bridge).toHaveBeenCalledWith('wind'); });
