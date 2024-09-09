function mockFetch(url) {
    return Promise.resolve({
        ok: true,
        json: () => {
            const params = url.split("?")[1].split("&");
            const paramsMap = params.reduce((map, paramPair) => {
                const values = paramPair.split("=");
                if (map[values[0]] && Array.isArray(map[values[0]])) {
                    map[values[0]] = map[values[0]].push(values[1]);
                } else if (map[values[0]] && !Array.isArray(map[values[0]])) {
                    map[values[0]] = [map[values[0]], values[1]];
                } else {
                    map[values[0]] = values[1];
                }

                return map
            }, {});
            return Promise.resolve({"args": paramsMap});
        }
      })
  }
  
module.exports = mockFetch