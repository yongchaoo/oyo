# DELETE vs TRUNCATE vs DROP 的区别

### 标准答案

1. **DELETE**: DML 语句，逐行删除，可以带 WHERE 条件，可回滚，触发触发器，不重置自增 ID
2. **TRUNCATE**: DDL 语句，清空整表，不可回滚，不触发触发器，重置自增 ID
3. **DROP**: DDL 语句，删除整个表结构和数据，不可回滚

### 追问点

- 性能差异：TRUNCATE 比 DELETE 快，因为不记录逐行日志
- 外键约束：有外键引用的表不能 TRUNCATE
- 事务中：DELETE 可以回滚，TRUNCATE/DROP 不行（隐式 COMMIT）
