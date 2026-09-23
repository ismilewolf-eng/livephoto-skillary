# DESIGN.md — LivePhoto (Apple-inspired edition)

> 本文件是本项目视觉系统、交互哲学与代码实现的唯一事实源。
> 选定方向：方向 4（Apple 极简设计奖 × Future iOS 超窄边框全面屏美学）。

## 1. 视觉主题与氛围 (Theme & Atmosphere)

- **核心气质**：Apple 极简设计奖级工匠质感 + Future iOS 无界超窄边框（Edge-to-Edge Bezel-less Display）。
- **设计哲学**：Reductive to the core（极致减法，为内容让路）。将复杂的文件格式转换包装为 3 步极简体验，兼具发布会雕塑感与原生工具的高效。
- **空间与节奏**：
  - 56px/64px SF Pro Display 紧凑字阶（line-height 1.05, tracking -0.038em）。
  - 经典 Apple 浅灰底 #F5F5F7 与纯白 #FFFFFF 大圆角卡片。
  - 1.5px 极细钛金属反光微边框（模拟 98.5% 超高屏占比的未来 iPhone 硬件）。

## 2. 色彩系统 (Color Palette & Roles)

### 核心色彩
- **Page Background**: #F5F5F7（Apple 经典无菌浅灰）
- **Surface**: #FFFFFF（纯白卡片，含微透毛玻璃效果）
- **Primary Text**: #1D1D1F（深墨近黑）
- **Secondary Text**: #86868B（中度辅助灰）
- **Tertiary Text**: #A1A1A6（浅注记灰）

### 交互强调色
- **Apple Blue**: #0071E3（主 CTA、选中态、进度条）
- **Apple Blue Hover**: #0077ED
- **Apple Blue Glow**: rgba(0, 113, 227, 0.22)
- **Live Active Green**: #34C759（实况运行点与 iOS 状态指示）

### 边框与阴影
- **Card Border**: 1px solid rgba(0, 0, 0, 0.08)
- **Bezel Frame**: 1.5px solid rgba(0, 0, 0, 0.15)（超窄未来边框）
- **Diffused Shadow**: 0 12px 36px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04)

## 3. 排版体系 (Typography System)

- **Display Hero**: SF Pro Display, clamp(38px, 5.5vw, 64px), weight 700, line-height 1.05, letter-spacing -0.038em
- **Section Heading**: SF Pro Display, 32px, weight 700, line-height 1.15, letter-spacing -0.025em
- **Card Title**: SF Pro Display, 20px, weight 600, letter-spacing -0.015em
- **Body Regular**: SF Pro Text, 15px-17px, weight 400, line-height 1.47, letter-spacing -0.022em
- **Pill Button**: SF Pro Text, 14px-16px, weight 600, 980px border-radius
- **Monospace Code/Tags**: JetBrains Mono, 11px-12px, tabular-nums

## 4. 组件与微交互 (Components & Micro-interactions)

1. **Future iPhone 锁屏模拟器**：
   - 1.5mm 超窄无界钛边框，98.5% 屏占比。
   - Dynamic Island / Horizon 灵动胶囊。
   - **按住预览**：长按屏幕播放上传或示例视频，松开暂停；不声称提供真实 3D Touch 或触觉反馈。
2. **Apple Live Photo 同心圆旋转标志**：
   - 3 层同心圆微动指示器。
3. **关键帧时间轴滑块 (Keyframe Scrubber)**：
   - 支持从上传视频中毫秒级拖动选取作为静态封面帧。
4. **980px Capsule Pill CTA**：
   - 经典药丸形按钮，微震感缩放反馈 (active: scale(0.98))。

## 5. 工艺密度 (Craft Density ≥ 5)

1. **氛围层**：微米级柔和底光层，透光度 < 4%。
2. **::selection 品牌定制**：#0071E3 底色 + 纯白文字。
3. **品牌 focus-visible 环**：2px solid #0071E3; outline-offset: 2px。
4. **签名交互**：iPhone 锁屏 3D Touch 呼吸按压震动反馈。
5. **多层染色阴影栈**：结合 Apple Blue 与环境色实现双层弥散。
6. **编辑细节**：封面帧时间码与明确的“本地处理”状态说明。

## 6. 功能契约 (Functional Contract)

- 当前支持 MP4/MOV/WebM：浏览器能播放时可选择画面并导出 JPEG 封面帧。
- ZIP 保留原始视频的字节、格式与扩展名，包含封面 JPEG 和说明文件。
- 示例视频仅供预览，必须上传本地视频才能导出。
- 导出物不是原生 Apple Live Photo；在完成双文件元数据配对和 iPhone 实机验证前，页面与搜索摘要必须如实说明这一限制。
- 未实现的 GIF、逆向转换、批量导出和收费入口不作为可用功能展示；相关专题页暂不收录。
