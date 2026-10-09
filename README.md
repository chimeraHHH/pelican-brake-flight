# 鹈鹕，起飞！

基于 [riba2534/claude-opus-5-5-demo](https://github.com/riba2534/claude-opus-5-5-demo) 的鹈鹕骑车场景改编，保留原版 Three.js 鹈鹕、自行车、海岸、日落、围巾和合成音效。

改编版开源仓库：[chimeraHHH/pelican-brake-flight](https://github.com/chimeraHHH/pelican-brake-flight)。作者 X：[@0Josephi](https://x.com/0Josephi)。

## 玩法

- `W / ↑` 加速，`S / ↓` 刹车，`A / D` 或 `← / →` 变道。手机使用屏幕上的方向按钮。
- 路障横跨公路。接近路障时，累计至少 0.28 秒制动，并降到约 15 km/h 以下才能通过；通过加 25 分，碰撞扣 40 分。同一路障只扣一次碰撞分。
- 按住刹车的累计时间达到 **6 秒**，制动踏板支架断裂，鹈鹕与车分离。松开不重置累计时间，暂停不计时。
- 断裂瞬间车速决定弹射初速。前向速度为 `车速 × cos(40°)`，向上速度为 `3 + 车速 × sin(40°)`，之后受重力和少量阻力影响。
- 空中按一下 `空格 / T` 或点击「拍翼」提升向上和前向速度。每次消耗 12 点体力，冷却 0.24 秒，最多拍 8 次；按住键不会重复拍翼。
- 飞行距离每米 10 分。落地结算，成绩停止增长，最高分保存在当前浏览器。`R` 或「再骑一次」重开。
- `P` 暂停，`K` 保存场景截图，`C` 切换骑行镜头，`N` 调整时段。

累计寿命、断裂、弹射和飞行参数均是虚构游戏规则。

## 构建和运行

```sh
npm ci --registry=https://registry.npmjs.org
npm run build
python3 -m http.server 4173 --directory dist
```

打开 `http://localhost:4173/`。构建产物是独立 HTML，无运行时外部资源依赖。

## 验证

```sh
npm test
# 预览服务器已启动，且已安装 Google Chrome 时：
npm run test:browser
```

9 项纯逻辑测试覆盖累计计时、暂停、初速度、飞行距离、拍翼体力与冷却、路障通行、计分和重开。浏览器测试覆盖桌面键盘流程、实际双指触控、手机横竖屏、结算布局、截图下载和无脚本报错。浏览器测试以受控时钟加速运行，并通过上游调试接口设置部分弹射前置状态。

键盘回归测试在游戏加载前注册「双击 A」阅读模式监听，验证连续 A、长按、方向键、松开和失焦；游戏按键在捕获阶段处理，正常文本输入和系统组合键保持可用。若本机已安装 Circle Reader，可将 `CIRCLE_KEYS_SCRIPT` 环境变量指向其 `controller/keys.js`，用实际控制器验证；扩展源码不会进入本仓库。

`src/brake-flight.mjs` 管理玩法规则；`src/challenge-world.js` 管理路障、制动踏板断裂与飞行轨迹；`src/main.js` 接入输入、相机、界面和结算。
