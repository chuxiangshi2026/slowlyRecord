# 小程序端诗词地图功能迁移计划

> **目标**：将 uTools 端「诗词成语导入」对话框中的地图功能，迁移到小程序端（UniApp）。
> **创建日期**:2026-06-26
> **完成日期**:2026-06-29
> **预计工时**：4-5 个工作日（方案 B）
> **实际工时**：约 2.5 小时（含规划+开发+测试）
> **优先级**：中
> **状态**：✅ 已完成（待真机测试）

## ⚡ 完成快照

| 阶段 | 状态 | 实际工时 | 关键产物 |
|------|------|------|------|
| 1️⃣ 数据层移植 | ✅ | ~30 分钟 | `mobile/src/utils/poetry-location.ts` + 17 个测试 |
| 2️⃣ 基础地图组件 | ✅ | ~45 分钟 | `PoetryMapTab.vue` + 6 个 PNG 图标 |
| 3️⃣ 交互与详情 | ✅ | ~30 分钟 | `MapBottomSheet.vue` + 选中导入流程 |
| 4️⃣ 作者路线 | ✅ | ~25 分钟 | 单作者 picker + polyline + 自动方向箭头 |
| 5️⃣ 性能与边界 | ✅ | ~20 分钟 | shallowRef + 视野裁剪 + 空状态 + 50项上限 |
| 真机测试 | ⏳ | —— | 见下方测试清单 |

---

## 一、背景与目标

### 1.1 现状

**uTools 端**（`src/views/TextMemory/components/TextImportDialog.vue`）：
- 使用 Leaflet.js + 高德地图瓦片
- 完整实现：基础地图、诗词/成语标记、朝代疆域、作者生平路线、同地点多作品聚合
- 数据：`src/utils/poetry-location.ts`（160+ 地名→坐标字典）、`src/utils/dynasty-territory.ts`（朝代疆域数据）

**小程序端**（`mobile/src/subPackages/pages-memory/text-memory/`）：
- 数据层已就绪：`MobileTextArticle.location` 已存储，`geo` 类型已定义但未实现
- UI 层缺失：无任何地图相关组件
- 导入页面（`import.vue`）只有「粘贴批量 / 诗词库 / 成语库」三个 tab

### 1.2 目标

在小程序端导入页新增「地图」tab，实现：
- 在地图上查看所有带位置信息的诗词/成语
- 点击标记查看详情
- 按朝代/类型/作者筛选
- 在地图上选中作品后批量导入
- 作者生平路线可视化（折线）

### 1.3 非目标（明确不做）

- ❌ 朝代疆域多边形（性能差、移动端使用价值低）
- ❌ 路线方向箭头编号（图标资源膨胀）
- ❌ 复杂富文本 hover tooltip（移动端无 hover）
- ❌ uTools 端的 100% 视觉复刻

---

## 二、技术方案

### 2.1 技术选型

| 技术点 | 选型 | 理由 |
|------|------|------|
| 地图组件 | UniApp `<map>` 组件 | 跨平台，微信小程序原生支持 |
| 瓦片源 | 微信内置（腾讯地图） | 无需额外配置，国内体验最好 |
| 标记自定义 | 预设 PNG 图标 + Canvas 2D 动态生成（备选） | 兼容性最好 |
| 详情展示 | 底部 sheet（`<view>` + 动画） | 避免 `cover-view` 嵌套地狱 |
| 数据持久化 | 现有 `useTextMemory` store | 复用现有 store |

### 2.2 数据流

```
mobile/src/utils/poetry-location.ts  ← 从 src/utils/poetry-location.ts 移植
              ↓
   enrichGeo() 函数（addArticle 时自动调用）
              ↓
   MobileTextArticle.geo 字段填充
              ↓
   <map> 组件 markers 渲染
```

### 2.3 关键技术要点

#### 原生组件层级问题
小程序 `<map>` 是原生组件，z-index 永远最高。**不能在地图上直接弹出 modal**。
**对策**：
- 工具栏放在地图上方（地图区域固定高度，flex 布局）
- 详情弹窗用「底部 sheet」从下方滑出，地图自动收缩高度
- 不使用 `cover-view`/`cover-image` 嵌套

#### 标记点性能上限
单页面 markers 超过 300+ 明显卡顿。
**对策**：
- 同地点作品聚合为单个标记（带数字角标）
- 监听 `regionchange` 事件，仅渲染当前视野内的标记
- 全国概览时启用聚合策略（按省份级别分组）

