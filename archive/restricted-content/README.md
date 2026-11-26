# 受限内容归档

这里存放**曾经随产品分发、但权属或服务条款不允许再发布**的内容。文件仅用于溯源与内部留存，**任何构建都不得引用或打包**。

## 为什么在这里

- `desktop/`、`mobile/`：影视剧相关词库与电影台词、名言警句。台词属于影视作品版权，剧名/片名同时涉及商标与"暗示关联"，不能再作为内置词库分发。两端各一份，内容一致。
- `english/movie-scripts.json`：英文经典模块的"电影片段"正文。与上同理。

## 恢复方式

需要重新上架时，必须先取得权利方书面授权（台词、剧名/片名），再把文件移回 `public/wordbanks/`、`mobile/wordbank-json/`、`public/datafile/english/`，并同步恢复：

- `src/utils/wordbank-service.ts` 的 `WordBankType` 与 `EXTENDED_WORDBANKS`
- `mobile/wordbank-json/index.json` 清单
- `mobile/src/utils/remote-wordbank.ts` 的分类映射
- `src/utils/english-classic-service.ts` 的 `movies` 分类

没拿到授权就不要恢复；`scripts/strip-store-forbidden.cjs` 的产物闸门也会拦截相关特征串。
