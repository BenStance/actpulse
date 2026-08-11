"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentDevice = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentDevice = (0, common_1.createParamDecorator)((_data, ctx) => ctx.switchToHttp().getRequest().device);
//# sourceMappingURL=current-device.decorator.js.map