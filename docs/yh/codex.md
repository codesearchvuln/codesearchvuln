## Agent 责任修改
### VerficationAgent
VerificationAgent在结束前调用save工具保存结果，在结束时输出漏洞报告. 
agent_findings表,必填的字段有: 
`task_id`: 任务ID (程序填写),
`vulnerability_type`: CWE编号,
`severity`: 危害等级,
`cvss_score`: cvss3.1分数,
`cvss_vector`: cvss3.1向量,
`title`: 标题,
`description`: 漏洞描述,
`file_path`: 漏洞文件,
`line_start`: 起始行号,
`line_end`: 终止行号,
`function_name`: 函数名称,
`code_snippet`: 漏洞片段 (已知文件和行号用代码提取),
`source`: 源,
`sink`: 漏洞点,
`dataflow_path`: 数据流,
`status`: 进行中/已完成 (由代码进行修改),
`is_verified`: 是否确认漏洞存在,
`poc_code`: Fuzzing Harness的代码,
`suggestion`: 修复建议,
`confidence`: 置信度,
`report`: 漏洞报告(收集VerificationAgent的输出结果保存),

修改`save`工具，大模型必须保存的字段有: `vulnerability_type`, `severity`, `cvss_score`, `cvss_vector`, `title`, `description`, `file_path`, `line_start`, `line_end`, `function_name`, `source`, `sink`, `dataflow_path`, `is_verified`, `poc_code`, `suggestion`, `confidence`.
由Python程序完成的字段有: `task_id`, `status`, `code_snippet`. `report`.

漏洞报告的9个必填字段

1. 基本信息 (让读者快速了解漏洞全貌)
漏洞类型 + CWE-ID + 严重程度 + CVSS3.1评分 + 受影响组件 + 文件:行号
1. 触发条件 (明确利用场景，避免"理论漏洞")
漏洞触发的前置条件列表
1. 所需权限 (评估实战威胁)
利用所需的最低权限 (无需认证/低权限/高权限)
1. 漏洞原理 (让开发理解"为什么有漏洞")
编号步骤的逐步分析 (≥2步)
1. 代码证据 (反幻觉: 可验证的证据)
关键代码片段 + 文件:行号 (必须来自实际Read)
1. 调用链 (证明用户输入确实能够到达危险函数)
Source -> Sink 完整路径图，每条标注文件:行号
1. PoC
可以证明的Fuzzing Harness
1. 业务影响 (让管理层理解风险)
对业务实际影响描述
1.  修复建议 (给出可执行的修复路径)
具体修复方案 (≥1条)

### ReportAgent
ReportAgent负责根据发现的漏洞生成一个项目风险评估报告(总体). 在agent_tasks表中添加一个report字段用来保存.