#### 标记图标资源
不能用 HTML/CSS 标记，必须用图片文件。
**对策**：
- 预设 8 个静态图标：诗词单选/聚合/选中/选中聚合 × 2（诗词、成语）
- 数字角标用 Canvas 2D 动态生成（仅聚合标记需要）
- 图标放在 `mobile/src/subPackages/pages-memory/static/map-icons/`，控制在 30KB 以内

---

## 三、实施步骤（5 个阶段）

### 阶段 1：数据层移植（1 天）

**任务**：把地名→坐标的解析能力搬到小程序端。

#### 1.1 移植 `parseLocation`
- **源文件**：`src/utils/poetry-location.ts`
- **目标文件**：`mobile/src/subPackages/pages-tools/utils/poetry-location.ts`
- **改造点**：
  - 移除任何浏览器/Node 特定 API
  - 保持纯 JS 字典 + 模糊匹配逻辑
  - 类型导出 `LocationCoord = { lng: number; lat: number; name: string }`

#### 1.2 在 store 中接入 `enrichGeo`
- **文件**：`mobile/src/stores/useTextMemory.ts`
- **修改点**：
  - `addArticle()`：保存前自动调用 `enrichGeo(article)`
  - `addArticles()`：批量导入时统一 enrich
  - `updateArticle()`：当 location 字段变化时重新 enrich
  - `load()`：加载时为旧数据补全 `geo`

#### 1.3 增加迁移脚本（可选）
- 一次性扫描所有 `articles`，为缺失 `geo` 字段的补全
- 通过 `useTextMemory.migrate()` 在应用启动时调用一次

#### 验收标准
- [ ] 导入「静夜思 - 扬州」后，store 中的 article 包含 `geo: { lng: 119.4, lat: 32.4, name: '扬州' }`
- [ ] 已有诗词数据加载时自动补全 `geo`
- [ ] 不影响现有功能（粘贴、编辑、删除）

---

### 阶段 2：基础地图组件（1.5 天）

**任务**：在导入页新增「地图」tab，渲染所有诗词位置标记。

#### 2.1 准备标记图标
- **路径**：`mobile/src/subPackages/pages-memory/static/map-icons/`
- **文件清单**：
  ```
  poetry.png          诗词标记（蓝色圆点）24x24
  poetry-active.png   选中态（绿色圆点）28x28
  poetry-cluster.png  聚合标记（红色大圆）32x32
  idiom.png           成语标记（橙色圆点）24x24
  idiom-active.png    选中态（深绿色）28x28
  idiom-cluster.png   聚合标记 32x32
  ```
- 总体积控制在 30KB 以内（每个 ≤ 5KB）

#### 2.2 新建地图 tab 组件
- **文件**：`mobile/src/subPackages/pages-memory/text-memory/components/PoetryMapTab.vue`
- **结构**：
  ```vue
  <template>
    <view class="map-tab">
      <!-- 筛选工具栏 -->
      <view class="map-toolbar">
        <picker mode="selector" :range="categoryOptions">类型</picker>
        <picker mode="selector" :range="dynastyOptions">朝代</picker>
        <view class="selected-count">已选 {{ selectedCount }}</view>
      </view>

      <!-- 地图区域 -->
      <map
        :latitude="35.0"
        :longitude="105.0"
        :scale="4"
        :markers="markers"
        :polyline="routePolylines"
        @markertap="onMarkerTap"
        @regionchange="onRegionChange"
        class="map-area"
      />

      <!-- 底部 sheet -->
      <view v-if="sheetVisible" class="bottom-sheet">
        <!-- 单作品详情 / 多作品列表 -->
      </view>

      <!-- 导入按钮 -->
      <button @tap="handleImport">导入选中（{{ selectedCount }} 首）</button>
    </view>
  </template>
  ```

