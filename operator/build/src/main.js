"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
var Delays;
(function (Delays) {
    Delays[Delays["Short"] = 500] = "Short";
    Delays[Delays["Medium"] = 2000] = "Medium";
    Delays[Delays["Long"] = 5000] = "Long";
})(Delays = exports.Delays || (exports.Delays = {}));
function delayedHello(name, delay = Delays.Medium) {
    return new Promise((resolve) => setTimeout(() => resolve(`Hello, ${name}`), delay));
}
function greeter(name) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        console.log('gg');
        return yield delayedHello(name, Delays.Long);
    });
}
exports.greeter = greeter;
//# sourceMappingURL=main.js.map