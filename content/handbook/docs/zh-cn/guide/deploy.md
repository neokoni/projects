---
order: 3
---

# 部署

## 一次构建，整目录覆盖

单站点最大的简化在这里：`dist/` 就是完整站点，没有「谁拥有哪个子目录」的问题，部署可以直接整目录替换。

```bash
pnpm build     # 产出 dist/
pnpm preview   # 本地按线上方式预览（cleanUrls、统一 404）
```

## GitHub Actions

`.github/workflows/deploy.yml` 在 `main` 分支推送后执行：装依赖 → 构建 → `appleboy/scp-action` 上传到 1Panel 站点目录。

| 项 | 值 |
| --- | --- |
| 目标目录 | `/opt/1panel/www/sites/projects.neokoni.ink/index` |
| 认证 | 密码，secrets 为 `SERVER_HOST` / `SERVER_PORT` / `SERVER_USERNAME` / `SERVER_PASSWORD` |
| 覆盖策略 | `rm: true`，`strip_components: 1` |

历史哈希文件名会随整目录替换一起清掉，不用担心 `assets/` 累积。

## 服务器侧

1Panel 生成的站点配置里必须有这一行，否则 `cleanUrls` 的页面（`/handbook/docs/zh-cn/guide/writing` 这种无后缀地址）会 404：

```nginx
location / {
    try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

`404.html` 由 VitePress 构建产出，不需要额外维护。

## 回滚

重跑上一次成功的 Actions run 即可；`dist/` 是自洽的，不存在新旧文件混在一起的问题。
