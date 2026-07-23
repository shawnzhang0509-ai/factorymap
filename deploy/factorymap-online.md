# factorymap.online — 恢复工厂地图

`mbti.wtf` 继续用 **main** 分支（MBTI 社交地图）。  
`factorymap.online` 用 **`factory-map-legacy`** 分支（回滚到 MBTI 改版前的 China Factory Map）。

两套站点必须 **前后端、数据库分开**，否则会互相覆盖数据。

## 架构

| 域名 | Git 分支 | 前端 (Vercel) | 后端 (Render) | 数据库 |
|------|----------|---------------|---------------|--------|
| mbti.wtf | `main` | 现有项目 | `factorymap` (现有) | 现有 PostgreSQL（MBTI 资料） |
| factorymap.online | `factory-map-legacy` | **新建项目** | **新建服务** `factorymap-factory` | **新建或恢复备份** |

## 1. Render — 工厂地图后端（新建）

1. Render Dashboard → **New → Web Service**
2. 连接同一 GitHub 仓库 `factorymap`
3. **Branch**: `factory-map-legacy`
4. **Root Directory**: `backend`
5. **Build**: `pip install -r requirements.txt`
6. **Start**: `gunicorn run:app`（或与现有 `factorymap` 服务相同启动命令）
7. **Service name** 建议: `factorymap-factory` → URL 为 `https://factorymap-factory.onrender.com`

### 环境变量（工厂专用）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | **新的** PostgreSQL（不要用 MBTI 那个库） |
| `SECRET_KEY` | 随机长字符串 |
| `CLOUDFLARE_*` / Cloudinary | 与现网相同（图片上传） |

**不要** 在工厂库上设置 `PURGE_ALL_SHOPS_ONCE`。

### 数据库

- 若有工厂数据备份：恢复到新 Postgres，填入 `DATABASE_URL`
- 若无备份：部署后登录管理员 → **Excel 批量导入** 重新上传工厂表格

## 2. Vercel — factorymap.online 前端（新建项目）

1. **Add New Project** → 同一仓库
2. **Production Branch**: `factory-map-legacy`
3. **Root Directory**: `frontend`
4. **Environment Variables**:

```
VITE_API_BASE_URL=https://factorymap-factory.onrender.com
```

5. **Domains** → 添加 `factorymap.online`（及 `www.factorymap.online` 如需要）

现有 **mbti.wtf** 的 Vercel 项目保持 **main** 分支，不要改。

## 3. DNS

在域名注册商把 `factorymap.online` 指到 Vercel 给出的 CNAME（与 mbti.wtf 类似，两条记录独立配置）。

## 4. 验证

- `https://factorymap.online` → 标题应为 **China Factory Map**，地图为工厂/MOQ 筛选
- `https://mbti.wtf` → **MBTI 社交地图**，互不影响
- 工厂后台 `https://factorymap-factory.onrender.com` 应能 `GET /shops` 返回工厂数据

## 5. 常见问题

**工厂站打开却是 MBTI 资料？**  
前端 `VITE_API_BASE_URL` 指错了，或 Vercel 仍部署的 `main` 分支。

**工厂站地图空白？**  
检查 `VITE_TIANDITU_TK`（天地图 key）是否在工厂 Vercel 项目里配置。

**想从旧库恢复数据？**  
Render Postgres → Backups，或联系 Render 支持恢复 pivot 前的快照到新实例。
