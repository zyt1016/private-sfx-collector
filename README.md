# 私有云端音效库

这是现有离线音效收集器的 Supabase 云端版。登录后，音频文件存到 Supabase Storage，分类、项目、标签、备注等元数据存到 Supabase Database。换浏览器或换电脑后，只要打开同一个部署链接并登录同一个账号，就能看到同一个音效库。

运行时不会调用 AI，也不会消耗 token。

## 1. 创建 Supabase 项目

1. 打开 Supabase，创建一个新项目。
2. 进入 `SQL Editor`。
3. 复制并执行 `supabase-schema.sql` 的全部内容。
4. 进入 `Authentication > Providers`，确认 `Email` 登录开启。
5. 如果你不想开放注册，可以在你注册完账号后，关闭公开注册。

## 2. 配置前端

复制配置文件：

```text
config.example.js -> config.js
```

然后把 `config.js` 改成你的 Supabase 项目配置：

```js
window.SFX_SUPABASE_CONFIG = {
  url: "https://你的项目.supabase.co",
  anonKey: "你的 anon public key"
};
```

这两个值在 Supabase 项目的 `Project Settings > API` 里。

## 3. 本地打开测试

直接用浏览器打开 `index.html`。如果浏览器阻止某些模块行为，可以用一个静态服务器打开：

```powershell
python -m http.server 5177
```

然后访问：

```text
http://localhost:5177/outputs/cloud-sfx-collector/
```

## 4. 部署

这个文件夹是纯静态网站，可以部署到：

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages
- 你自己的静态服务器

部署内容就是整个 `cloud-sfx-collector` 文件夹。

## 5. 迁移现有离线音效

离线版里点击“导出库”，得到 `sfx-library-日期.json`。目前云端版不直接导入这个 JSON，需要把 JSON 里的音频重新上传，或者后续再加一个“导入离线库到云端”的按钮。

推荐迁移方式：

1. 在离线版中导出库作为备份。
2. 在云端版中登录。
3. 重新拖入原始音频文件或文件夹上传。

如果你希望保留离线版里所有分类、项目、标签和备注，可以继续让我加“导入离线库 JSON 到 Supabase”的功能。

## 6. 权限说明

SQL 已开启 Row Level Security：

- 每个用户只能看到自己的 `sounds` 记录。
- 每个用户只能访问 Storage 中自己用户 ID 文件夹下的音频。
- Bucket `sfx-audio` 是私有的，播放时前端会生成短期签名链接。

这适合“只给我自己看”的私有音效库。