#### 2.3 标记数据计算
- **逻辑**：
  ```typescript
  // 1. 从诗词库 + 成语库收集所有带 location 的条目
  // 2. parseLocation 转坐标
  // 3. 按坐标分组（同地点聚合）
  // 4. 转为 markers 数组
  function buildMarkers(): UniMarker[] {
    const items = [...poetryItems, ...idiomItems]
      .map(it => ({ ...it, coord: parseLocation(it.location) }))
      .filter(it => it.coord);

    // 按坐标分组
    const groups = new Map<string, typeof items>();
    items.forEach(it => {
      const key = `${it.coord.lng},${it.coord.lat}`;
      const list = groups.get(key) || [];
      list.push(it);
      groups.set(key, list);
    });

    return Array.from(groups.values()).map(group => ({
      id: group[0].id,
      latitude: group[0].coord.lat,
      longitude: group[0].coord.lng,
      iconPath: pickIconPath(group),
      width: group.length > 1 ? 32 : 24,
      height: group.length > 1 ? 32 : 24,
      callout: {
        content: buildCalloutContent(group),
        // ...
      },
    }));
  }
  ```

#### 2.4 在 `import.vue` 中接入
- 新增 tab：`{ value: 'map', label: '地图' }`
- 切换到 map tab 时挂载 `<PoetryMapTab />`

#### 验收标准
- [ ] 切换到「地图」tab 能看到标记点
- [ ] 同地点多作品显示聚合标记（带数量徽章或不同图标）
- [ ] 类型/朝代筛选生效

---

### 阶段 3：交互与详情（1 天）

#### 3.1 点击标记 → 底部 sheet
- **单作品**：直接显示标题/作者/朝代/正文预览/位置
- **多作品**：显示作品列表（可滚动），每项可点击切换为详情视图
- **底部 sheet 高度**：
  - 默认 40vh
  - 上滑可展开到 80vh
  - 下滑关闭

#### 3.2 选中/取消选中
- 底部 sheet 中每个作品有 checkbox
- 选中后对应 marker 切换为 active 图标
- 顶部工具栏显示「已选 N 首」

#### 3.3 全选当前地图视野
- 工具栏「选中全部可见」按钮
- 基于 `regionchange` 维护当前可见 marker 列表

#### 验收标准
- [ ] 点击地图标记弹出底部 sheet
- [ ] 多作品场景显示列表，可单独选中/取消
- [ ] 选中状态实时反映在地图上（图标变色）

---

### 阶段 4：作者路线功能（1 天）

#### 4.1 作者筛选
- 工具栏新增「作者」picker（多选 picker，最多 3 位）
- 选中后地图只显示这些作者的标记
- 标记按作者用不同颜色（最多 3 种颜色）

#### 4.2 路线折线
- **数据**：按作者 + 创作年份排序，连成 polyline
- **样式**：
  ```typescript
  polylines: [{
    points: coords,
    color: '#43a047',
    width: 3,
    dottedLine: true,
  }]
  ```
- 不做箭头（用方案 B，简化）

#### 4.3 切换是否显示路线
- 工具栏 checkbox「显示生平路线」
- 关闭时只显示标记，不画 polyline

#### 验收标准
- [ ] 选择「李白」后只显示李白的作品标记
- [ ] 勾选「显示生平路线」后画出按年份连线
- [ ] 多作者同时选中时不同颜色区分

---

### 阶段 5：性能优化与边界处理（0.5 天）

#### 5.1 性能优化
- [ ] 视野裁剪：`regionchange` 后只保留可见区域内的 markers
- [ ] markers 数据 `Object.freeze()` 减少响应式开销
- [ ] 切换 tab 时延迟挂载 PoetryMapTab（首屏不阻塞）
- [ ] 诗词库/成语库数据使用 `shallowRef`

#### 5.2 边界处理
- [ ] 无位置数据时显示空状态
- [ ] `parseLocation` 失败时的降级（显示在列表底部「无法定位」）
- [ ] 地图加载失败的 toast 提示
- [ ] 选中数量限制（≤ 50 首，超过时提示）

#### 5.3 兼容性测试
- [ ] iOS 微信测试
- [ ] Android 微信测试
- [ ] 低端机性能测试（红米/iPhone SE 等）

#### 验收标准
- [ ] 视野内 500+ 标记时滑动不卡顿
- [ ] 在低端机上能流畅交互
- [ ] 所有边界场景都有友好提示

---

## 四、文件清单

### 新增文件

```
mobile/src/subPackages/pages-tools/utils/poetry-location.ts    # 地名解析（移植自 src/utils/）
mobile/src/subPackages/pages-memory/text-memory/components/PoetryMapTab.vue   # 地图 tab 主组件
mobile/src/subPackages/pages-memory/text-memory/components/MapBottomSheet.vue # 底部详情 sheet
mobile/src/subPackages/pages-memory/static/map-icons/poetry.png
mobile/src/subPackages/pages-memory/static/map-icons/poetry-active.png
mobile/src/subPackages/pages-memory/static/map-icons/poetry-cluster.png
mobile/src/subPackages/pages-memory/static/map-icons/idiom.png
mobile/src/subPackages/pages-memory/static/map-icons/idiom-active.png
mobile/src/subPackages/pages-memory/static/map-icons/idiom-cluster.png
```

