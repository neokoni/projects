---
order: 3
---

# 部署

## 构建与整目录覆盖

`dist/` 为完整站点，不涉及子目录归属，部署时可将该目录整体替换。

```bash
pnpm build     # 产出 dist/
pnpm preview   # 本地按线上方式预览（cleanUrls、统一 404）
```

## GitHub Actions

`.github/workflows/deploy.yml` 在 `main` 分支推送后执行：安装依赖、构建、由 `appleboy/scp-action` 上传至 1Panel 站点目录。

| 配置项 | 取值 |
| --- | --- |
| 目标目录 | `/opt/1panel/www/sites/projects.neokoni.ink/index` |
| 认证 | 密码，secrets 为 `SERVER_HOST` / `SERVER_PORT` / `SERVER_USERNAME` / `SERVER_PASSWORD` |
| 覆盖策略 | `rm: true`，`strip_components: 1` |

历史哈希文件名随整目录替换一并删除，不会在 `assets/` 中累积。

## 服务器配置

1Panel 生成的站点配置须包含以下内容。缺少 `try_files` 行时，`cleanUrls` 的页面（如 `/handbook/docs/zh-cn/guide/writing` 这类无后缀地址）将返回 404。

```nginx
location / {
    try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

`404.html` 由 VitePress 构建产出，无需额外维护。

## 回滚

重跑上一次成功的 Actions run。`dist/` 为自洽产物，不存在新旧文件混合的情况。
