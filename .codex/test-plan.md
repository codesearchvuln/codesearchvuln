# Codex MCP 集成测试规划

## 目标
测试 Claude Code 与 Codex MCP 的协作开发流程

## 测试场景
为 AuditTool 项目添加一个简单的工具函数

## 规划步骤

### 1. 需求分析
创建一个通用的日期格式化工具函数，用于统一项目中的日期显示格式。

### 2. 设计决策
- **位置**: `backend/app/utils/date_utils.py`
- **功能**:
  - 格式化日期时间为 ISO 8601 格式
  - 格式化日期时间为中文友好格式
  - 计算相对时间（如"3小时前"）
- **依赖**: Python 标准库 datetime

### 3. 实现计划
```python
# backend/app/utils/date_utils.py

from datetime import datetime, timezone
from typing import Optional

def format_iso(dt: datetime) -> str:
    """格式化为 ISO 8601 格式"""
    return dt.isoformat()

def format_chinese(dt: datetime) -> str:
    """格式化为中文友好格式"""
    return dt.strftime("%Y年%m月%d日 %H:%M:%S")

def relative_time(dt: datetime, now: Optional[datetime] = None) -> str:
    """计算相对时间"""
    if now is None:
        now = datetime.now(timezone.utc)

    delta = now - dt
    seconds = delta.total_seconds()

    if seconds < 60:
        return "刚刚"
    elif seconds < 3600:
        return f"{int(seconds / 60)}分钟前"
    elif seconds < 86400:
        return f"{int(seconds / 3600)}小时前"
    else:
        return f"{int(seconds / 86400)}天前"
```

### 4. 测试计划
```python
# backend/tests/test_date_utils.py

from datetime import datetime, timezone, timedelta
from app.utils.date_utils import format_iso, format_chinese, relative_time

def test_format_iso():
    dt = datetime(2026, 3, 7, 12, 0, 0, tzinfo=timezone.utc)
    assert format_iso(dt) == "2026-03-07T12:00:00+00:00"

def test_format_chinese():
    dt = datetime(2026, 3, 7, 12, 0, 0)
    assert format_chinese(dt) == "2026年03月07日 12:00:00"

def test_relative_time():
    now = datetime(2026, 3, 7, 12, 0, 0, tzinfo=timezone.utc)

    # 30秒前
    dt1 = now - timedelta(seconds=30)
    assert relative_time(dt1, now) == "刚刚"

    # 5分钟前
    dt2 = now - timedelta(minutes=5)
    assert relative_time(dt2, now) == "5分钟前"

    # 2小时前
    dt3 = now - timedelta(hours=2)
    assert relative_time(dt3, now) == "2小时前"

    # 3天前
    dt4 = now - timedelta(days=3)
    assert relative_time(dt4, now) == "3天前"
```

## 执行说明

这个规划文档展示了完整的开发流程：
1. Claude Code 负责需求分析和架构设计
2. 生成详细的实现计划和测试用例
3. Codex MCP 可以接收这个规划并执行具体的代码实现

## 下一步

要让 Codex MCP 执行这个规划，需要：
1. 确保 Codex MCP 服务器已启动并连接
2. 将规划内容传递给 Codex
3. Codex 执行代码生成和测试
4. Claude Code 审查结果并提供反馈
