const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API代理
app.use('/api', (req, res, next) => {
  // TODO: 实现API代理逻辑
  next();
});

// SPA路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});


