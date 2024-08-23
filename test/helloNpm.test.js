const helloNpm = require('../index');

test('returns "hello NPM"', () => {
    expect(helloNpm()).toBe("hello NPM");
});