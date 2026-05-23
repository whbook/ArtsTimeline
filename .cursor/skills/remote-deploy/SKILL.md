---
name: remote-deploy
description: 将 Timeline 的 API、管理端（AdminBlazor）、用户端（React SPA）发布并部署到远程 Windows 服务器（8.152.158.252）。当用户说"发布"、"部署"、"更新服务器"、"上线"、"推送到远程"、"redeploy"时使用此 skill。
---

# Timeline 远程发布

## 服务器信息

| 项目 | Windows 服务名 | 端口 | 发布目录 |
|------|------------|------|---------|
| API | `Timeline-Api` | 5287 | `D:\WebProjects\Timeline\api` |
| 管理端 | `Timeline-Admin` | 5102 | `D:\WebProjects\Timeline\admin` |
| 用户端 | （静态，无服务） | — | `D:\WebProjects\ArtsTimeline` |

| 域名 | 用途 |
|------|------|
| `timeline.longmaiyun.cn` | 用户端 SPA |
| `timeline-api.longmaiyun.cn` | API |
| `timeline-admin.longmaiyun.cn` | 管理端 |

- SSH 别名：`win-ssh-2222`
- 数据库：`Host=localhost;Port=5432;Database=timeline;Username=epochai`
- PostgreSQL：`D:\Program Files\PostgreSQL\18\`

## 首次初始化（服务器一次性）

```powershell
ssh win-ssh-2222 powershell -ExecutionPolicy Bypass -File D:\WebProjects\Timeline\remote-setup.ps1
ssh win-ssh-2222 powershell -ExecutionPolicy Bypass -File D:\WebProjects\Timeline\create-db.ps1
```

## 日常发布

```powershell
powershell -ExecutionPolicy Bypass -File .cursor\skills\remote-deploy\scripts\deploy.ps1
# 或仅更新单个项目：
powershell -ExecutionPolicy Bypass -File .cursor\skills\remote-deploy\scripts\deploy.ps1 -Project api
```

## 验证

```powershell
Invoke-WebRequest https://timeline.longmaiyun.cn -UseBasicParsing
Invoke-WebRequest https://timeline-admin.longmaiyun.cn -UseBasicParsing
# API 登录：POST https://timeline-api.longmaiyun.cn/api/auth/admin/login
```

默认管理员：`admin` / `ChangeMe123!`（首次启动 API 后由 BootstrapAdmin 创建）

## 注意事项

- `appsettings.Production.json` 含数据库密码，已 gitignore，发布时会随 dotnet publish 打包
- SSL 由 win-acme 管理，证书目录 `C:\nginx\ssl\<域名>\`
- Nginx 配置：`D:\WebProjects\Timeline\timeline-servers.conf`（API/Admin），用户端见 `C:\nginx\conf\artstimeline.conf`
