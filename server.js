// 1. 引入依赖包
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bodyParser = require("body-parser");

// 2. 创建Express应用
const app = express();
const PORT = 3000;

// 3. 中间件配置
app.use(cors()); // 允许跨域请求
app.use(bodyParser.json()); // 解析JSON请求
app.use(bodyParser.urlencoded({ extended: true }));

// 4. 数据库配置（和XAMPP一致，已帮你改好！）
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "", // XAMPP默认密码为空
  database: "vote_system",
};

// 5. 接口1：获取所有候选人信息
app.get("/api/candidates", async (req, res) => {
  try {
    // 连接数据库
    const connection = await mysql.createConnection(dbConfig);
    // 查询候选人数据（按id排序）
    const [rows] = await connection.execute(
      "SELECT * FROM candidates ORDER BY id",
    );
    await connection.end(); // 关闭连接

    // 返回结果
    res.json({
      code: 200,
      message: "获取候选人成功",
      data: rows,
    });
  } catch (error) {
    console.error("获取候选人失败：", error);
    res.status(500).json({
      code: 500,
      message: "服务器错误",
      error: error.message,
    });
  }
});

// 6. 接口2：检查用户名是否已投票
app.post("/api/check-vote", async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.json({ code: 400, message: "用户名不能为空", voted: false });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM vote_records WHERE username = ?",
      [username],
    );
    await connection.end();

    res.json({
      code: 200,
      message: "检查成功",
      voted: rows.length > 0, // 有记录则已投票
    });
  } catch (error) {
    console.error("检查投票状态失败：", error);
    res.status(500).json({ code: 500, message: "服务器错误" });
  }
});

// 7. 接口3：提交投票（核心防重复逻辑）
app.post("/api/vote", async (req, res) => {
  const { username, candidateId } = req.body;

  // 参数验证
  if (!username || !candidateId) {
    return res.json({ code: 400, message: "参数不能为空" });
  }

  // 创建数据库连接（使用事务保证数据安全）
  const connection = await mysql.createConnection(dbConfig);
  try {
    // 开启事务
    await connection.beginTransaction();

    // 第一步：再次检查是否已投票（双重验证）
    const [voteRecords] = await connection.execute(
      "SELECT * FROM vote_records WHERE username = ?",
      [username],
    );
    if (voteRecords.length > 0) {
      await connection.rollback(); // 回滚事务
      return res.json({ code: 403, message: "该用户名已投过票，无法重复投票" });
    }

    // 第二步：插入投票记录
    await connection.execute(
      "INSERT INTO vote_records (username, candidate_id) VALUES (?, ?)",
      [username, candidateId],
    );

    // 第三步：更新候选人票数
    await connection.execute(
      "UPDATE candidates SET votes = votes + 1 WHERE id = ?",
      [candidateId],
    );

    // 提交事务
    await connection.commit();
    await connection.end();

    res.json({ code: 200, message: "投票成功" });
  } catch (error) {
    // 出错则回滚事务
    await connection.rollback();
    await connection.end();
    console.error("投票失败：", error);
    res.status(500).json({ code: 500, message: "投票失败，请重试" });
  }
});

// 8. 启动服务器（关键！没有这行代码程序会直接退出）
app.listen(PORT, () => {
  console.log(`✅ 投票服务器启动成功！`);
  console.log(`📡 服务地址：http://localhost:${PORT}`);
  console.log(`📊 候选人接口：http://localhost:${PORT}/api/candidates`);
});
