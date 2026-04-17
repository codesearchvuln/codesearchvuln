## Feat
- [ ] 添加文件审计功能
- [ ] 前端文件/智能/混合扫描日志详情展示进度 (Recon → Analysis → Verication → End)
## Refactor
- [x] 重构Recon

## Fix
- [x] backend 报错。unclosed client session
![backend 报错](./images/1.png)
- [ ] 新版本中静态扫描详情页打开时间比较长 → 改为分页查询
- [ ] 返回时总是返回到第一页 → 记录跳转前状态
- [ ] 扫描详情显示有漏洞，但是任务栏看不到
![扫描详情显示有漏洞，但是任务栏看不到](./images/2.png)
![扫描详情显示有漏洞，但是任务栏看不到](./images/3.png)
- [ ] 漏洞不存在或已被清理
![漏洞不存在或已被清理](./images/4.png)