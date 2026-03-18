// 引入依赖
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");

// 创建 Express 应用
const app = express();
const PORT = process.env.PORT || 3000; // Render 会自动分配端口，必须用这个

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化 SQLite 数据库（存在当前目录的 vote.db 文件）
const db = new sqlite3.Database("./vote.db", (err) => {
  if (err) console.error("数据库连接失败：", err.message);
  else console.log("✅ SQLite 数据库连接成功");
});

// 自动创建表 + 初始化候选人数据（第一次运行自动执行）
db.serialize(() => {
  // 候选人表
  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    img_url TEXT DEFAULT 'https://picsum.photos/200/200?random=1',
    votes INTEGER DEFAULT 0
  )`);

  // 投票记录表（防重复投票）
  db.run(`CREATE TABLE IF NOT EXISTS vote_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    candidate_id INTEGER NOT NULL
  )`);

  // 插入 10 位初始候选人（只在第一次运行时插入）
  const candidates = [
    ["候选人1", "https://picsum.photos/200/200?random=1"],
    ["候选人2", "https://picsum.photos/200/200?random=2"],
    ["候选人3", "https://picsum.photos/200/200?random=3"],
    ["候选人4", "https://picsum.photos/200/200?random=4"],
    ["候选人5", "https://picsum.photos/200/200?random=5"],
    ["候选人6", "https://picsum.photos/200/200?random=6"],
    ["候选人7", "https://picsum.photos/200/200?random=7"],
    ["候选人8", "https://picsum.photos/200/200?random=8"],
    ["候选人9", "https://picsum.photos/200/200?random=9"],
    ["候选人10", "https://picsum.photos/200/200?random=10"],
  ];
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO candidates (name, img_url) VALUES (?, ?)",
  );
  candidates.forEach((c) => stmt.run(c[0], c[1]));
  stmt.finalize();
});

// 接口 1：获取所有候选人
app.get("/api/candidates", (req, res) => {
  db.all("SELECT * FROM candidates ORDER BY id", (err, rows) => {
    if (err)
      res
        .status(500)
        .json({ code: 500, message: "获取失败", error: err.message });
    else res.json({ code: 200, message: "成功", data: rows });
  });
});

// 接口 2：检查用户名是否已投票
app.post("/api/check-vote", (req, res) => {
  const { username } = req.body;
  if (!username)
    return res.json({ code: 400, message: "用户名不能为空", voted: false });

  db.get(
    "SELECT * FROM vote_records WHERE username = ?",
    [username],
    (err, row) => {
      if (err)
        res
          .status(500)
          .json({ code: 500, message: "检查失败", error: err.message });
      else res.json({ code: 200, message: "成功", voted: !!row });
    },
  );
});

// 接口 3：提交投票
app.post("/api/vote", (req, res) => {
  const { username, candidateId } = req.body;
  if (!username || !candidateId)
    return res.json({ code: 400, message: "参数不全" });

  // 1. 先检查是否已投票
  db.get(
    "SELECT * FROM vote_records WHERE username = ?",
    [username],
    (err, row) => {
      if (err)
        return res
          .status(500)
          .json({ code: 500, message: "投票失败", error: err.message });
      if (row) return res.json({ code: 403, message: "该用户已投过票" });

      // 2. 插入投票记录
      db.run(
        "INSERT INTO vote_records (username, candidate_id) VALUES (?, ?)",
        [username, candidateId],
        (err) => {
          if (err)
            return res
              .status(500)
              .json({ code: 500, message: "投票失败", error: err.message });

          // 3. 更新候选人票数
          db.run(
            "UPDATE candidates SET votes = votes + 1 WHERE id = ?",
            [candidateId],
            (err) => {
              if (err)
                return res
                  .status(500)
                  .json({ code: 500, message: "投票失败", error: err.message });
              res.json({ code: 200, message: "投票成功" });
            },
          );
        },
      );
    },
  );
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`✅ 投票服务器启动成功！端口：${PORT}`);
});
