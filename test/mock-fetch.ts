interface MockResponse {
    ok: boolean;
    json: () => Promise<{ args: Record<string, string | string[]> }>;
}

function mockFetch(url: string): Promise<MockResponse> {
    return Promise.resolve({
        ok: true,
        json: () => {
            const params = url.split("?")[1].split("&");
            const paramsMap = params.reduce((map: Record<string, string | string[]>, paramPair: string) => {
                const values = paramPair.split("=");
                if (map[values[0]] && Array.isArray(map[values[0]])) {
                    (map[values[0]] as string[]).push(values[1]);
                } else if (map[values[0]] && !Array.isArray(map[values[0]])) {
                    map[values[0]] = [map[values[0]] as string, values[1]];
                } else {
                    map[values[0]] = values[1];
                }

                return map;
            }, {});
            return Promise.resolve({ "args": paramsMap });
        }
    });
}

export default mockFetch;

