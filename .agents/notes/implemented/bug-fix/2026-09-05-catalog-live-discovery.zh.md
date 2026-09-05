# Agent Note: 实时优先、快照兜底的模型发现

Status: implemented

[English](2026-09-05-catalog-live-discovery.md) | 中文

## 问题

catalog 路由的模型发现直接返回构建期快照，新发布的模型要等下个 harness 版本才可见：live 端点有 35 个 OpenCode Go 模型，快照却落后了（缺 `muse-spark-1.3-contributor`、`omen-alpha` 等）。另外，内置 catalog 没收录的模型会让整条路由校验失败（`invalid()`——混合协议路由没有全路由协议可继承），往路由里加一个新 id 会导致整个分节被拒。

## 决定

[discovery.ts](../../../../packages/llm/llm-pi-ai/src/discovery.ts) 的 `discoverModels` 先走网络再回快照：先试显式配置的端点，再逐个试 catalog 自带的 listable 端点（按协议+baseURL 去重，不带鉴权），任何失败都回退快照——原来的离线行为是 fallback，不是特例。一次 live 尝试就是把 provider 清空后的内部 discovery 调用，取数、解析、错误分类仍在一处；尝试次数按不重复端点封顶，不按模型数。

[catalog.ts](../../../../packages/llm/llm-pi-ai/src/catalog.ts) 的 `resolveRouteModels` 对 catalog 未收录的 id，先按文档确认过的逐模型协议表解析，再找 listable catalog 兄弟项，最后才拒绝：catalog 描述不了的 id 不再拖累整条路由。

## 备选方案

**live id 与快照容量合并。** 对已知 id 返回并集并保留 catalog 的 context window，能补上端点不披露的容量。暂否决：这会让 Models 页消费的列表语义翻倍，而物化器对未披露容量本来就有路由默认值可回退。若选择器在纯 live id 上出现容量缺口，再跟进。

**只对显式端点保鲜。** 只在草稿给了 baseURL 才走网络，catalog 路由保持完全离线。否决，因为 catalog 路由恰恰是过期重灾区：没有任何部署会给 catalog 提供方配 baseURL，修了等于没修。

**给发现加配置项。** 不需要：保鲜是提供方行为，不是部署选择；部署不可能有意义地选择一份过期列表。

## 后果

catalog 路由的发现现在最多花几个无鉴权 GET（按不重复端点封顶），答不上来才回快照。live 行可能缺快照才有的容量，物化器处回退路由默认值。`discovery.spec.ts` 里三个用例按新契约重写了（显式端点优先；offer/withdraw 改用无可读列表的协议以保持 hermetic）——行为变更与测试同行。既有的 [draft-provider note](../architecture/2026-08-04-draft-provider-endpoint-interrogation.md) 仍拥有发现机制，其 catalog 相关事实以本 note 为准。

## 测试

`packages/llm/llm-pi-ai/tests/discovery-live.spec.ts` 用 mock server 固定了显式端点枚举与失败存活（含 hermetic 的快照回退：显式端点挂掉、provider 无 listable 模型）。重写后的 `discovery.spec.ts` 用例固定了优先级规则与 hermetic 的 offer/withdraw。开发期间另用端点 35 模型实测与消融实验（删手写声明 18→16，未声明 id 对话仍通）在单测之外验证了行为。