### 修改文件

```
mobile/src/stores/useTextMemory.ts                # 接入 enrichGeo
mobile/src/subPackages/pages-memory/text-memory/import.vue   # 新增「地图」tab
mobile/src/manifest.json                          # 配置位置权限（如需用户定位）
```

### 不需要修改

```
mobile/src/stores/useUtils/types.ts               # geo 字段类型已存在
```

---

## 五、配置变更

### 5.1 manifest.json（如需用户当前位置）

仅在需要「定位到我附近的诗词位置」功能时配置。**当前方案不需要**，可保持现状。

如果未来扩展，需要：

```json
"mp-weixin": {
  "requiredPrivateInfos": ["getLocation"],
  "permission": {
    "scope.userLocation": {
      "desc": "用于显示附近的诗词地理位置"
    }
  }
}
```

### 5.2 微信公众平台后台

无需任何后台配置（仅使用 map 组件无需开通额外接口）。

---

## 六、风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 标记数过多卡顿 | 高 | 高 | 视野裁剪 + 聚合策略 |
| iOS/Android map 表现不一致 | 中 | 中 | 两端真机测试，特定平台用 #ifdef |
| 底部 sheet 与地图层级冲突 | 中 | 高 | sheet 弹出时收缩地图区域，避免覆盖 |
| 图标资源膨胀 | 低 | 中 | 严格控制每个图标 ≤ 5KB，必要时用 SVG |
| 部分诗词 location 无法解析 | 高 | 低 | parseLocation 失败的条目降级到列表 |
| `geo` 字段为旧数据补全失败 | 低 | 低 | 增加补偿迁移脚本 |

---

## 七、验收清单（整体）

### 功能验收
- [ ] 「导入文本」页面有「地图」tab
- [ ] 地图能显示所有带位置的诗词/成语
- [ ] 同地点多作品聚合显示
- [ ] 类型/朝代/作者筛选可用
- [ ] 点击标记弹出底部 sheet
- [ ] 可在地图上选中/取消选中作品
- [ ] 选中作品可批量导入
- [ ] 作者生平路线可视化（可开关）

### 性能验收
- [ ] 切换到地图 tab ≤ 1s
- [ ] 500 个标记滑动 60fps
- [ ] 内存占用 ≤ 100MB

### 兼容性验收
- [ ] iOS 微信
- [ ] Android 微信
- [ ] 低端机（红米 Note 系列）

### 代码质量
- [ ] 所有 TS 类型正确
- [ ] 无 console.log 残留
- [ ] poetry-location 单元测试覆盖率 ≥ 80%
- [ ] 关键函数有注释

---

## 八、后续可选扩展

迁移完成后，若有时间可继续优化：

1. **🔍 搜索定位**：在地图上搜索地名直接跳转
2. **📍 我的位置**：定位用户后显示「附近创作的诗词」
3. **🎨 主题切换**：地图样式跟随 app 深色/浅色主题
4. **🗺️ 离线地图**：缓存常用区域瓦片
5. **🚶 路线动画**：作者生平路线带流光动画
6. **📊 统计视图**：按地区统计作品数量（热力图）
7. **🌍 朝代疆域**：以静态图片叠加替代多边形（降低性能消耗）

---

## 九、参考资料

### uTools 端实现
- 主组件：`src/views/TextMemory/components/TextImportDialog.vue`（地图 tab 在 667-761 行）
- 地图数据：`src/utils/poetry-location.ts`、`src/utils/dynasty-territory.ts`
- 独立地图：`src/views/TextMemory/components/PoetryMap.vue`

### UniApp / 小程序文档
- [UniApp map 组件](https://uniapp.dcloud.net.cn/component/map.html)
- [微信小程序 map 组件](https://developers.weixin.qq.com/miniprogram/dev/component/map.html)
- [marker 配置项](https://developers.weixin.qq.com/miniprogram/dev/component/map.html#marker)

### 项目相关文档
- 项目说明：`CLAUDE.md`
- 移动端代码：`mobile/src/`
