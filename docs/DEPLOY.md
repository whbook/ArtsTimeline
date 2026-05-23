# Timeline 远程部署说明

## 服务器信息

| 组件 | Windows 服务名 | 端口 | 发布目录 |
|------|----------------|------|----------|
| Timeline.Api | `Timeline-Api` | 5287 | `D:\WebProjects\Timeline\api` |
| Timeline.AdminBlazor | `Timeline-Admin` | 5102 | `D:\WebProjects\Timeline\admin` |

- SSH: `Administrator@8.152.158.252 -p 2222`
- 数据库: `Host=localhost;Port=5432;Database=timeline;Username=epochai;Password=<与 EpochAI 相同>`

## 一次性建库

在服务器上以 postgres 用户执行 [database/create_remote_db.sql](../database/create_remote_db.sql)：

```sql
CREATE DATABASE timeline OWNER epochai;
GRANT ALL PRIVILEGES ON DATABASE timeline TO epochai;
```

首次启动 Timeline.Api 时会自动执行 `init.sql`、同步 6 个展览种子数据并创建 bootstrap 管理员。

## 本地发布与上传

```powershell
cd D:\Codes\ArtsTimeline
powershell -ExecutionPolicy Bypass -File .cursor\skills\remote-deploy\scripts\deploy.ps1
```

## 域名

| 域名 | 组件 |
|------|------|
| `timeline.longmaiyun.cn` | 用户端 React SPA |
| `timeline-api.longmaiyun.cn` | Timeline.Api |
| `timeline-admin.longmaiyun.cn` | Timeline.AdminBlazor |

## 首次服务器初始化

```powershell
# 上传 remote-setup.ps1、timeline-servers-*.conf、create-db.ps1 后：
ssh win-ssh-2222 powershell -ExecutionPolicy Bypass -File D:\WebProjects\Timeline\remote-setup.ps1
ssh win-ssh-2222 powershell -ExecutionPolicy Bypass -File D:\WebProjects\Timeline\create-db.ps1
```

## 本地联调（Admin 指向线上 API）

在 `Timeline.AdminBlazor/appsettings.Development.json` 中设置：

```json
{ "ApiBaseUrl": "https://timeline-api.longmaiyun.cn/" }
```

然后 `dotnet run --project Timeline.AdminBlazor`。

## 生产配置

在服务器上分别配置（勿提交 git）：

- `api/appsettings.Production.json` — 连接字符串、Jwt:Secret
- `admin/appsettings.Production.json` — ApiBaseUrl、Syncfusion:LicenseKey

## Windows 服务注册（服务器首次）

```powershell
sc.exe create Timeline-Api binPath= "D:\WebProjects\Timeline\api\Timeline.Api.exe" start= auto
sc.exe create Timeline-Admin binPath= "D:\WebProjects\Timeline\admin\Timeline.AdminBlazor.exe" start= auto
```

Nginx 反代示例域名：`timeline-admin.longmaiyun.cn` → `http://127.0.0.1:5102`，API → `http://127.0.0.1:5287`。
