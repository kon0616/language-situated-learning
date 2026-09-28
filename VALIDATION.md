# 第二轮验证记录

- TypeScript 类型检查、7 项服务测试和生产构建通过。
- 服务测试涵盖旧版迁移、分类别名、多重归属、百量级局部图上限、跨维搜索、Today 去重和本地存储往返。
- 在浏览器中的旧版 12 个表达上完成 v1→v2 迁移，旧表达、已设学习状态和来源仍可见；新增 5 个建筑设计示例，随后从 Inbox 保存的表达也可在刷新后找到。
- Today → Detail → Context 路径、Domain → 建筑・设计 → 空间评价、Search → Detail → Explore、Inbox 编辑和保存、Reactivate 先作答再展开均已走通。
- 390px 宽下检查 Today、Domain、Explore、Inbox、Node Detail、Reactivate，未出现文档横向溢出。
- 最终源码构建后，新浏览器页面打开 Today 和 Explore 时控制台没有 error 或 warn。

限制：提取和 Reactivate 场景仍为本地 Mock；真正的语义相似关系需要后续 LLM 或人工编辑。浏览器中新增过一条用于验证分类归一化的表达「そこは分かるけど」。
